# 3DVerse development workflow

Use the project-local Superpowers skills for work in this repository.
Start by reading `.agents/skills/using-superpowers/SKILL.md`, including its
Codex tool reference, then load the skills relevant to the current task.
These are standalone repository skills; the native Superpowers plugin and
its session hooks are not installed by this setup.

## Apply the relevant workflow

- New features or substantial changes: `brainstorming`, then `writing-plans`
  and `executing-plans` as appropriate to the scope.
- Bugs: `systematic-debugging`; establish the cause before changing code.
- Behaviour changes: `test-driven-development` with meaningful regression
  coverage. Apply this to new work; do not rewrite committed work merely to
  recreate a development sequence retroactively.
- Reviews: `requesting-code-review` and `receiving-code-review`.
- Completion claims: `verification-before-completion`; report actual commands,
  results and remaining limits.
- Use worktree, branch-finishing and subagent skills when the task needs them
  and the current environment and higher-priority instructions allow them.

User and developer instructions take precedence over skill guidance. Reuse
decisions and authorization already present in the conversation; ask only for
missing information or approval that is actually necessary. Preserve unrelated
working-tree changes and never silently discard them.

## Project conventions and verification

- Frontend work must also follow `frontend/AGENTS.md` and `frontend/design.md`.
  Hallmark supplies visual-design guidance when invoked; Superpowers supplies
  the development process. Preserve the existing 3DVerse identity and wiring.
- Frontend checks, from `frontend/`: `npm run build` and ESLint on changed files.
  In Windows PowerShell, use `npm.cmd` if the npm script shim is restricted.
- Storefront behaviour: with the local frontend running, execute
  `node scripts/marketplace-smoke.mjs http://127.0.0.1:3000`. Its intercepted
  API fixtures do not verify a real backend, payments or deployed networking.
- Backend checks, from `backend/`: `python -m pytest -q -p no:cacheprovider`.
- Run checks relevant to the change and distinguish fixture coverage from
  real service verification. Review the staged diff before any requested commit.

Upstream source, pinned revision and license: `.agents/SUPERPOWERS.md`.
