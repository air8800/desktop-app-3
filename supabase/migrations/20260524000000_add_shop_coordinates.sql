-- Add geographic coordinates to shops for partner onboarding
ALTER TABLE shops
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

COMMENT ON COLUMN shops.latitude IS 'Shop latitude (WGS84)';
COMMENT ON COLUMN shops.longitude IS 'Shop longitude (WGS84)';
