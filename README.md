# Niyamic Echo

**Voice agents that know when to hand off.**

Niyamic Echo is an AI voice-agent platform for customer support. Callers talk to an agent over **LiveKit**; **Deepgram** transcribes them, **Azure OpenAI** answers from the customer data you upload, and **Smallest AI** speaks the reply. Answers about orders, payments, and balances come from exact lookups in uploaded Excel sheets, and policy questions from uploaded PDFs, never from the model's guesses.

Without provider credentials the app falls back to a **scripted demo** of the same screens, including the human-handoff flow.

---

## Quick start

Requirements: Node 20+, npm, and Python 3.11+.

**1. Frontend**

```bash
npm install
npm run dev
```

Open **http://localhost:3000**. If port 3000 is already in use, Next.js prints the port it picked (for example `http://localhost:3001`) — use that URL.

**2. Backend** (data uploads, call tokens, and the voice agent)

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
```

Copy `.env.example` to `.env.local` in the repository root and fill in the LiveKit, Azure OpenAI, Deepgram, and Smallest AI keys. Azure OpenAI accepts either the v1 endpoint form (`OPENAI_BASE_URL` ending in `/openai/v1`, `OPENAI_API_KEY`, `OPENAI_MODEL`) or the classic form (`AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT`). Then run two processes from `backend/`:

```bash
uvicorn api:app --port 8000
```

```bash
python agent.py dev
```

`api.py` serves uploads and issues call tokens; `agent.py` is the LiveKit worker that joins each call. **Integrations** shows each provider's status, and **Start live call** switches from the scripted demo to real calls once all four are connected.

The Data page and lookups work with only `uvicorn` running — no provider keys needed.

Production check:

```bash
npm run build
npm run start
```

Lint:

```bash
npm run lint
```

---

## Real voice demo

1. Open **Data** and upload `backend/samples/orders.xlsx` and `backend/samples/support-policy.pdf` (or the client's own files). Wait for **Ready**.
2. In **Test lookup**, search `4821` to see exactly what the agent will retrieve: the order row and both payment rows.
3. Click **Start live call** → **Start call** and allow the microphone.
4. Say: *"Hi, I want to check my order status. My order number is 4821."*
5. The agent looks up the order (shown under **Data lookups**) and answers from the sheet: the order is processing, two payments were made, and ₹1,500 is outstanding.
6. Ask a policy question, for example *"How long do card refunds take?"*, to show a PDF answer.
7. Click **End call** → **View session** for the transcript and lookups.

**How retrieval works.** Spreadsheets are parsed into structured rows; every short cell is indexed under normalised keys, so `4821`, `order 4821`, `ORD-4821`, `CUST-1042`, a full name, or a phone number with or without `+91` all resolve by exact match. Related rows on other sheets (for example payments for the same order) come back together. PDFs are split into page-tagged passages and searched with SQLite full-text ranking. The agent is instructed to answer only from what these lookups return, and to say so when nothing matches.

**Updating data.** Use **Replace** on a file to upload a new version; it is re-indexed in place and the agent uses it on the next lookup. **Delete** removes it from the index immediately.

---

## Scripted demo (no credentials)

The scripted story: **Zara Ahmed** was charged twice for order **4821**. Ayesha (AI) verifies the duplicate, hits a policy edge, and hands the call to **Sara Malik** (human) with the full transcript. Sara resolves it and returns control to Ayesha to close the call.

Use **one browser profile with two tabs**. Niyamic Echo syncs live calls through `localStorage` + `BroadcastChannel`, so both tabs must share the same origin and profile. Incognito windows do not share state.

### Before you start

1. Open **Tab A**: `http://localhost:3000/supervisor`
2. Open **Tab B**: `http://localhost:3000/`
3. Put the tabs side by side, or use two browser windows. Keep the supervisor tab visible — the handoff is the moment to watch.

### 0:00–0:40 — Set the stage

On the dashboard:

- 1,284 conversations, **78.8% AI containment**, 14.5% human transfers, 3m 52s average handle time.
- Point out **Live calls** on the right and the **Escalation reasons** breakdown.
- Say the line: *“The AI owns the call until it has a reason not to. The human joins the same room — not a new call.”*
- Everything is a deterministic mock dataset. No external services are called.

### 0:40–1:30 — Builder + sandbox

1. Open **Agents → Ayesha**.
2. Show the persona, English/Urdu/Hindi, tools, escalation policy, and the version history.
3. Click **Test in sandbox** (or go to `/agents/ag_ayesha/sandbox`).
4. Click **Duplicate charge** under test scenarios. Show the agent response, the evaluation panel, confidence/risk telemetry, and the configuration panel.
5. Optional: **Run evaluation** to show the regression suite result.

### 1:30–3:30 — Live call + human handoff

In **Tab B**, click **Start live call** (top right). This opens `/call/SES-LIVE-...`.

- Let the AI greet the customer and start the order conversation for a few seconds.
- Open **Demo controls** (bottom right) → **Skip to escalation**.
  - This fast-forwards the scripted conversation to the policy edge: full 8-turn transcript, confidence **0.58**, timer around **1:06**.
  - It does **not** auto-accept, so the supervisor queue stays populated.

Switch to **Tab A** (`/supervisor`):

- **1 waiting** — Zara Ahmed, duplicate charge, high risk. The Supervisor nav item shows the same count.
- Show the **Summary** panel (order, amount, confidence, tools) and the conversation transcript.
- Click **Play handoff**. This accepts the call as Sara, sends the four scripted handoff turns, and returns control to Ayesha in one click (~8 seconds).
- Alternatively, demo the manual version: **Accept handoff** → **Play script** → **Return to AI**.

Switch back to **Tab B**:

- The transcript updated live with Sara's turns and the `SARA MALIK JOINED THE CALL` separator.
- The status returns to **AI-led**; Ayesha closes the loop.
- Click **End call** → **Call resolved** → **View session summary**.

Presenter note: “Play handoff” is the one-click path. “Transfer” on the call console is a manual escalation that preserves only the conversation so far — use **Skip to escalation** when you want the full story loaded instantly.

### 3:30–4:15 — Post-session

On `/sessions/SES-LIVE-...`:

- **AI summary**: intent, outcome, handled by, CSAT, and the four “what happened” bullets.
- **Key moments** are derived from the actual call: tool lookup, confidence drop, human join, resolution.
- **Transcript** with speaker, language, confidence, and handoff separators.
- **Handoff log** with reason, request time, accept time, and return time.
- **Recording player** is a mock room-composite waveform.
- **Export JSON** downloads the full record.

### 4:15–5:00 — Analytics + integrations

Open **Analytics**:

- Containment, transfer rate, average handle time, CSAT.
- Sessions & containment chart, escalation reasons, containment by language, sentiment, intents.
- Agent performance (Ayesha, Maya, Omar) and **Insights**.
- **Abandoned sessions** link to real records.

Open **Integrations**:

- LiveKit, Azure Speech, Azure OpenAI show **Setup required** (credentials).
- CRM is **connected** through mock tools.
- SIP and webhooks are optional/not configured for the laptop demo.
- **Configure** on each card lists the environment keys it needs.

### Reset between rehearsals

- In the call window: **Demo controls → Restart call**.
- To clear all live and completed demo calls, clear site data for `localhost` (or remove the `relay.live.*`, `relay.session.*`, and `relay.agents.v1` keys in DevTools → Application → Local Storage).
- Seed sessions regenerate deterministically, so analytics always return to the same numbers.

---

## Product map

| Route | Screen | What it shows |
| --- | --- | --- |
| `/` | Overview | KPIs, live calls, volume, escalation drivers, recent sessions |
| `/agents` | Agents | Active + draft agents with containment and transfer stats |
| `/agents/[id]` | Agent Builder | Persona, languages, tools, escalation policy, version history |
| `/agents/[id]/sandbox` | Sandbox | Scripted test chat, scenarios, evaluation, telemetry |
| `/data` | Data | Upload, replace, preview, and delete Excel/CSV/PDF files; test lookups |
| `/supervisor` | Human Desk | Live queue, call summary, transcript, accept/play/return controls |
| `/sessions` | Session Log | Searchable record of 1,284 sessions |
| `/sessions/[id]` | Post-Session | Summary, key moments, transcript, handoff log, recording, export |
| `/analytics` | Analytics | Containment, drivers, language, sentiment, intents, agents |
| `/call/[sessionId]` | Customer Call | Real LiveKit call (`?mode=live`) or the scripted console: waveform, transcript, data lookups |
| `/integrations` | Integrations | Live status of LiveKit, Azure OpenAI, Deepgram, Smallest AI, and uploaded data |

---

## Voice architecture

```
Browser (Next.js)                 backend/api.py (FastAPI)            LiveKit Cloud
  Data page ── upload ──────────▶ parse + index ──▶ SQLite
  Start call ── POST /api/token ▶ token + agent dispatch ─────────────▶ room
  mic / speaker ◀──────────────────── WebRTC audio ────────────────────▶ room
                                                                         │
                                  backend/agent.py (LiveKit worker) ◀────┘
                                  Deepgram STT → Azure OpenAI → Smallest AI TTS
                                        └─ tools: lookup_customer_records,
                                                  search_knowledge_base (SQLite)
```

- **`backend/knowledge.py`** — ingestion and retrieval. Excel/CSV become structured records with an exact-match index; PDFs become page-tagged passages in an FTS5 index. Re-uploads swap rows atomically.
- **`backend/api.py`** — `/api/datasets` (upload, replace, delete, preview), `/api/search` (the same retrieval the agent uses), `/api/health` (provider status), `/api/token` (LiveKit token that dispatches the agent with the persona from the agent builder).
- **`backend/agent.py`** — the voice agent. It looks up records before answering any order or account question, announces each lookup to the call screen on the `agent.tool` data topic, and publishes transcripts on LiveKit's standard transcription stream.
- **Secrets** stay in the backend. The browser only knows `NEXT_PUBLIC_VOICE_API_URL`.
- **Hosting.** The agent worker needs a long-lived host (a VM, Container Apps, Fly.io, Render) — not a serverless platform. `api.py` and `agent.py` must share the same `DATA_DIR`.

---

## How the scripted demo works

- **Start a call.** `StartCallButton` creates an ID like `SES-LIVE-MW3R2585` and routes to `/call/<id>?agent=ag_ayesha` (adding `&mode=live` when every provider is configured).
- **Call engine.** `use-call-engine` advances `CALL_SCRIPT` / `CLOSING_SCRIPT` on a 110ms tick. It streams partial AI/customer turns, simulates STT/LLM/TTS latency, records tool calls, and emits a handoff event at the policy edge.
- **Live store.** `live-store` persists each live session under `relay.live.<id>` in `localStorage` and broadcasts changes on the `relay.live.v1` `BroadcastChannel`. Finished records are written to `relay.session.<id>`.
- **Mutations.** `live-actions` owns every state transition: manual transfer, demo fast-forward, accept handoff, human turn, customer turn, return to AI, finish. The real transport can call the same functions.
- **Seed data.** 1,284 deterministic sessions across Ayesha, Omar, Maya, and draft Zain, anchored to `2026-11-05T16:20:00.000Z`. Analytics are computed from those records with `src/lib/analytics.ts`.
- **Browser-local state.** Scripted calls and the session log live in `localStorage`. Real calls are saved to the same log when they end.

---

## Stack

- **Next.js 16.4.5** (App Router, Turbopack)
- **React 19** + TypeScript
- **Tailwind CSS 4** + a small in-repo design system
- **lucide-react** icons
- **Recharts** for analytics (chart animations disabled for instant demo rendering)
- **Motion** for transitions
- **Zustand** for agent state
- **LiveKit** (`livekit-client`, `@livekit/components-react`) for real calls
- **Python backend:** FastAPI, LiveKit Agents 1.8 with the Deepgram, Azure OpenAI, Smallest AI, and Silero VAD plugins, pandas/openpyxl/xlrd for spreadsheets, pypdf for PDFs, SQLite (FTS5) for the index

---

## Scripts

```bash
npm run dev      # local dev server
npm run build    # production build + type check
npm run start    # serve the production build
npm run lint     # ESLint
```

From `backend/` with the virtualenv active:

```bash
uvicorn api:app --port 8000   # data + token API
python agent.py dev           # voice agent (development)
python agent.py start         # voice agent (production)
```

---

## Known limitations

- **Human handoff is scripted only.** Real calls stay with the AI agent; if a caller asks for a person, the agent offers a callback. Supervisor join over LiveKit is the next step.
- **No call recording or telephony.** Real calls are browser-to-agent; recording (LiveKit egress) and SIP phone numbers are not wired up.
- **Scanned PDFs** need OCR before upload; files without a text layer are rejected with a clear error.
- **Real-call summaries** list the lookups made during the call; they are not LLM-written.
- **Analytics are seeded.** The 1,284-session analytics baseline is deterministic and does not move with new calls.
- **No auth.** The API has no login. Do not expose it publicly with real customer data.

---

## Troubleshooting

- **Port 3000 is taken.** Use the port Next.js prints. Do not kill another project's dev server.
- **"Can't reach the voice backend."** Start `uvicorn api:app --port 8000` from `backend/`, or set `NEXT_PUBLIC_VOICE_API_URL` if it runs elsewhere.
- **LiveKit says "invalid token", or Integrations warns about the clock.** The machine running the backend has the wrong system time. The backend measures the offset from LiveKit and adjusts call tokens, but turn on automatic time sync so every service sees the right time.
- **The agent never joins a call.** `python agent.py dev` must be running with the same LiveKit credentials as the API. Its log shows `registered worker` when it is connected.
- **The agent can't find uploaded data.** Run `uvicorn` and `agent.py` from the same `backend/` folder (or the same `DATA_DIR`), and check the file shows **Ready** on the Data page.
- **Supervisor queue is empty after starting a call.** Confirm both tabs are in the same browser profile and origin. Refresh the supervisor tab once; BroadcastChannel sync resumes.
- **Stale live calls.** End them from the supervisor, or clear the `relay.live.*` / `relay.session.*` keys.
- **`next build` fails with “not a valid Win32 application.”** Reinstall the native SWC package:
  ```bash
  npm install @next/swc-win32-x64-msvc@16.4.5 --save-optional --force
  ```
- **Screenshots or charts look blank in headless Chrome.** Chart animations are already disabled; use `--virtual-time-budget=5000` or wait for hydration before capturing.
