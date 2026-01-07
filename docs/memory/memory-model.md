# Memory Model

## Purpose

This document defines how memory functions within Justin Lite.

Memory in Justin Lite is not recall, storage of conversations, or continuous awareness.
It is a **deliberate, structured abstraction** designed to support reflection without surveillance or overreach.

---

## What Memory Is

In Justin Lite, memory is:

- extracted, not assumed
- limited, not exhaustive
- pattern-based, not event-based
- supportive of reflection, not predictive

Memory exists to provide _contextual continuity_, not historical replay.

---

## What Memory Is Not

Memory in Justin Lite is **not**:

- full conversation history
- verbatim message recall
- identity profiling
- behavioral tracking
- emotional scoring
- permanent truth about the user

Justin Lite does not “remember everything.”
It remembers _what has proven relevant over time_.

---

## Memory Sources

Memory is derived from two controlled sources:

### 1. Conversation Summaries

Summaries are generated periodically as conversations grow.

They:

- condense prior exchanges into neutral context
- remove unnecessary detail
- preserve themes rather than specifics

Summaries are used to:

- reduce token usage
- maintain coherence
- enable reflection across time

---

### 2. Extracted User Context

User context is stored as **key/value insights** derived from repeated patterns across summaries.

Examples (conceptual):

- recurring topics
- consistent concerns
- stable preferences in expression

This data is stored in the `user_memories` table and intentionally capped.

---

## Memory Extraction Process

Memory is not updated continuously.

It is triggered only when:

- enough conversation summaries exist
- patterns repeat across multiple summaries
- reflection thresholds are met

This ensures memory is:

- earned
- conservative
- resistant to noise or single moments

---

## Memory Storage Structure

Memory is stored as lightweight entries:

- no raw message content
- no emotional labeling
- no inferred identity traits

Each entry represents an observation, not a conclusion.

Memory entries are revisable and can be superseded by new context.

---

## Memory Usage in Responses

When generating responses, memory is:

- injected as quiet system context
- never presented as authoritative truth
- never framed as personal knowledge
- never exposed verbatim to the user unless summarized intentionally

Memory supports reflection but does not dominate it.

---

## Memory Decay and Limits

Memory is intentionally constrained:

- capped in quantity
- prioritized by relevance
- open to revision
- subject to deletion if necessary

Justin Lite favors **accuracy over accumulation**.

More memory does not equal better understanding.

---

## User Control and Safety

Memory exists to serve the user, not to define them.

The system is designed so that:

- memory does not override current expression
- new context can contradict old patterns
- reflection remains flexible

The user is never reduced to stored memory.

---

## Design Rationale

This memory model exists to balance:

- continuity and restraint
- insight and humility
- usefulness and ethics

By limiting memory, Justin Lite preserves:

- user autonomy
- interpretive openness
- ethical clarity

---

## Closing Statement

Memory in Justin Lite is a tool for reflection, not possession.

It observes carefully.
It stores sparingly.
It reflects responsibly.

Understanding grows through pattern, not accumulation.
