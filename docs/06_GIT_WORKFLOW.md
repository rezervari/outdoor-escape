# OUTDOOR ESCAPE — GIT WORKFLOW

## Environment

Primary development:
- Windows
- Git Bash
- GitHub
- Claude

Default branch:
main

Remote:
origin

## Standard workflow

Before work:

git status

Then inspect the relevant files and repository state.

After a logical change:

git diff

Run the relevant local tests.

Then:

git status

Stage only intended files:

git add <files>

Commit with a clear message:

git commit -m "Short description"

Verify:

git status

Push only after the working tree and commit are understood:

git push origin main

Then verify GitHub/deployment if applicable.

Notă (D-020): după ce va exista workflow-ul GitHub Actions de publicare, un push pe `main` poate publica automat o versiune nouă a site-ului public. Push-ul pe `main` trebuie tratat ca o publicare.

## Commit principles

Prefer small logical commits.

Good:
- "Add PWA shell"
- "Add game state model"
- "Add GPS module"
- "Add puzzle validation"

Avoid:
- "update everything"
- "fix stuff"

## Before destructive operations

Never run destructive Git commands without explicit human approval.

Examples:
- reset --hard
- clean -fd
- force push
- history rewrite
- deleting large project sections

## Claude rule

Claude should never assume that uncommitted work can be discarded.

Before replacing a file:
- inspect it;
- preserve existing work;
- explain why replacement is necessary.

## Release discipline

Before a production release:
1. git status
2. test locally
3. inspect diff
4. commit
5. push
6. verify deployment
7. test production URL

## Documentation commits

Architecture and decisions should be committed together with the relevant implementation change when they change because of that implementation.
