# PR Summary

## Title

Implement TriAgent v2 runtime, TUI, hardening, and DX

## Summary

This PR turns TriAgent from an architectural MVP into a usable multi-agent CLI orchestrator.

- Implements real session execution with worktrees, task rounds, retries, and sequential merges.
- Connects the Ink TUI to the live event bus and moves plan approval into the terminal UI.
- Adds operational hardening with persisted session snapshots, JSONL event logs, auth checks, task timeouts, and session-aware cleanup.
- Upgrades planning and scheduling with better task decomposition, target path inference, and scoring-based agent assignment.
- Improves DX with working `logs` and `doctor` commands plus stronger diagnostics.

## Key Changes

- Runtime orchestration in `src/core/session.ts`
- Planner v2 in `src/core/planner.ts`
- Scheduler v2 in `src/core/scheduler.ts`
- Live TUI state in `src/tui/state.ts`
- Session persistence in `src/persistence/session-persistence.ts`
- CLI support commands in `src/cli.ts`
- Diagnostics helpers in `src/support/`

## Validation

- `npm test`
- `npm run lint`
- `npm run build`

All passed at the time of delivery.

## Notes

- This repo is a Node CLI, not a web application. It is ready for packaging/release, but it does not have a meaningful web deployment target as-is.
