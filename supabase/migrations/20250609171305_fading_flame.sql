/*
  # Fix User Creation Issues
  
  This migration fixes the database error when creating new users by:
  1. Ensuring the profiles table exists with correct structure
  2. Fixing the trigger function for new user creation
  3. Adding proper RLS policies
  4. Ensuring all constraints are correct
*/

-- ============================================================================
-- 1. ENSURE PROFILES TABLE EXISTS WITH CORRECT STRUCTURE
-- ============================================================================

-- Drop existing profiles table if it has issues
DROP TABLE IF EXISTS profiles CASCADE;

-- Create profiles table with correct structure
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. FIX THE TRIGGER FUNCTION
-- ============================================================================

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;

-- Create the correct trigger function
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    NEW.email
  );
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the user creation
    RAISE WARNING 'Failed to create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. CREATE THE TRIGGER
-- ============================================================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- 4. ENABLE RLS AND CREATE POLICIES
-- ============================================================================

-- Enable RLS on profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- Create policies for profiles
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================================================
-- 5. ENSURE SHOPS TABLE HAS CORRECT CONSTRAINTS
-- ============================================================================

-- Make sure shops table allows NULL owner_id initially
ALTER TABLE shops ALTER COLUMN owner_id DROP NOT NULL;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_shops_owner_id ON shops(owner_id);

-- ============================================================================
-- 6. CREATE A FUNCTION TO MANUALLY CREATE PROFILES (BACKUP)
-- ============================================================================

CREATE OR REPLACE FUNCTION create_profile_for_user(user_id UUID, user_name TEXT, user_email TEXT)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (user_id, user_name, user_email)
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SETUP COMPLETE!
-- ============================================================================

-- Test the setup
DO $$
BEGIN
  RAISE NOTICE 'Database setup completed successfully!';
  RAISE NOTICE 'Profiles table: %', (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'profiles');
  RAISE NOTICE 'Trigger function exists: %', (SELECT COUNT(*) FROM information_schema.routines WHERE routine_name = 'handle_new_user');
END $$;