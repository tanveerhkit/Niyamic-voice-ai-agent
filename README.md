# Niyamic Echo

**Voice agents that know when to hand off.**

Niyamic Echo is a demo-ready AI voice-agent platform built for a one-day walkthrough. It runs entirely in **mock mode** in the browser — no API keys, no microphone, no production data — while keeping the event model and screens that a real LiveKit + Azure pipeline will plug into.

The demo story: **Zara Ahmed** was charged twice for order **4821**. Ayesha (AI) verifies the duplicate, hits a policy edge, and hands the call to **Sara Malik** (human) with the full transcript. Sara resolves it and returns control to Ayesha to close the call.

---

## Quick start

Requirements: Node 20+ and npm.

```bash
npm install
npm run dev
```

Open **http://localhost:3000**. If port 3000 is already in use, Next.js prints the port it picked (for example `http://localhost:3001`) — use that URL.

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

## Five-minute demo runbook

Use **one browser profile with two tabs**. Niyamic Echo syncs live calls through `localStorage` + `BroadcastChannel`, so both tabs must share the same origin and profile. Incognito windows do not share state.

### Before you start

1. Open **Tab A**: `http://localhost:3000/supervisor`
2. Open **Tab B**: `http://localhost:3000/`
3. Put the tabs side by side, or use two browser windows. Keep the supervisor tab visible — the handoff is the moment to watch.

### 0:00–0:40 — Set the stage

On the dashboard:

- 1,284 conversations, **78.8% AI containment**, 14.5% human transfers, 3m 52s average handle time.
- Point out **Live now** on the right and the **Why calls escalate** breakdown.
- Say the line: *“The AI owns the call until it has a reason not to. The human joins the same room — not a new call.”*
- Everything is a deterministic mock dataset. No external services are called.

### 0:40–1:30 — Builder + sandbox

1. Open **Agents → Ayesha**.
2. Show the persona, English/Urdu/Hindi, tools, escalation policy, and the version history.
3. Click **Open sandbox** (or go to `/agents/ag_ayesha/sandbox`).
4. Click **Duplicate charge** under test scenarios. Show the agent response, the evaluation panel, confidence/risk telemetry, and the config snapshot.
5. Optional: **Run evaluation** to show the regression suite result.

### 1:30–3:30 — Live call + human handoff

In **Tab B**, click **Start live call** (top right). This opens `/call/SES-LIVE-...`.

- Let the AI greet the customer and start the order conversation for a few seconds.
- Open **Demo controls** (bottom right) → **Skip to escalation**.
  - This fast-forwards the scripted conversation to the policy edge: full 8-turn transcript, confidence **0.58**, timer around **1:06**.
  - It does **not** auto-accept, so the supervisor queue stays populated.

Switch to **Tab A** (`/supervisor`):

- **Waiting: 1** — Zara Ahmed, duplicate charge, high risk.
- Show the **AI context** panel (order, amount, confidence, tools) and the conversation transcript.
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
- Sessions & containment chart, top escalation reasons, language performance, sentiment, intent heatmap.
- Agent performance (Ayesha, Maya, Omar) and “Where AI needs help.”
- Failed & abandoned sessions link to real records.

Open **Integrations**:

- LiveKit, Azure Speech, Azure OpenAI are **queued** on credentials.
- CRM is **connected** through mock tools.
- SIP and webhooks are optional/not configured for the laptop demo.
- The runtime switches and “what replaces what” table make the real-audio path explicit.

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
| `/supervisor` | Human Desk | Live queue, AI context, transcript, accept/play/return controls |
| `/sessions` | Session Log | Searchable record of 1,284 sessions |
| `/sessions/[id]` | Post-Session | Summary, key moments, transcript, handoff log, recording, export |
| `/analytics` | Analytics | Containment, drivers, language, sentiment, intents, agents |
| `/call/[sessionId]` | Customer Call | Live call console, waveform, transcript, tools, handoff state |
| `/integrations` | Integrations | Provider status, runtime switches, real-audio path |

---

## How the mock runtime works

- **Start a call.** `StartCallButton` creates an ID like `SES-LIVE-MW3R2585` and routes to `/call/<id>?agent=ag_ayesha`.
- **Call engine.** `use-call-engine` advances `CALL_SCRIPT` / `CLOSING_SCRIPT` on a 110ms tick. It streams partial AI/customer turns, simulates STT/LLM/TTS latency, records tool calls, and emits a handoff event at the policy edge.
- **Live store.** `live-store` persists each live session under `relay.live.<id>` in `localStorage` and broadcasts changes on the `relay.live.v1` `BroadcastChannel`. Finished records are written to `relay.session.<id>`.
- **Mutations.** `live-actions` owns every state transition: manual transfer, demo fast-forward, accept handoff, human turn, customer turn, return to AI, finish. The real transport can call the same functions.
- **Seed data.** 1,284 deterministic sessions across Ayesha, Omar, Maya, and draft Zain, anchored to `2026-11-05T16:20:00.000Z`. Analytics are computed from those records with `src/lib/analytics.ts`.
- **No backend.** No auth, no database, no external calls. State is browser-local by design.

---

## Real-audio integration path

The mock is intentionally shaped like the real system. To make it real:

1. **LiveKit transport.** Provision LiveKit Cloud or self-host. Create a room per session and issue a customer token from the Next.js server. The supervisor joins the **same room**; there is no warm-transfer phone call.
2. **Agent worker.** Run a Python LiveKit agent worker on a long-lived host (Container Apps, Fly.io, Render, or a VM — **not Vercel**). The worker joins each room and runs the cascaded pipeline:
   - **Azure Speech STT** — continuous recognition, language ID for English/Urdu/Hindi, partial hypotheses for the live transcript.
   - **Azure OpenAI** — turn reasoning, tool selection, confidence, escalation policy.
   - **Azure Speech TTS** — neural voice in the detected language, with barge-in/VAD.
3. **Event mapping.** Emit worker events into the same `LiveSession` shape: partial text → `partial`; final text → `transcript`; tool start/end → `toolCalls`; policy edge → `handoff`; supervisor join → `status: human_active`.
4. **Session store.** Replace the `localStorage`/`BroadcastChannel` adapter with a server-side store + LiveKit data messages or WebSocket. The screens and event names stay the same.
5. **Human takeover.** The supervisor is a room participant. Server-side mute the AI agent, unmute the human, and keep the transcript in room metadata so the customer never repeats themselves. “Return to AI” reverses the mute and hands the closing script back to the agent.
6. **Recording.** Use LiveKit room-composite egress to S3/Azure Blob. Replace the mock `RecordingPlayer` with the egress URL.
7. **Telephony (optional).** Add a SIP trunk only when you need real phone numbers. The laptop demo is browser-only.

Environment variables for that path are listed in `.env.example`. The current app reads none of them.

---

## Stack

- **Next.js 16.4.5** (App Router, Turbopack)
- **React 19** + TypeScript
- **Tailwind CSS 4** + a small in-repo design system
- **lucide-react** icons
- **Recharts** for analytics (chart animations disabled for instant demo rendering)
- **Motion** for transitions
- **Zustand** for agent state
- Dark mission-control theme, acid-lime accent, Geist + serif italic display

---

## Scripts

```bash
npm run dev      # local dev server
npm run build    # production build + type check
npm run start    # serve the production build
npm run lint     # ESLint
```

---

## Known limitations

- **Mock only.** No microphone, STT, LLM, TTS, LiveKit room, SIP, CRM, or real recording.
- **Browser-local state.** Cross-tab sync works only in the same profile/origin. Clearing site data resets demo calls; seed sessions regenerate.
- **Analytics are seeded.** Live demo calls appear in the session log and summary, but the 1,284-session analytics baseline is deterministic and does not move with them.
- **Fixed narrative.** Live calls use the Zara/order 4821 duplicate-charge script. The builder and sandbox are ready for other intents, but the call engine is scripted.
- **No auth.** Do not deploy this with real customer data.

---

## Troubleshooting

- **Port 3000 is taken.** Use the port Next.js prints. Do not kill another project's dev server.
- **Supervisor queue is empty after starting a call.** Confirm both tabs are in the same browser profile and origin. Refresh the supervisor tab once; BroadcastChannel sync resumes.
- **Stale live calls.** End them from the supervisor, or clear the `relay.live.*` / `relay.session.*` keys.
- **`next build` fails with “not a valid Win32 application.”** Reinstall the native SWC package:
  ```bash
  npm install @next/swc-win32-x64-msvc@16.4.5 --save-optional --force
  ```
- **Screenshots or charts look blank in headless Chrome.** Chart animations are already disabled; use `--virtual-time-budget=5000` or wait for hydration before capturing.
