# Product Note

If Pulse were a real client engagement and I had two weeks, here is the call I would make.
This is a product decision, not an engineering one.

## What Pulse is for

Pulse is where a support team triages incoming customer feedback: see it, route it,
resolve it, and get a fast read on a thread. Its value is **throughput and not dropping
things** — an agent should be able to clear their inbox without items falling through the
cracks, and a manager should be able to see what is at risk. Everything should serve that.

## What I would build

1. **Trustworthy accounts (week 1).** Hashed passwords, a real login, roles that actually
   gate actions, and session handling that survives a logout. Nothing else matters if the
   auth story is not solid, and right now it is the weakest link.
2. **Assignment and SLA that work end to end (week 1).** Routing exists but is shallow.
   Make ownership, priority, and due dates drive a real "what's overdue / what's mine /
   what's urgent" view, with the metrics strip reflecting it. This is the daily-use core.
3. **Summaries that earn their cost (week 2).** The LLM summary is a gimmick today. Make it
   useful: summarize a whole customer's history and suggest a next action, with cost
   controls and a quality bar. This is the AI-native differentiator worth investing in.
4. **Reliability the user can feel (week 2).** Real-time updates instead of 45-second
   polling, consistent error handling, and the small trust signals (loading states,
   optimistic actions that reconcile) that make a tool feel solid under load.

## What I would cut

- **CSV export beyond a basic version.** It is a nice-to-have that rarely justifies its
  maintenance and security surface. Keep a simple, safe export; do not invest further.
- **The retro branding.** Replace it with something neutral and professional. It is a
  five-minute change that materially affects whether a client trusts the product.
- **Breadth of feature surface over depth.** The app already sprawls (notes, profiles,
  metrics, search, export). I would resist adding more and instead make the triage core
  genuinely good. A focused tool that does triage well beats a broad one that does
  everything adequately.

## The one bet

If I could only do one thing: make the **assignment + SLA + overdue** loop excellent. That
is the job the team does every day, it is where dropped items cost the client real money,
and it is the foundation the AI features should sit on top of, not the other way around.
