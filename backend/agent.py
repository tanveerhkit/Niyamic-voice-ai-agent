"""LiveKit voice agent: Deepgram STT -> Azure OpenAI -> Smallest AI TTS.

Answers customer questions from the uploaded datasets. Spreadsheets are queried by
exact match (orders, payments, balances); PDFs by full-text search (policies, FAQs).

    python agent.py dev     # local development, auto-reload
    python agent.py start   # production
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
import time
import uuid
from typing import Any

from livekit import rtc
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    ConversationItemAddedEvent,
    JobContext,
    JobProcess,
    RunContext,
    StopResponse,
    cli,
    function_tool,
    get_job_context,
    llm,
)
from livekit.plugins import deepgram, openai, silero, smallestai

import knowledge
from config import AGENT_NAME, settings

logger = logging.getLogger("niyamic.agent")

# Data-channel topic the call screen listens on to show tool activity.
TOOL_TOPIC = "agent.tool"

# When a lookup resolves to a single value in one of these columns, the call screen
# shows it as the caller's name.
CUSTOMER_NAME_COLUMNS = {"customer name", "customer", "name", "full name", "client name"}

DEFAULT_GREETING = "Thanks for calling. How can I help you today?"

CALL_RULES = """\
You are on a live voice call with a customer.
- Keep each reply to one to three short sentences. Speak naturally. Never use lists, markdown, emojis or links.
- Say a short line such as "Let me check that for you." only when you are about to call a lookup tool. If \
the answer is already in this conversation, answer directly.

Answering from customer data:
- For any question about a specific order, payment, balance, delivery or account, call \
lookup_customer_records with the identifier the caller gave before answering. If they have not given one, \
ask for their order number.
- For questions about policies, refunds, returns, delivery times or other procedures, call \
search_knowledge_base.
- Only state facts that appear in tool results. Never invent or estimate a status, amount, date or count. \
If the results do not contain the answer, say you don't have that information.
- If no record matches, say so and ask the caller to confirm the number. Never substitute a different record.
- If a lookup returns several customers or orders, confirm which one the caller means before sharing details.
- When asked about an order's status, give the status, the number of successful payments, and any \
outstanding balance, for example: "Your order is processing. You've made two payments, and 1,500 rupees \
remains outstanding."
- Describe payment history from the payment rows returned, including each payment's status.
- Say amounts with the currency shown in the data, for example "1,500 rupees" for 1500 in a column marked ₹. \
Read order numbers digit by digit. Say dates naturally, for example "November 10" for 2026-11-10."""

# Identity prefix of a human specialist joining from the Supervisor page (see api.py).
SPECIALIST_PREFIX = "specialist-"
# Text-stream topic that carries the conversation so far to a specialist when they join.
HANDOFF_TOPIC = "agent.handoff"
# How long the caller waits for a specialist before the agent offers a call back instead.
HANDOFF_TIMEOUT_SEC = 90

DEFAULT_TEAM = "a specialist"
DEFAULT_HANDOFF_MESSAGE = (
    "I'll bring in a specialist who can help with that. You won't need to repeat anything you've told me."
)


def build_escalation_rules(escalation: dict[str, Any]) -> str:
    """Turn the agent editor's escalation settings into instructions for the conditions that need judgment.

    Trigger keywords and the turn limit are checked in code (see SupportAgent.on_user_turn_completed).
    """
    team = escalation.get("transferTeam") or DEFAULT_TEAM
    threshold = round(float(escalation.get("confidenceThreshold") or 0.65) * 100)
    high_risk = (
        "the caller mentions legal action, fraud or a charge they did not make, a chargeback, or a safety concern"
    )
    transfer_now: list[str] = []
    offer: list[str] = []
    if escalation.get("onCustomerRequest", True):
        transfer_now.append("the caller asks to speak to a person, a human agent, a supervisor or a manager")
    if escalation.get("autoTransferHighRisk", True):
        transfer_now.append(high_risk)
    else:
        offer.append(high_risk)
    if escalation.get("onPolicyException", True):
        offer.append(
            "the caller needs an exception to a policy, or something you cannot do yourself, such as approving a "
            "refund, cancelling an order or changing an account"
        )
    if escalation.get("onNegativeSentiment", True):
        offer.append("the caller is angry, upset or frustrated, or keeps repeating a complaint")
    offer.append(
        f"you are less than {threshold}% sure you can resolve the caller's request correctly, for example "
        "because the data you looked up does not answer it"
    )

    lines = [f"Transferring to a human ({team}):"]
    if transfer_now:
        lines.append("- Call transfer_to_human right away, without asking, when " + "; or when ".join(transfer_now) + ".")
    lines.append(
        "- Offer to connect the caller with a specialist when " + "; or when ".join(offer) + ". "
        "Call transfer_to_human only if they agree."
    )
    if not escalation.get("onCustomerRequest", True):
        lines.append(
            "- If the caller asks for a person in any other situation, say a specialist will call them back, "
            "and keep helping."
        )
    lines.append(
        "- Call transfer_to_human without saying anything first, then say what its result tells you to say. "
        "Until the specialist joins, keep helping with anything else the caller asks."
    )
    return "\n".join(lines)


def build_instructions(profile: dict[str, Any]) -> str:
    name = profile.get("name") or "the support agent"
    role = profile.get("role") or "customer support agent"
    parts = [profile.get("systemPrompt") or f"You are {name}, a {role}."]
    if profile.get("persona"):
        parts.append(f"Persona: {profile['persona']}")
    if profile.get("tone"):
        parts.append(f"Tone: {profile['tone']}.")
    parts.append(CALL_RULES)
    parts.append(build_escalation_rules(profile.get("escalation") or {}))
    return "\n\n".join(parts)


def parse_profile(metadata: str | None) -> dict[str, Any]:
    if not metadata:
        return {}
    try:
        profile = json.loads(metadata)
    except json.JSONDecodeError:
        logger.warning("ignoring malformed job metadata")
        return {}
    return profile if isinstance(profile, dict) else {}


def format_records(reference: str, records: list[dict[str, Any]]) -> str:
    if not records:
        return (
            f"No records found for '{reference}'. Tell the caller you could not find it and ask them to "
            "confirm the reference. Do not guess."
        )
    partial = any(record["match"] == "partial" for record in records)
    lines = [f"{len(records)} record(s) found for '{reference}'. Use only these values."]
    if partial:
        lines.append("These are partial name matches: confirm the caller's identity before sharing details.")
    for record in records:
        fields = "; ".join(f"{key}: {value}" for key, value in record["fields"].items())
        lines.append(f"- [{record['source']} / {record['sheet']}, row {record['row']}] {fields}")
    return "\n".join(lines)


def format_documents(question: str, passages: list[dict[str, Any]]) -> str:
    if not passages:
        return (
            f"No document passages matched '{question}'. Tell the caller you don't have that information."
        )
    lines = ["Relevant passages from uploaded documents. Answer only from these."]
    for passage in passages:
        lines.append(f"- [{passage['source']}, page {passage['page']}] {passage['text']}")
    return "\n".join(lines)


async def publish_tool_event(event: dict[str, Any]) -> None:
    try:
        room = get_job_context().room
        await room.local_participant.publish_data(
            json.dumps(event, ensure_ascii=False), topic=TOOL_TOPIC, reliable=True
        )
    except Exception:  # noqa: BLE001 - UI telemetry must never break the call
        logger.debug("could not publish tool event", exc_info=True)


async def set_call_attributes(attributes: dict[str, str]) -> None:
    """Expose call details (agent, identified caller) to /api/calls via participant attributes."""
    try:
        await get_job_context().room.local_participant.set_attributes(attributes)
    except Exception:  # noqa: BLE001 - dashboard metadata must never break the call
        logger.debug("could not set participant attributes", exc_info=True)


def is_specialist(participant: rtc.RemoteParticipant) -> bool:
    return participant.identity.startswith(SPECIALIST_PREFIX)


class Handoff:
    """Hands the call to a human specialist who joins the same room, and takes it back when they leave.

    The state is published as the agent's participant attributes, so the caller's screen and the
    Supervisor queue (through /api/calls) both follow it. `niyamic.handoff` is "requested",
    "accepted", "missed" (no one joined in time) or empty.
    """

    def __init__(self, session: AgentSession, room: rtc.Room, escalation: dict[str, Any]) -> None:
        self.session = session
        self.room = room
        self.team = escalation.get("transferTeam") or DEFAULT_TEAM
        self.message = escalation.get("message") or DEFAULT_HANDOFF_MESSAGE
        self.keywords = [k.strip().lower() for k in escalation.get("keywords") or [] if k.strip()]
        self.status = ""
        self.reason = ""
        self.summary = ""
        # What the specialist sees when they join: the conversation with the agent so far.
        self.transcript: list[dict[str, str]] = []
        self._timeout: asyncio.Task[None] | None = None
        self._tasks: set[asyncio.Task[None]] = set()
        session.on("conversation_item_added", self._on_item_added)
        room.on("participant_connected", self._on_participant_connected)
        room.on("participant_disconnected", self._on_participant_disconnected)

    def matching_keyword(self, text: str) -> str | None:
        lowered = text.lower()
        return next(
            (k for k in self.keywords if re.search(rf"(?<!\w){re.escape(k)}(?!\w)", lowered)),
            None,
        )

    def record(self, role: str, text: str) -> None:
        if text.strip():
            self.transcript.append({"role": role, "text": text.strip()})

    async def request(self, reason: str, summary: str = "") -> bool:
        """Ask for a specialist. Returns False when one is already requested or on the call."""
        if self.status in ("requested", "accepted"):
            return False
        self.status = "requested"
        self.reason = reason.strip()[:200] or "Transfer requested"
        self.summary = summary.strip()[:500]
        logger.info("handoff requested: %s", self.reason)
        await set_call_attributes(
            {
                "niyamic.handoff": "requested",
                "niyamic.handoff_reason": self.reason,
                "niyamic.handoff_summary": self.summary,
                "niyamic.handoff_team": self.team,
            }
        )
        self._timeout = asyncio.create_task(self._expire())
        return True

    async def _expire(self) -> None:
        await asyncio.sleep(HANDOFF_TIMEOUT_SEC)
        if self.status != "requested":
            return
        self.status = "missed"
        logger.info("no specialist joined within %ss", HANDOFF_TIMEOUT_SEC)
        await set_call_attributes({"niyamic.handoff": "missed"})
        try:
            self.session.generate_reply(
                instructions=(
                    f"No one from {self.team} was free to join the call. Apologise briefly, tell the caller a "
                    "specialist will call them back, and offer to keep helping."
                )
            )
        except RuntimeError:
            pass  # the call is ending

    def _spawn(self, coro: Any) -> None:
        task = asyncio.create_task(coro)
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)

    def _on_item_added(self, event: ConversationItemAddedEvent) -> None:
        item = event.item
        if isinstance(item, llm.ChatMessage) and item.role in ("user", "assistant"):
            self.record("customer" if item.role == "user" else "ai", item.text_content or "")

    def _on_participant_connected(self, participant: rtc.RemoteParticipant) -> None:
        if is_specialist(participant):
            self._spawn(self._specialist_joined(participant))

    def _on_participant_disconnected(self, participant: rtc.RemoteParticipant) -> None:
        if is_specialist(participant) and not any(
            is_specialist(p) for p in self.room.remote_participants.values()
        ):
            self._spawn(self._specialist_left())

    async def _specialist_joined(self, participant: rtc.RemoteParticipant) -> None:
        if self._timeout:
            self._timeout.cancel()
        if self.status != "accepted":
            self.status = "accepted"
            # Go quiet: stop speaking, and stop listening so the agent can't answer over the specialist.
            try:
                await self.session.interrupt(force=True)
            except Exception:  # noqa: BLE001 - nothing to interrupt
                pass
            self.session.input.set_audio_enabled(False)
            self.session.output.set_audio_enabled(False)
            self.session.output.set_transcription_enabled(False)
        self.reason = self.reason or "Specialist joined the call"
        logger.info("specialist %s joined", participant.identity)
        await set_call_attributes(
            {
                "niyamic.handoff": "accepted",
                "niyamic.handoff_reason": self.reason,
                "niyamic.handoff_team": self.team,
                "niyamic.specialist": participant.name or "Specialist",
            }
        )
        context = {"reason": self.reason, "summary": self.summary, "team": self.team, "turns": self.transcript}
        try:
            await self.room.local_participant.send_text(
                json.dumps(context, ensure_ascii=False),
                topic=HANDOFF_TOPIC,
                destination_identities=[participant.identity],
                compress=False,
            )
        except Exception:  # noqa: BLE001 - the specialist can still talk to the caller
            logger.warning("could not send the conversation to the specialist", exc_info=True)

    async def _specialist_left(self) -> None:
        if self.status != "accepted":
            return
        self.status = ""
        self.reason = ""
        self.summary = ""
        logger.info("specialist left; agent resumes")
        await set_call_attributes(
            {
                "niyamic.handoff": "",
                "niyamic.handoff_reason": "",
                "niyamic.handoff_summary": "",
                "niyamic.handoff_team": "",
                "niyamic.specialist": "",
            }
        )
        if not any(p.identity.startswith("customer-") for p in self.room.remote_participants.values()):
            return  # the caller hung up too; the call is closing
        self.session.input.set_audio_enabled(True)
        self.session.output.set_audio_enabled(True)
        self.session.output.set_transcription_enabled(True)
        try:
            self.session.generate_reply(
                instructions=(
                    "A specialist has just handed the call back to you. You did not hear their conversation. "
                    "Briefly tell the caller you're back, and ask if there is anything else you can help with."
                )
            )
        except RuntimeError:
            pass  # the call is ending


class SupportAgent(Agent):
    def __init__(self, profile: dict[str, Any], handoff: Handoff) -> None:
        super().__init__(instructions=build_instructions(profile))
        self._handoff = handoff
        max_turns = (profile.get("escalation") or {}).get("maxTurns")
        self._max_turns = max_turns if isinstance(max_turns, int) and max_turns > 0 else 0
        self._caller_turns = 0

    async def on_user_turn_completed(self, turn_ctx: llm.ChatContext, new_message: llm.ChatMessage) -> None:
        """Apply the escalation rules that don't need the model's judgment: trigger keywords and the turn limit."""
        self._caller_turns += 1
        text = new_message.text_content or ""
        keyword = self._handoff.matching_keyword(text)
        if keyword and await self._handoff.request(f'Caller said "{keyword}"', f'Caller said: "{text}"'):
            # Answer with the configured handoff message instead of a model reply, and keep the
            # caller's words in the conversation the model and the specialist see.
            chat_ctx = self.chat_ctx.copy()
            chat_ctx.items.append(new_message)
            await self.update_chat_ctx(chat_ctx)
            self._handoff.record("customer", text)
            self.session.say(self._handoff.message)
            raise StopResponse()
        if self._max_turns and self._caller_turns == self._max_turns and not self._handoff.status:
            turn_ctx.add_message(
                role="system",
                content=(
                    f"The caller has now spoken {self._caller_turns} times. If their issue is still not "
                    "resolved, offer to connect them with a specialist."
                ),
            )

    @function_tool()
    async def transfer_to_human(self, context: RunContext, reason: str, summary: str) -> str:
        """Transfer the call to a human specialist, who joins this call and sees the conversation so far.

        Args:
            reason: Why the call needs a person, in a few words, for example "Caller asked for a manager" or "Refund needs approval".
            summary: One or two sentences for the specialist: who the caller is, what they need, and what you have already checked.
        """
        if self._handoff.status == "accepted":
            return "A specialist is already on the call. Say nothing."
        if not await self._handoff.request(reason, summary):
            return "A specialist is already on the way. Tell the caller they will join shortly, and keep helping."
        return f'Transfer requested. Say this to the caller now, word for word: "{self._handoff.message}"'

    @function_tool()
    async def lookup_customer_records(self, context: RunContext, reference: str) -> str:
        """Look up orders, payments, balances and customer details in the uploaded spreadsheets.

        Call this before answering any question about a specific order, payment, balance, delivery or account.

        Args:
            reference: The identifier the caller gave: an order number, customer ID, invoice number, phone number, email address or full name. Use digits for spoken numbers, for example "4821".
        """
        event_id = uuid.uuid4().hex[:8]
        await publish_tool_event(
            {"id": event_id, "label": f"Record lookup · {reference}", "status": "running"}
        )
        started = time.monotonic()
        records = await asyncio.to_thread(knowledge.lookup_records, reference)
        sheets = sorted({record["sheet"] for record in records})
        customers = {
            str(value)
            for record in records
            for key, value in record["fields"].items()
            if key.strip().lower() in CUSTOMER_NAME_COLUMNS
        }
        customer = customers.pop() if len(customers) == 1 else None
        await publish_tool_event(
            {
                "id": event_id,
                "label": f"Record lookup · {reference}",
                "status": "done",
                "result": f"{len(records)} record(s) · {', '.join(sheets)}" if records else "No match",
                "customer": customer,
                "ms": round((time.monotonic() - started) * 1000),
            }
        )
        if customer:
            await set_call_attributes({"niyamic.customer": customer})
        logger.info("lookup %r -> %d records", reference, len(records))
        return format_records(reference, records)

    @function_tool()
    async def search_knowledge_base(self, context: RunContext, question: str) -> str:
        """Search uploaded PDF documents such as policies, terms and FAQs.

        Args:
            question: A short search query for the caller's question, for example "refund time for card payments".
        """
        event_id = uuid.uuid4().hex[:8]
        await publish_tool_event(
            {"id": event_id, "label": f"Document search · {question}", "status": "running"}
        )
        started = time.monotonic()
        passages = await asyncio.to_thread(knowledge.search_documents, question)
        await publish_tool_event(
            {
                "id": event_id,
                "label": f"Document search · {question}",
                "status": "done",
                "result": (
                    "; ".join(dict.fromkeys(f"{p['source']} p.{p['page']}" for p in passages))
                    if passages
                    else "No match"
                ),
                "ms": round((time.monotonic() - started) * 1000),
            }
        )
        logger.info("document search %r -> %d passages", question, len(passages))
        return format_documents(question, passages)


def build_llm() -> openai.LLM:
    options: dict[str, Any] = {}
    if settings.llm_temperature is not None:
        options["temperature"] = settings.llm_temperature
    if settings.uses_openai_v1:
        return openai.LLM(
            model=settings.openai_model,
            base_url=settings.openai_base_url,
            api_key=settings.openai_api_key,
            **options,
        )
    return openai.LLM.with_azure(
        azure_deployment=settings.azure_openai_deployment,
        azure_endpoint=settings.azure_openai_endpoint,
        api_key=settings.azure_openai_api_key,
        api_version=settings.azure_openai_api_version,
        **options,
    )


def prewarm(proc: JobProcess) -> None:
    knowledge.init_storage()
    proc.userdata["vad"] = silero.VAD.load()


server = AgentServer(setup_fnc=prewarm)


@server.rtc_session(agent_name=AGENT_NAME)
async def entrypoint(ctx: JobContext) -> None:
    profile = parse_profile(ctx.job.metadata)
    logger.info("starting call in %s as %s", ctx.room.name, profile.get("name") or "default agent")

    session = AgentSession(
        stt=deepgram.STT(
            model=settings.deepgram_model,
            language=settings.deepgram_language,
            smart_format=True,
            api_key=settings.deepgram_api_key,
        ),
        llm=build_llm(),
        tts=smallestai.TTS(
            api_key=settings.smallest_api_key,
            model=settings.smallest_model,
            voice_id=settings.smallest_voice_id or None,
            language=settings.smallest_language,
        ),
        vad=ctx.proc.userdata["vad"],
        preemptive_generation=True,
    )

    handoff = Handoff(session, ctx.room, profile.get("escalation") or {})
    await session.start(agent=SupportAgent(profile, handoff), room=ctx.room)
    await ctx.connect()
    await set_call_attributes(
        {
            "niyamic.agent_id": str(profile.get("id") or ""),
            "niyamic.agent_name": str(profile.get("name") or "Agent"),
        }
    )
    await session.say(profile.get("greeting") or DEFAULT_GREETING, allow_interruptions=True)


if __name__ == "__main__":
    cli.run_app(server)
