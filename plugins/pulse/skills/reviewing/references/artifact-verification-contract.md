# Artifact Verification Contract

Run Level 1 -> Level 2 -> Level 3 for each artifact named in `CONTEXT.md` and `approach.md`.

## Levels

1. **EXISTS**: artifact path/component/route exists.
2. **SUBSTANTIVE**: implementation is real, not a stub.
3. **WIRED**: integrated into calling/entry layers.

Use minimal project-appropriate checks (`ls`, grep/search, import/use-site checks) and prefer direct evidence.

## Severity mapping

- L1+L2+L3 pass -> fully wired (no finding)
- L1+L2 only -> create `P2` review bead
- L1 only (stub) -> create `P1` review bead
- Missing -> create `P1` review bead

## Non-interactive UAT evidence

For APIs/config/infra/CLI where human click-through is not applicable, include:
- verification command output
- before/after behavior or config diff
- logs proving activation
- relevant automated test output

Use `history/<feature>/verification/` as canonical evidence.