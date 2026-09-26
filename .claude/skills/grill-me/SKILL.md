---
name: grill-me
description: Interview the user relentlessly about a plan, idea or design until every branch of the decision tree is resolved and you share a clear understanding. Use when the user says "grill me", "me grelha", "me questiona", or wants their plan stress-tested before building.
---

# Grill me

Interview the user about their plan until you reach a shared, concrete understanding of it.

## How to run it

1. **Get the plan.** If the user hasn't described it yet, ask for it in one short question.
2. **Map the decision tree.** Silently list the open decisions the plan depends on: goals, users, scope, constraints, data, architecture, edge cases, risks, success criteria. Order them so decisions that others depend on come first.
3. **Ask one question at a time.** Never batch questions. Each question should:
   - target the most important unresolved decision,
   - be specific and answerable,
   - include your recommended answer and why, so the user can just confirm or push back.
4. **Explore before asking.** If a question can be answered by reading the codebase, docs or files available to you, look it up instead of asking.
5. **Push on weak answers.** If an answer is vague, contradictory or hides an assumption, say so and dig deeper before moving on. Point out conflicts with earlier answers.
6. **Walk every branch.** When an answer opens new sub-decisions, resolve them before returning to the rest of the tree. Don't stop while important branches remain open.
7. **Wrap up.** When the tree is resolved, give a concise summary: decisions made, assumptions accepted, open risks, and suggested next steps. Ask if they want it saved to a file.

## Style

- Reply in the user's language.
- Be direct and skeptical, not hostile. The goal is clarity, not winning.
- Keep each turn short: one question plus your recommendation.
