---
name: code-review-and-comments
description: Use this skill when reviewing existing code for correctness, maintainability, readability, and project consistency, and when adding clear, minimal, high-value code comments without over-commenting.
---

# Code Review and Comments

## Purpose

This skill is used to review existing code and improve its clarity.

It has two responsibilities:

1. Review code for correctness, maintainability, readability, and consistency
2. Add useful comments where comments materially improve understanding

This skill should not introduce broad refactors unless explicitly requested.

---

## Use This Skill When

Use this skill when asked to:
- review code quality
- find bugs or design issues
- improve readability
- add comments to existing code
- explain code through inline comments
- prepare code for handoff or team review

---

## Do Not Use This Skill For

Do not use this skill to:
- rewrite the entire file unnecessarily
- add comments to every line
- introduce unrelated refactors
- change architecture without explicit instruction
- convert working code into a different style just for preference

---

## Review Priorities

Review code in this order:

### 1. Correctness
Check for:
- logic bugs
- broken edge cases
- invalid assumptions
- incorrect async handling
- improper error handling
- inconsistent return types
- bad null / undefined handling

### 2. Project Consistency
Check for:
- mismatch with AGENTS.md
- mismatch with current architecture
- mismatch with project conventions
- mismatch with existing patterns in the codebase

### 3. Maintainability
Check for:
- overly large functions
- duplicated logic
- hidden side effects
- unclear naming
- poor separation of concerns
- hard-coded values that should be centralized

### 4. Readability
Check for:
- confusing control flow
- nested conditionals that can be simplified
- unclear variable names
- implicit behavior that should be made explicit

### 5. Performance
Check only when relevant for the current scope:
- unnecessary repeated DB queries
- unnecessary repeated API calls
- avoidable expensive loops
- wasteful object allocations in hot paths

---

## Commenting Principles

Comments should be added only when they provide real value.

Good comments explain:
- why something exists
- why something is done a certain way
- non-obvious constraints
- important business rules
- tricky edge cases
- integration assumptions
- legal / retrieval / RAG-specific reasoning

Avoid comments that only restate the code.

### Bad Example
```ts
// Increment i
i++
```

### Good Example

```ts
// We prefer lexical matches first here because citation lookups must not be
// outranked by semantically similar but legally irrelevant chunks.
```

---

## Commenting Rules

### 1. Prefer High-Value Comments

Add comments around:

* route handlers with important request assumptions
* retrieval / ranking logic
* prompt construction constraints
* DB queries with non-obvious filters
* fallback logic
* validation rules
* parsing / chunking heuristics

### 2. Do Not Overcomment

Do not add comments for:

* obvious assignments
* standard framework usage
* trivial JSX / HTML structure
* simple getters / setters

### 3. Preserve Signal-to-Noise Ratio

A small number of strong comments is better than many weak comments.

### 4. Use Comments to Explain Constraints

Especially for this project, comments should clarify:

* why hybrid retrieval is used
* why evidence must be traceable
* why a fallback exists
* why generation must remain conservative
* why Python is only used for offline PDF processing

---

## Review Output Format

When reviewing code, provide findings grouped by severity:

### Critical

Issues that may break behavior, corrupt logic, or violate core project requirements

### Important

Issues that reduce correctness, maintainability, or project consistency

### Minor

Readability or style improvements that are useful but not urgent

If editing code directly:

* fix critical issues first
* then fix high-value important issues
* only add comments where they improve understanding

---

## Editing Guidance

When updating a file:

* preserve existing behavior unless a bug is being fixed
* keep changes focused
* avoid mixing review cleanup with broad redesign
* add comments near the logic they explain
* do not rewrite the file just to make it “look nicer”

---

## Project-Specific Review Guidance

For this repository, pay special attention to:

### Frontend

* chat-first UX consistency
* authority / citation rendering correctness
* clean separation between UI and API logic
* state management simplicity

### Backend

* Hono route clarity
* Drizzle query correctness
* retrieval-first flow
* grounded answer generation
* source traceability
* legal metadata integrity

### Offline Processing

* PDF processing boundaries
* JSON output consistency
* paragraph preservation
* chunk ID stability

---

## Output Expectations

When using this skill, produce one or both of the following:

1. A review summary with prioritized findings
2. A focused code patch that:

   * fixes meaningful issues
   * adds useful comments
   * avoids unnecessary refactors

The ideal result is:

* safer code
* clearer code
* better documented intent
* minimal disruption

````

---

# 建议你再加到 `AGENTS.md` 的一段

这样之后 Codex / Gemini 在 review 时更稳定。

```markdown id="3fmk87"
## Code Review Rule

When reviewing code, prefer focused review over broad rewrites.

Review priority:
1. correctness
2. project consistency
3. maintainability
4. readability

Comments should be added only when they explain:
- non-obvious behavior
- constraints
- fallback logic
- retrieval / RAG rules
- important implementation decisions

Do not over-comment obvious code.
````

---