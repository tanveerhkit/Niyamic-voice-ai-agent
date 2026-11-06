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
import time
import uuid
from typing import Any

from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    JobContext,
    JobProcess,
    RunContext,
    cli,
    function_tool,
    get_job_context,
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
- Before calling a tool, say one short line such as "Let me check that for you."
- Human transfer is not available on this line. If the caller asks for a person, say a specialist will call \
them back, and keep helping.

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
- Describe payment history from the payment rows returned, including each payment's status.
- Say amounts with the currency shown in the data, for example "1,500 rupees" for 1500 in a column marked ₹. \
Read order numbers digit by digit."""


def build_instructions(profile: dict[str, Any]) -> str:
    name = profile.get("name") or "the support agent"
    role = profile.get("role") or "customer support agent"
    parts = [profile.get("systemPrompt") or f"You are {name}, a {role}."]
    if profile.get("persona"):
        parts.append(f"Persona: {profile['persona']}")
    if profile.get("tone"):
        parts.append(f"Tone: {profile['tone']}.")
    parts.append(CALL_RULES)
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


class SupportAgent(Agent):
    def __init__(self, profile: dict[str, Any]) -> None:
        super().__init__(instructions=build_instructions(profile))

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
        await publish_tool_event(
            {
                "id": event_id,
                "label": f"Record lookup · {reference}",
                "status": "done",
                "result": f"{len(records)} record(s) · {', '.join(sheets)}" if records else "No match",
                "customer": customers.pop() if len(customers) == 1 else None,
                "ms": round((time.monotonic() - started) * 1000),
            }
        )
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
        llm=openai.LLM.with_azure(
            azure_deployment=settings.azure_openai_deployment,
            azure_endpoint=settings.azure_openai_endpoint,
            api_key=settings.azure_openai_api_key,
            api_version=settings.azure_openai_api_version,
            temperature=0.3,
        ),
        tts=smallestai.TTS(
            api_key=settings.smallest_api_key,
            model=settings.smallest_model,
            voice_id=settings.smallest_voice_id or None,
            language=settings.smallest_language,
        ),
        vad=ctx.proc.userdata["vad"],
        preemptive_generation=True,
    )

    await session.start(agent=SupportAgent(profile), room=ctx.room)
    await ctx.connect()
    await session.say(profile.get("greeting") or DEFAULT_GREETING, allow_interruptions=True)


if __name__ == "__main__":
    cli.run_app(server)
