/*
  # Add Payment and Business Fields to Shops Table
  
  This migration adds payment_info and business_details JSONB fields to the shops table
  to store payment methods, bank details, UPI information, and business registration details.
*/

-- Add payment_info and business_details fields to shops table
ALTER TABLE shops 
ADD COLUMN IF NOT EXISTS payment_info JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS business_details JSONB DEFAULT '{}'::jsonb;

-- Create index for better performance when querying by these fields
CREATE INDEX IF NOT EXISTS idx_shops_payment_info ON shops USING gin (payment_info);
CREATE INDEX IF NOT EXISTS idx_shops_business_details ON shops USING gin (business_details);

-- Update existing shops with empty JSON objects if fields are null
UPDATE shops 
SET 
  payment_info = COALESCE(payment_info, '{}'::jsonb),
  business_details = COALESCE(business_details, '{}'::jsonb)
WHERE 
  payment_info IS NULL OR business_details IS NULL;

-- Add comment to explain the fields
COMMENT ON COLUMN shops.payment_info IS 'Payment methods, UPI IDs, bank details, etc.';
COMMENT ON COLUMN shops.business_details IS 'Business registration, PAN, GST, etc.';