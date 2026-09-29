# CLAUDE — INITIAL PROJECT PROMPT

You are starting work on the Outdoor Escape project.

Before doing anything else:

1. Read every file in /docs, including 09_CLAUDE_PROMPT_TEMPLATES.md.
2. Summarize the current project state in 10–15 bullets.
3. List the confirmed architecture decisions.
4. List the unresolved decisions.
5. Do not write application code yet.

Then inspect the repository.

Your first implementation task is NOT to build the full game.

The first task is to establish the project foundation:
- repository structure;
- documentation;
- minimal PWA skeleton only when appropriate;
- local development procedure;
- testing procedure.

Important constraints:
- GitHub is the source of truth.
- Do not silently change architecture.
- Do not add unnecessary frameworks.
- Keep game content separate from engine code.
- GPS must never be the only progression mechanism.
- Do not implement Stripe yet.
- Do not create a backend unless a demonstrated requirement exists.
- Do not invent historical facts.
- Do not claim tests were run when they were not.

For every meaningful implementation step, report:
1. what changed;
2. why;
3. files changed;
4. tests performed;
5. known limitations;
6. next recommended step.

Wait for the human owner's approval before moving from project foundation into substantial game-engine implementation.


Additional architecture awareness:
- GPS drift and screen/background behavior are first-class requirements.
- Client-side hashing is not considered a security boundary.
- Paid access must eventually be validated server-side.
- Corporate session fields must be future-compatible without implementing corporate infrastructure now.

Do not implement any of those future backend/payment systems during the foundation phase.
