Earned

An AI task companion that has to earn its autonomy.

Most productivity apps put the stakes on you — streaks, virtual pets, guilt. Earned flips it: the AI companion starts with limited capabilities and has to earn the right to do more for you — proposing real calendar time, drafting and sending real emails, eventually acting fully on its own — by you proving reliable. Miss enough deadlines, and it explains exactly what it's pulling back, and why.

Built for Vibe2Ship — Problem Statement 1: The Last-Minute Life Saver.

Live demo: https://ais-dev-2mumhftkk6tltrg2lqii6m-481520205416.asia-southeast1.run.app/


What it does


5-tier Trust System — Observer → Planner → Scheduler → Drafter → Autonomous. Each tier unlocks a real capability. Climbing takes sustained reliability (thresholds grow at each level); losing trust is fast — a couple of missed deadlines drops a full tier.
Real Google Calendar integration — the AI proposes time blocks based on your actual schedule, you approve (or edit the time first), and a real event gets created.
Real Gmail integration — scans your actual inbox for actionable tasks (with spam/OTP filtering), drafts replies, and can send them once you've earned that trust.
An agentic reasoning loop — Observe → Assess → Decide → Act → Report. The AI can genuinely decide nothing needs doing — it doesn't manufacture busywork to look active.
Honest fallback behavior — when Gemini's quota is hit, the app degrades to rule-based logic instead of breaking, and clearly marks that output as "Offline Fallback" rather than pretending it's live AI reasoning.
Google Search grounding — for time-sensitive tasks (passport renewals, visa processing, etc.), the AI grounds its suggestions in real search results instead of guessing.


Tech stack


Frontend: React 19, Tailwind CSS v4, Lucide Icons, Motion
Backend: Node.js, Express
AI: Gemini API (gemini-3.5-flash) via @google/genai
Auth: Firebase Authentication (Google OAuth)
Hosting: Google Cloud Run


Run locally

bashnpm install
# Add your Gemini API key to .env.local (see .env.example)
npm run dev

Known limitations


Task/trust state persists in browser state, not a server-side database — clearing browser data resets the session.
Google OAuth tokens are cached in memory; a page reload requires reconnecting.
The agentic loop runs on-demand rather than on a backend schedule, since this runs as a single deployed service.
Google OAuth is currently in Testing mode (required for Calendar/Gmail's sensitive scopes). The app works fully for approved accounts; an unapproved Google account will see a Google-side "access blocked" screen. See the demo video for the full live Calendar/Gmail flow.



Built in Google AI Studio.
