# Finishing Checklist

- Confirm all epic beads are closed (`bv --robot-triage --graph-root <epic-id>`).
- Run final build/test/lint and route failures to blocking review beads.
- Present merge options to the user (PR, direct merge, keep branch, discard branch).
- Confirm canonical verification evidence is complete in `history/<feature>/verification/`.
- Write or refresh `history/<feature>/lifecycle-summary.md` with gate outcomes and follow-up debt.
- Clean up worktree if used.
- Close epic bead.
- Clear/update Pulse state artifacts for completion.

If P2/P3 review beads exist, include them in PR/body follow-up sections without blocking merge.