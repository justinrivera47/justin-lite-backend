```md
# Backend Overview

## Purpose

This document describes the Justin Lite backend at a systems level: how requests flow, how data is protected, and how AI responses are generated reliably in production.

The goal of this backend is not “a chatbot endpoint.”  
It is a secure, deliberate conversation system with summaries and memory extraction governed by explicit rules.

---

## Stack

- Runtime: Node.js + Express
- Language: TypeScript
- Auth: Supabase Auth (JWT)
- Database: Supabase Postgres + RLS policies
- AI: OpenAI Chat Completions
- Deployment: Vercel (API) or Node server (local)

---

## High-Level Architecture

### Key Components

- **app.ts**

  - Express app configuration
  - Middleware order (CORS → JSON → logging → routes → error handler)
  - `/health` endpoint

- **routes/**

  - Defines API endpoints and attaches middleware (auth, validation, rate limits)
  - Thin routing layer: does not contain business logic

- **middleware/**

  - `requireAuth`: verifies Supabase JWT, attaches `req.user`
  - `validate`: Zod payload validation for write endpoints
  - `rateLimit`: per-user and per-route throttling (cost + abuse protection)
  - `requestLogger`: structured request logs
  - `errorHandler`: single global structured error handler

- **services/**

  - `messageService`: message reads/writes and ownership checks
  - `conversationService`: conversation lifecycle ops
  - `aiService`: prompt assembly + OpenAI call + assistant message persistence
  - `summaryService`: rolling summary generation + counters
  - `memoryService`: extracts user memory from summaries (governed + limited)

- **lib/**

  - `supabaseAdmin`: server-side Supabase client for privileged DB writes
  - `openai`: OpenAI client initialization

- **validation/**

  - Zod schemas for request contracts (create conversation, create message, respond)

- **errors/**
  - Structured error classes (`AppError`, `AuthError`, `ValidationError`, etc.)
  - Stable `statusCode` + `code` returned to frontend

---

## Request Lifecycle

Every request follows a consistent chain:

1. **CORS**

   - Allowlist origin validation
   - Credentials enabled as required for frontend integration

2. **JSON Body Parsing**

   - Request bodies are parsed with a fixed size limit

3. **Request Logging**

   - Logs method, path, status, duration, and userId (if available)
   - Does not log tokens or request body

4. **Route Middleware**

   - `requireAuth` (for protected routes)
   - `validate(schema)` (for write endpoints)
   - `rateLimiter` (route-specific throttles)

5. **Business Logic (Services)**

   - Ownership checks enforced through conversation joins
   - Database reads/writes via `supabaseAdmin`

6. **Response**
   - Consistent JSON response contracts
   - Errors handled centrally through the global error handler

---

## Auth and Ownership Model

### Authentication

- Clients authenticate via Supabase Auth.
- The backend validates the JWT on each protected route.
- A verified user is attached to `req.user`.

### Authorization (Ownership)

Ownership is enforced through the `conversations` table:

- A conversation belongs to a user (`conversations.user_id`)
- Messages belong to a conversation (`messages.conversation_id`)
- Message access is granted only if the user owns the conversation

This prevents direct message-level ownership drift and keeps authorization logic consistent.

---

## Data Model Summary

Core tables:

- **conversations**

  - `id`, `user_id`, `title`, `system_prompt`, `summary`, `summary_count`, timestamps

- **messages**

  - `id`, `conversation_id`, `role`, `content`, `has_attachments`, timestamps

- **user_context**

  - `user_id`, `key` (optional), `value` (memory entry), timestamps

- **subscriptions**
  - prepared for tier gating (future use)

Row-level security (RLS) is enabled and aligned with the ownership model.

---

## AI Response Pipeline

The AI response pipeline is intentionally structured to preserve doctrine, reduce drift, and control cost.

### Prompt Assembly Order (authoritative)

1. **Global doctrine** (`SYSTEM_PROMPT`)
2. **(Optional) memory/behavior override examples** (if used)
3. **Conversation system prompt** (optional per-conversation customization)
4. **User memory** (limited, injected as quiet system context)
5. **Rolling conversation summary** (system context)
6. **Recent message window** (last N messages)

Only after prompt assembly is complete is the OpenAI request made.

The assistant response is then persisted as a message in the same conversation.

---

## Summaries and Memory

### Rolling Summaries

- Generated at defined message thresholds
- Stored on the conversation record
- Used as system context to preserve continuity while keeping token usage controlled

### Memory Extraction

- Triggered only after enough summaries exist and reflection thresholds are met
- Stores conservative, limited, pattern-based memory into `user_context`
- Memory supports reflection; it is not used for identity inference or profiling

---

## Production Guardrails

### Validation

- Zod schemas validate request payloads at the edge
- Prevents malformed input from reaching services, DB, or AI calls

### Rate Limiting

- Per-user throttling using `req.user.id` when available
- Strict limits on AI-heavy endpoints (`/respond`)
- Moderate limits on write endpoints (messages, conversations)

### Structured Errors

- All expected failures use `AppError` subclasses with stable codes
- Unknown errors return a safe 500 response
- One global error handler is the single exit point for errors

### Health Endpoint

- `/health` reports:
  - environment
  - database connectivity
  - OpenAI configuration status
  - timestamp

---

## Folder Contracts (Rules)

- Routes should stay thin (no business logic).
- Services contain business logic and enforce ownership checks.
- Middleware handles cross-cutting concerns (auth, validation, limits, logging).
- Errors are structured; raw `throw new Error()` is discouraged in business logic.
- Doctrine governs prompt behavior; code should not override doctrine casually.

---

## Summary

Justin Lite’s backend is designed to be:

- secure (auth + ownership + RLS)
- consistent (validation + error codes)
- cost-aware (rate limiting + message windowing + summaries)
- ethically restrained (governed memory + deliberate reflection)

The system prioritizes correctness, clarity, and durability over speed or novelty.
```
