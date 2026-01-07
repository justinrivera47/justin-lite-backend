# Data Model

## Purpose

This document describes the core data model of the Justin Lite backend.

The data model is intentionally minimal, relational, and ownership-driven.  
It is designed to support deliberate reflection, summaries, and memory extraction without storing excessive or invasive user data.

The guiding principle is:

> **Store structure, not identity. Preserve meaning, not raw history.**

---

## Core Design Principles

1. **Ownership is enforced at the conversation level**
2. **Messages inherit access through conversations**
3. **Memory is extracted, not accumulated**
4. **No table exists solely to mirror raw conversation history**
5. **All user data is scoped, intentional, and revisable**

---

## Tables Overview

### `users`

This table represents application users and is aligned with Supabase Auth.

**Purpose**

- Identity anchor for authentication and ownership
- Minimal surface area

**Key Fields**

- `id` (uuid, primary key)
- Additional profile fields as needed (minimal by design)

**Notes**

- Authentication is handled by Supabase
- The backend never infers traits or identity from user data

---

### `conversations`

The conversation is the **primary ownership boundary** in the system.

**Purpose**

- Group messages
- Enforce user ownership
- Store rolling summaries and metadata

**Key Fields**

- `id` (uuid, primary key)
- `user_id` (uuid, foreign key → users.id)
- `title` (text, optional)
- `system_prompt` (text, optional)
- `summary` (text, nullable)
- `summary_count` (integer)
- `created_at`, `updated_at`

**Design Rationale**

- Ownership is enforced here to avoid duplicating authorization logic on messages
- Summaries live at the conversation level to reflect _context over time_
- `system_prompt` allows scoped behavioral adjustments without affecting global doctrine

---

### `messages`

Messages represent individual conversational turns.

**Purpose**

- Store user and assistant exchanges
- Preserve conversational flow
- Feed summarization and reflection pipelines

**Key Fields**

- `id` (uuid, primary key)
- `conversation_id` (uuid, foreign key → conversations.id)
- `role` (`user` | `assistant` | `system`)
- `content` (text)
- `has_attachments` (boolean)
- `created_at`

**Design Rationale**

- Messages do **not** store `user_id` for authorization
- Access is inherited through `conversation_id`
- This prevents ownership drift and simplifies RLS policies

---

### `user_memories`

This table stores **extracted memory**, not raw history.

**Purpose**

- Persist pattern-based insights across conversations
- Support deliberate reflection
- Avoid full transcript storage

**Key Fields**

- `id` (uuid, primary key)
- `user_id` (uuid, foreign key → users.id)
- `key` (text, optional)
- `value` (text)
- `created_at`

**Design Rationale**

- Entries are lightweight and capped
- Values represent observations, not conclusions
- Memory is revisable and non-authoritative
- No emotional scoring, profiling, or identity labeling is stored

---

### `subscriptions` (Future-facing)

Prepared for feature gating and access tiers.

**Purpose**

- Support subscription-based features
- Enable future limits or expansions without schema churn

**Key Fields**

- `user_id`
- plan / status metadata

**Notes**

- Currently passive
- Designed to integrate cleanly with Stripe or similar services

---

## Relationships

```text
users
  └── conversations (1:N)
        └── messages (1:N)

users
  └── user_memories (1:N)
```
