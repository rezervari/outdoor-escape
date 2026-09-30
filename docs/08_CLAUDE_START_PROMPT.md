# CLAUDE — SESSION START PROMPT

You are starting a work session on the Outdoor Escape project.

`CLAUDE.md` (repository root) is the primary authority for working rules. This prompt only describes how to start; if anything here conflicts with `CLAUDE.md` or with `04_DECISIONS_LOG.md`, those take precedence — report the conflict instead of resolving it yourself.

Current stage: the project is past the foundation phase. Engine V2 (schema V2, game engine, V1 → V2 migration, location, events, progress) is implemented; M-003.1 (browser geolocation) and M-003.2 (map) are closed; the automated test suite (`npm test`) is green. Platform V1.1 (D-050 – D-067) is decided but not implemented. Always verify this against the repository — it may have moved on.

Before doing anything else:

1. Read `CLAUDE.md`, then the context documents in the order given in `README_CONTEXT_PACK.md`.
2. Run `git status`. Uncommitted changes that existed before the session belong to the owner — do not touch them (`CLAUDE.md` §1).
3. Identify the current milestone and its status (`README.md` → „Milestone-uri curente”, `04_DECISIONS_LOG.md`).
4. List the confirmed decisions relevant to the task and the unresolved (`PROPOSED`) ones.
5. Run `npm test` and note the result before changing anything.

How to work:

- Work incrementally: one small, logical change at a time; inspect the diff; test.
- Implementation is allowed within the current milestone and the confirmed decisions.
- Stop and present the problem and the options — without implementing — if the change would require altering the architecture, the adventure schema, the contracts between modules, Engine V2 behaviour, a documented decision, or acting on a `PROPOSED` decision (`CLAUDE.md` §3).

Constraints that remain in force:

- GitHub is the source of truth.
- Keep game content separate from engine code; the engine contains no adventure-, route- or operator-specific text, ids or logic (D-038, D-051).
- Do not invent historical facts (D-011).
- No Stripe, payments, backend, authentication, new dependencies, frameworks or build step without an explicit owner decision (D-018, D-019).
- Real adventure content stays out of the public repository (D-034); the only public exception is the demo `content/adventures/demo-gps-brasov.json` (D-068).
- GPS must never be the only progression mechanism (D-006).
- Git: follow `CLAUDE.md` §1 — no commit, push or history-changing commands unless the current task explicitly asks; explicit `git add <files>` only. A push to `main` publishes to GitHub Pages.
- Do not claim tests were run when they were not (`PASS` / `FAIL` / `NETESTAT`).

For every meaningful change, report:

1. what changed;
2. why;
3. files changed;
4. tests performed and their result;
5. known limitations;
6. next recommended step.

Architecture awareness (still valid):

- GPS drift and screen/background behaviour are first-class requirements.
- Client-side hashing is not a security boundary; paid access must eventually be validated server-side.
- Corporate session fields must stay future-compatible without implementing corporate infrastructure now.

Historical note: the original version of this prompt (foundation phase) forbade application code and made the repository foundation / PWA skeleton the first task. That phase is complete; those instructions no longer apply.
