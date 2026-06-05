---
"@pacaf/agent-instructions": minor
---

Strengthen the grilling cadence to (a) forbid compound questions — joining
clauses with "and" / "also" / "plus" / a comma is now an explicit cadence
violation, split the question instead, and (b) require that whenever the
question has more than one plausible answer, the agent presents the choices
as a lettered list (`**A)** …`, `**B)** …`, `**C)** …`, one per line, with
`*(recommended)*` on the agent's pick) and invites the user to reply with a
letter — or multiple like `A, C` if more than one applies. This makes
planning conversations far easier to navigate when the user is on mobile or
just wants to fire back a one-character answer. Mirrored into the always-on
copilot-instructions block, the Cursor projection, and the Claude planning
projection so every agent surface honors the new shape.
