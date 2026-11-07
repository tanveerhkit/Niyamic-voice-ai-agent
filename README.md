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

The site opens on a sign-in page that asks for a login ID only:

- **`supervisor`** opens the whole workspace. The **Start live call** button is shown but switched off, because live calls are for customers.
- **`customer`** opens a single page with one **Start live call** button that connects to support.

Each tab signs in separately, so a supervisor and a customer can be open side by side in one browser.

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

`api.py` serves uploads, issues call tokens and stores finished calls; `agent.py` is the LiveKit worker that joins each call. **Integrations** shows each provider's status, and the customer's **Start live call** button works once all four are connected.

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

1. Sign in as `supervisor`. Open **Data** and upload `backend/samples/orders.xlsx` and `backend/samples/support-policy.pdf` (or the client's own files). Wait for **Ready**.
2. In **Test lookup**, search `4821` to see exactly what the agent will retrieve: the order row and both payment rows.
3. In a second tab, sign in as `customer`, click **Start live call** and allow the microphone.
4. Say: *"Hi, I want to check my order status. My order number is 4821."*
5. The agent looks up the order and answers from the sheet: the order is processing, two payments were made, and ₹1,500 is outstanding.
6. Ask a policy question, for example *"How long do card refunds take?"*, to show a PDF answer.
7. In the supervisor tab, open **Supervisor**, then say *"I want to talk to a human."* The agent plays the handoff message, and the call appears in the Supervisor queue as **Waiting**, with the reason and a summary.
8. Click **Accept handoff**. You join the same call with your microphone and see the conversation so far, and the agent goes silent. **Return to Ayesha** hands the call back to the agent; **End call** hangs up for everyone.
9. End the call. It appears on the supervisor's **Home** and **Sessions** pages with the transcript, lookups, and handoff log.

**When the agent hands off.** The rules come from the agent's **Escalation** tab and are sent with each call:

- **Trigger keywords** transfer at once whenever the caller says one. Ayesha's defaults include *agent* and *cancel*, so remove any that are too broad.
- **Customer asks for a human** and, with **Auto-transfer on high risk**, legal threats, fraud, chargebacks and safety concerns also transfer at once.
- **Policy exception**, **negative sentiment** and the **confidence threshold** make the agent offer a specialist. It transfers only if the caller agrees.
- **Max turns**: on that caller turn, if the issue isn't resolved, the agent offers a specialist.

If no one accepts within 90 seconds, the agent tells the caller a specialist will call back and keeps helping. The specialist's part of the call isn't transcribed.

**How retrieval works.** Spreadsheets are parsed into structured rows; every short cell is indexed under normalised keys, so `4821`, `order 4821`, `ORD-4821`, `CUST-1042`, a full name, or a phone number with or without `+91` all resolve by exact match. Related rows on other sheets (for example payments for the same order) come back together. PDFs are split into page-tagged passages and searched with SQLite full-text ranking. The agent is instructed to answer only from what these lookups return, and to say so when nothing matches.

**Updating data.** Use **Replace** on a file to upload a new version; it is re-indexed in place and the agent uses it on the next lookup. **Delete** removes it from the index immediately.

---

## Deploying

The website (Netlify or Render) only serves the screens. Real calls, the Data page and the handoff need the backend: `api.py` and the voice agent `agent.py`, which run together in one always-on Render service defined in [`render.yaml`](render.yaml).

1. In Render, choose **New → Blueprint** and pick this repository. Render reads `render.yaml` and asks for each secret: the LiveKit, Azure OpenAI v1 (`OPENAI_*`), Deepgram and Smallest AI keys, plus `CORS_ORIGINS`, your website addresses separated by commas with no trailing slash (for example `https://your-site.netlify.app,https://your-site.onrender.com`). For classic Azure OpenAI, add `AZURE_OPENAI_*` in the dashboard instead.
2. When it's live, open `https://<service>.onrender.com/api/health` and check that `voice.ready` is `true`.
3. On each website, set `NEXT_PUBLIC_VOICE_API_URL=https://<service>.onrender.com` and redeploy. The value is built into the site, so on Netlify use **Clear cache and deploy site**.
4. Upload your spreadsheets and PDFs again on the hosted **Data** page; local `backend/storage` isn't in Git.
5. Stop any `agent.py dev` worker on your own machine that uses the same LiveKit project, or LiveKit will send some calls to it.

The service uses a paid instance (1 CPU, 2 GB) and a 1 GB disk at `/var/data`: the free plan sleeps when idle, which stops the agent, and uploads on a service without a disk are lost on every deploy. The API has no sign-in, so anyone who has the service URL can use it.

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

- Home counts real calls only, so it reads zero until a customer has called. The seeded story (1,284 conversations, **78.8% AI containment**, 14.5% human transfers, 3m 52s average handle time) is on **Analytics**.
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

In **Tab B**, open **Supervisor** → **Start test call**. This opens `/call/SES-LIVE-...` in a new tab; sign in there as `supervisor` too.

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
| `/login` | Sign in | Login ID only: `supervisor` or `customer` |
| `/support` | Customer support | The customer's only page: one **Start live call** button, then the call |
| `/` | Home | Real calls only: KPIs against the prior 30 days, live calls, volume, escalation drivers, recent calls |
| `/agents` | Agents | Active + draft agents with containment and transfer stats |
| `/agents/[id]` | Agent Builder | Persona, languages, tools, escalation policy, version history |
| `/agents/[id]/sandbox` | Sandbox | Scripted test chat, scenarios, evaluation, telemetry |
| `/data` | Data | Upload, replace, preview, and delete Excel/CSV/PDF files; test lookups |
| `/supervisor` | Human Desk | Live queue, call summary, transcript, accept/play/return controls |
| `/sessions` | Session Log | Searchable record of 1,284 sessions |
| `/sessions/[id]` | Post-Session | Summary, key moments, transcript, handoff log, recording, export |
| `/analytics` | Analytics | Containment, drivers, language, sentiment, intents, agents |
| `/call/[sessionId]` | Test call | Scripted call console for supervisors: waveform, transcript, demo controls |
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
- **`backend/api.py`** — `/api/datasets` (upload, replace, delete, preview), `/api/search` (the same retrieval the agent uses), `/api/health` (provider status), `/api/token` (LiveKit token that dispatches the agent with the persona from the agent builder), `/api/sessions` (finished calls, stored in `DATA_DIR/history.db`, which feed Home and the session log on every device).
- **`backend/agent.py`** — the voice agent. It looks up records before answering any order or account question, announces each lookup to the call screen on the `agent.tool` data topic, and publishes transcripts on LiveKit's standard transcription stream.
- **Secrets** stay in the backend. The browser only knows `NEXT_PUBLIC_VOICE_API_URL`.
- **Hosting.** The agent worker needs a long-lived host (a VM, Container Apps, Fly.io, Render) — not a serverless platform. `api.py` and `agent.py` must share the same `DATA_DIR`, so `backend/start.sh` runs both in one service (see [Deploying](#deploying)).

---

## How the scripted demo works

- **Start a call.** **Supervisor → Start test call** creates an ID like `SES-LIVE-MW3R2585` and opens `/call/<id>?agent=ag_ayesha`. Real calls start from the customer's `/support` page instead.
- **Call engine.** `use-call-engine` advances `CALL_SCRIPT` / `CLOSING_SCRIPT` on a 110ms tick. It streams partial AI/customer turns, simulates STT/LLM/TTS latency, records tool calls, and emits a handoff event at the policy edge.
- **Live store.** `live-store` persists each live session under `relay.live.<id>` in `localStorage` and broadcasts changes on the `relay.live.v1` `BroadcastChannel`. Finished records are written to `relay.session.<id>`.
- **Mutations.** `live-actions` owns every state transition: manual transfer, demo fast-forward, accept handoff, human turn, customer turn, return to AI, finish. The real transport can call the same functions.
- **Seed data.** 1,284 deterministic sessions across Ayesha, Omar, Maya, and draft Zain, anchored to `2026-11-05T16:20:00.000Z`. Analytics are computed from those records with `src/lib/analytics.ts`.
- **Browser-local state.** Scripted calls and the session log live in `localStorage`. Real calls are saved there and to the backend's call history when they end. Home counts only real calls.

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
- **Sign-in is a role switch, not security.** Login IDs have no password and are checked in the browser, and the API has no login. Do not expose it publicly with real customer data.

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
