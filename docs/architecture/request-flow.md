# Request Flow

## Purpose

This document describes the end-to-end request flow for the Justin Lite backend.

Its goal is to make the system:

- traceable
- debuggable
- safe to evolve

By following this flow, a developer should be able to understand **exactly where logic lives, when decisions are made, and how AI responses are produced**.

---

## Canonical Flow: Responding in a Conversation

This section documents the most important request in the system:

This endpoint represents a complete interaction cycle.

---

## Step-by-Step Flow

### 1. Request Entry

The client sends a POST request to `/conversations/:id/respond`.

- The request body is empty or minimal
- The conversation ID is provided via the URL
- Authentication is handled via Supabase JWT

---

### 2. CORS Validation

The request first passes through the CORS middleware.

- Origin is validated against an allowlist
- Server-to-server and tool-based requests (no origin) are allowed
- Invalid origins are rejected early

This prevents unauthorized cross-origin access.

---

### 3. JSON Parsing

The request body is parsed using Express’s JSON middleware.

- Payload size is capped
- Malformed JSON is rejected before business logic

---

### 4. Request Logging

The request logger records:

- HTTP method
- request path
- response status (after completion)
- response duration
- authenticated user ID (if present)
- environment

No request body, headers, or tokens are logged.

---

### 5. Authentication (`requireAuth`)

The authentication middleware:

- Extracts the JWT from the request
- Verifies it using Supabase Auth
- Attaches a trusted `req.user` object

If authentication fails:

- The request is terminated with a structured `401` error

---

### 6. Rate Limiting

The route-specific rate limiter is applied.

For `/respond`:

- Limits are strict
- Throttling is per authenticated user
- This protects OpenAI usage and prevents abuse

If limits are exceeded:

- A `429` error is returned
- The request does not reach AI or database layers

---

### 7. Conversation Ownership Check

Inside the service layer:

- The conversation is queried by `id` and `user_id`
- Ownership is enforced at the conversation level

If the conversation does not exist or is not owned by the user:

- A `404` or `401` structured error is thrown

Messages are never accessed directly without this check.

---

### 8. Message Retrieval

The backend retrieves:

- All messages for the conversation
- Ordered chronologically

A windowed subset (e.g. last N messages) is used later for AI input.

If no messages exist:

- The request is rejected as invalid for response generation

---

### 9. Prompt Assembly (Authoritative Order)

The AI prompt is assembled in a strict order:

1. **Global system doctrine** (`SYSTEM_PROMPT`)
2. **Optional behavior override examples** (if present)
3. **Conversation-level system prompt** (optional)
4. **User memory** (limited, extracted context)
5. **Rolling conversation summary** (if available)
6. **Recent message window** (last N messages)

This ordering ensures:

- doctrine governs behavior
- memory supports reflection
- recent context remains primary

No AI call is made until prompt assembly is complete.

---

### 10. AI Response Generation

The assembled prompt is sent to OpenAI.

- Model is defined via environment configuration
- Temperature is controlled
- Only a single assistant response is requested

If OpenAI fails or returns an empty response:

- A structured `502` error is thrown

---

### 11. Assistant Message Persistence

The assistant’s response is:

- validated
- inserted into the `messages` table
- linked to the same conversation

This ensures:

- a complete conversational record
- summaries and memory can reference assistant turns

---

### 12. Summary Trigger (Conditional)

After message insertion:

- The total message count is checked
- If a summary threshold is reached:
  - A rolling summary is generated
  - The conversation’s `summary` and `summary_count` are updated

Summaries are generated deliberately, not continuously.

---

### 13. Memory Extraction Trigger (Conditional)

If enough summaries exist and reflection thresholds are met:

- The memory extraction service runs
- Pattern-based memory is extracted
- Entries are written to `user_memories`

Memory extraction is conservative and capped.

---

### 14. Response to Client

Finally:

- The newly created assistant message is returned to the client
- Response includes only the saved message data
- No internal context (memory, summaries, doctrine) is exposed

---

## Error Handling

At any point in the flow:

- Known errors are thrown as `AppError` subclasses
- Errors propagate upward
- A single global error handler formats the response

Unexpected errors:

- Are logged internally
- Return a safe `500` response

---

## Other Request Flows (Brief)

### Create Conversation

- Auth → validation → ownership assignment → insert

### Create Message

- Auth → validation → ownership check → insert

### Fetch Conversations / Messages

- Auth → rate limit (optional) → ownership-scoped queries

---

## Design Guarantees

This request flow guarantees:

- No AI calls without authorization
- No memory updates without sufficient context
- No reflection without summaries
- No message access without ownership
- No silent failures

---

## Closing Statement

The request flow is intentionally disciplined.

Each layer has a single responsibility.
Each decision has a defined place.
Each shortcut is avoided.

This structure preserves:

- correctness
- ethics
- evolvability

As the system grows, this flow should remain the reference point for any new feature.
