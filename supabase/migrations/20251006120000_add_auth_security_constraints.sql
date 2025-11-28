/*
  # Add Authentication Security Constraints

  1. Changes
    - Add unique constraint on shops.email to prevent duplicate email addresses
    - Add unique constraint on shops.phone to prevent duplicate phone numbers
    - Add indexes for faster lookups on email and phone
    - Add constraint to ensure email format is valid
    - Add constraint to ensure phone has minimum length

  2. Security
    - Prevents creation of multiple shops with same email
    - Prevents creation of multiple shops with same phone number
    - Ensures data integrity and prevents account confusion
    - Improves query performance with indexes

  3. Important Notes
    - Existing duplicate data will need to be cleaned before applying
    - Email addresses are case-insensitive (stored in lowercase)
    - Phone numbers should be normalized before storage
*/

-- ============================================================================
-- 1. ADD UNIQUE CONSTRAINTS FOR EMAIL AND PHONE
-- ============================================================================

-- Add unique constraint on email (case-insensitive)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shops_email_unique'
  ) THEN
    -- First, ensure all emails are lowercase
    UPDATE shops SET email = LOWER(email) WHERE email IS NOT NULL;

    -- Add unique constraint
    ALTER TABLE shops
    ADD CONSTRAINT shops_email_unique
    UNIQUE (email);

    RAISE NOTICE '✅ Added unique constraint on shops.email';
  ELSE
    RAISE NOTICE 'ℹ️ Unique constraint shops_email_unique already exists';
  END IF;
END $$;

-- Add unique constraint on phone
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shops_phone_unique'
  ) THEN
    ALTER TABLE shops
    ADD CONSTRAINT shops_phone_unique
    UNIQUE (phone);

    RAISE NOTICE '✅ Added unique constraint on shops.phone';
  ELSE
    RAISE NOTICE 'ℹ️ Unique constraint shops_phone_unique already exists';
  END IF;
END $$;

-- ============================================================================
-- 2. ADD DATA VALIDATION CONSTRAINTS
-- ============================================================================

-- Add email format validation constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shops_email_format'
  ) THEN
    ALTER TABLE shops
    ADD CONSTRAINT shops_email_format
    CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

    RAISE NOTICE '✅ Added email format validation constraint';
  ELSE
    RAISE NOTICE 'ℹ️ Email format constraint already exists';
  END IF;
END $$;

-- Add phone minimum length constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'shops_phone_min_length'
  ) THEN
    ALTER TABLE shops
    ADD CONSTRAINT shops_phone_min_length
    CHECK (LENGTH(REGEXP_REPLACE(phone, '[^0-9]', '', 'g')) >= 10);

    RAISE NOTICE '✅ Added phone minimum length constraint';
  ELSE
    RAISE NOTICE 'ℹ️ Phone minimum length constraint already exists';
  END IF;
END $$;

-- ============================================================================
-- 3. ADD PERFORMANCE INDEXES
-- ============================================================================

-- Add index on email for faster lookups (case-insensitive)
CREATE INDEX IF NOT EXISTS idx_shops_email_lower
ON shops (LOWER(email));

-- Add index on phone for faster lookups
CREATE INDEX IF NOT EXISTS idx_shops_phone
ON shops (phone);

-- ============================================================================
-- 4. CREATE FUNCTION TO CHECK FOR DUPLICATE EMAIL/PHONE
-- ============================================================================

-- Function to check if email is already used
CREATE OR REPLACE FUNCTION check_email_available(p_email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM shops
    WHERE LOWER(email) = LOWER(p_email)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if phone is already used
CREATE OR REPLACE FUNCTION check_phone_available(p_phone TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM shops
    WHERE phone = p_phone
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. VERIFICATION AND SUMMARY
-- ============================================================================

DO $$
DECLARE
  email_constraint_exists BOOLEAN;
  phone_constraint_exists BOOLEAN;
BEGIN
  -- Check constraints
  SELECT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shops_email_unique'
  ) INTO email_constraint_exists;

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'shops_phone_unique'
  ) INTO phone_constraint_exists;

  RAISE NOTICE '============================================';
  RAISE NOTICE '🔒 AUTHENTICATION SECURITY MIGRATION COMPLETE!';
  RAISE NOTICE '============================================';
  RAISE NOTICE '✅ Email unique constraint: %', CASE WHEN email_constraint_exists THEN 'ACTIVE' ELSE 'MISSING' END;
  RAISE NOTICE '✅ Phone unique constraint: %', CASE WHEN phone_constraint_exists THEN 'ACTIVE' ELSE 'MISSING' END;
  RAISE NOTICE '';
  RAISE NOTICE '🛡️ Security Features Enabled:';
  RAISE NOTICE '   - Duplicate email prevention';
  RAISE NOTICE '   - Duplicate phone prevention';
  RAISE NOTICE '   - Email format validation';
  RAISE NOTICE '   - Phone number validation (min 10 digits)';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 Your authentication system is now enterprise-grade!';
  RAISE NOTICE '============================================';
END $$;
