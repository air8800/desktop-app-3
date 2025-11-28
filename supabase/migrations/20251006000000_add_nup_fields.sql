/*
  # Add N-up Printing Fields to Print Jobs

  1. Changes
    - Add `nup_pages` column to print_jobs table (integer, default 1)
      - Stores how many pages to print per sheet (1 = normal, 2 = 2-up, 4 = 4-up)
    - Add `nup_orientation` column to print_jobs table (text, default 'portrait')
      - Stores orientation preference for N-up layouts ('portrait' or 'landscape')

  2. Migration Details
    - Uses IF NOT EXISTS checks to ensure safe re-execution
    - Sets sensible defaults for backward compatibility
    - Maintains existing data integrity

  3. Purpose
    - Enables web app customers to specify N-up layout preferences
    - Allows desktop app to pre-fill N-up settings from customer orders
    - Improves print efficiency by supporting multiple pages per sheet
*/

-- Add nup_pages column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'print_jobs' AND column_name = 'nup_pages'
  ) THEN
    ALTER TABLE print_jobs ADD COLUMN nup_pages INTEGER NOT NULL DEFAULT 1;
    RAISE NOTICE '✅ Added nup_pages column to print_jobs table';
  ELSE
    RAISE NOTICE 'ℹ️ Column nup_pages already exists in print_jobs table';
  END IF;
END $$;

-- Add nup_orientation column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'print_jobs' AND column_name = 'nup_orientation'
  ) THEN
    ALTER TABLE print_jobs ADD COLUMN nup_orientation TEXT NOT NULL DEFAULT 'portrait';
    RAISE NOTICE '✅ Added nup_orientation column to print_jobs table';
  ELSE
    RAISE NOTICE 'ℹ️ Column nup_orientation already exists in print_jobs table';
  END IF;
END $$;

-- Add check constraint for valid nup_pages values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_nup_pages_valid'
  ) THEN
    ALTER TABLE print_jobs
    ADD CONSTRAINT check_nup_pages_valid
    CHECK (nup_pages IN (1, 2, 4, 6, 9, 16));
    RAISE NOTICE '✅ Added check constraint for valid nup_pages values';
  ELSE
    RAISE NOTICE 'ℹ️ Check constraint check_nup_pages_valid already exists';
  END IF;
END $$;

-- Add check constraint for valid nup_orientation values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_nup_orientation_valid'
  ) THEN
    ALTER TABLE print_jobs
    ADD CONSTRAINT check_nup_orientation_valid
    CHECK (nup_orientation IN ('portrait', 'landscape'));
    RAISE NOTICE '✅ Added check constraint for valid nup_orientation values';
  ELSE
    RAISE NOTICE 'ℹ️ Check constraint check_nup_orientation_valid already exists';
  END IF;
END $$;

-- Verification
DO $$
DECLARE
  nup_pages_exists BOOLEAN;
  nup_orientation_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'print_jobs' AND column_name = 'nup_pages'
  ) INTO nup_pages_exists;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'print_jobs' AND column_name = 'nup_orientation'
  ) INTO nup_orientation_exists;

  RAISE NOTICE '============================================';
  RAISE NOTICE '🎉 N-UP PRINTING FIELDS MIGRATION COMPLETE!';
  RAISE NOTICE '============================================';
  RAISE NOTICE '✅ nup_pages column: %', CASE WHEN nup_pages_exists THEN 'EXISTS' ELSE 'MISSING' END;
  RAISE NOTICE '✅ nup_orientation column: %', CASE WHEN nup_orientation_exists THEN 'EXISTS' ELSE 'MISSING' END;
  RAISE NOTICE '';
  RAISE NOTICE '📊 Valid nup_pages values: 1, 2, 4, 6, 9, 16';
  RAISE NOTICE '📊 Valid nup_orientation values: portrait, landscape';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 Desktop app can now use customer N-up preferences!';
  RAISE NOTICE '============================================';
END $$;
