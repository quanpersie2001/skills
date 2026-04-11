# Visual Support Guidance

Use this during `pulse:brainstorming` when a design decision would be easier to answer by seeing options.

## When to Use Visuals

Use visual support when the decision is about:

- layout direction
- information hierarchy
- page or screen flow
- wireframe comparison
- diagramming relationships or sequence
- side-by-side interface alternatives

Stay in text when the decision is about:

- goals
- scope boundaries
- constraints
- priorities
- trade-offs that are not inherently visual
- success criteria

A UI topic is not automatically a visual question. Ask: **would seeing options reduce ambiguity more than reading words?** If not, stay in text.

## Preferred Interaction Pattern

1. Offer visual support in its own message and wait for consent.
2. Start with `AskUserQuestion` + `preview` when the comparison fits in a small side-by-side artifact.
3. Escalate to the local visual runtime only when the question is too visually complex for previews: styling exploration, dense layout comparison, design-system composition, or multi-screen flow shape.
4. Keep options focused and mutually exclusive when possible.
5. Return to normal text questioning as soon as the visual ambiguity is resolved.

## Advanced Visual Runtime

Use the local runtime only for complex UI brainstorming where browser-served screens are clearly better than previews.

### Start the runtime

```bash
scripts/start-visual-server.sh --project-dir /path/to/repo
```

This returns JSON containing:
- `url`
- `screen_dir`
- `state_dir`

### Runtime workflow

1. Tell the user to open the returned `url`.
2. Write a new HTML file to `screen_dir` for each screen.
3. Read `state_dir/events` on the next turn to pick up browser selections.
4. If `state_dir/server-info` is missing or `state_dir/server-stopped` exists, restart the runtime or fall back to previews.
5. Stop the runtime when done:

```bash
scripts/stop-visual-server.sh <session_dir>
```

### Fallback rule

If Node is unavailable, the runtime fails to start, or the environment makes the local URL unreachable, continue with `AskUserQuestion` previews and text. Visual support is optional. Brainstorming must still complete without the runtime.

## Preview Design Rules

- Show 2–4 options max.
- Keep previews intentionally low-fidelity unless polish itself is the decision.
- Label the difference clearly: structure, hierarchy, flow, or emphasis.
- Avoid mixing visual differences with conceptual differences in the same comparison.

## Example Decisions

**Use visuals:**
- "Which dashboard layout is closer to the experience you want?"
- "Which onboarding flow structure feels clearer?"
- "Which information hierarchy should lead this page?"

**Stay in text:**
- "What is the main user outcome this flow should optimize for first?"
- "Which constraints are fixed versus negotiable?"
- "What would make this brainstorming session successful?"
