-- Tracks whether the partner's desktop app is running (shop live on website).
ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS desktop_live BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS desktop_live_at TIMESTAMPTZ;

COMMENT ON COLUMN shops.desktop_live IS 'True while PrintGet desktop app is open; overrides operating_hours for customer open/closed status.';
COMMENT ON COLUMN shops.desktop_live_at IS 'Last time desktop_live was updated.';
