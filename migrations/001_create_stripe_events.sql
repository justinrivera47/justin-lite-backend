-- Migration: Create stripe_events table for webhook idempotency
-- This table tracks processed Stripe webhook events to prevent duplicate processing

CREATE TABLE IF NOT EXISTS stripe_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT UNIQUE NOT NULL,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookups by event_id
CREATE INDEX IF NOT EXISTS idx_stripe_events_event_id ON stripe_events(event_id);

-- Index for cleanup of old events
CREATE INDEX IF NOT EXISTS idx_stripe_events_processed_at ON stripe_events(processed_at);

-- Optional: Add a cleanup policy to remove events older than 30 days
-- This can be run as a scheduled job or cron
-- DELETE FROM stripe_events WHERE processed_at < NOW() - INTERVAL '30 days';

-- RLS Policy: Only service role can access this table
ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;

-- No public access - only the service role key should interact with this table
CREATE POLICY "Service role only" ON stripe_events
  FOR ALL
  USING (false)
  WITH CHECK (false);
