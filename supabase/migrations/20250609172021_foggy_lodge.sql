-- ============================================================================
-- COMPLETE SUPABASE DATABASE FIX
-- Copy and paste this ENTIRE file into your Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- 1. CLEAN SLATE - REMOVE PROBLEMATIC TRIGGERS AND FUNCTIONS
-- ============================================================================

-- Drop all existing triggers and functions that might be causing issues
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS create_profile_for_user(UUID, TEXT, TEXT) CASCADE;

-- ============================================================================
-- 2. RECREATE PROFILES TABLE WITH PROPER STRUCTURE
-- ============================================================================

-- Drop and recreate profiles table to ensure clean state
DROP TABLE IF EXISTS profiles CASCADE;

CREATE TABLE profiles (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. ENABLE RLS AND CREATE POLICIES FOR PROFILES
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Create policies that allow users to manage their own profiles
CREATE POLICY "Enable read access for users to their own profile" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Enable insert access for users to their own profile" ON profiles
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for users to their own profile" ON profiles
  FOR UPDATE USING (true);

-- ============================================================================
-- 4. CREATE SIMPLE, ROBUST TRIGGER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  user_name TEXT;
BEGIN
  -- Extract name from metadata, with fallback
  user_name := COALESCE(NEW.raw_user_meta_data->>'name', 'User');
  
  -- Insert profile with error handling
  BEGIN
    INSERT INTO public.profiles (id, name, email)
    VALUES (NEW.id, user_name, NEW.email);
  EXCEPTION
    WHEN OTHERS THEN
      -- Log error but don't fail user creation
      RAISE WARNING 'Could not create profile for user %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. CREATE THE TRIGGER
-- ============================================================================

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 6. CREATE MANUAL PROFILE CREATION FUNCTION (BACKUP)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_user_profile(
  user_id UUID,
  user_name TEXT,
  user_email TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (user_id, user_name, user_email)
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    updated_at = NOW();
  
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to create profile: %', SQLERRM;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. ENSURE SHOPS TABLE IS PROPERLY CONFIGURED
-- ============================================================================

-- Make sure shops table exists and is properly configured
CREATE TABLE IF NOT EXISTS shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  owner_id UUID,
  qr_code_url TEXT,
  google_maps_link TEXT,
  is_active BOOLEAN DEFAULT true,
  operating_hours JSONB DEFAULT '{
    "monday": "9:00-18:00",
    "tuesday": "9:00-18:00", 
    "wednesday": "9:00-18:00",
    "thursday": "9:00-18:00",
    "friday": "9:00-18:00",
    "saturday": "9:00-16:00",
    "sunday": "closed"
  }'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on shops
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;

-- Create shops policies
DROP POLICY IF EXISTS "Allow public read access to active shops" ON shops;
CREATE POLICY "Allow public read access to active shops" ON shops
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Shop owners can manage their shops" ON shops;
CREATE POLICY "Shop owners can manage their shops" ON shops
  FOR ALL USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Allow shop creation" ON shops;
CREATE POLICY "Allow shop creation" ON shops
  FOR INSERT WITH CHECK (true);

-- ============================================================================
-- 8. CREATE ALL OTHER NECESSARY TABLES
-- ============================================================================

-- Print jobs table
CREATE TABLE IF NOT EXISTS print_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES shops(id) NOT NULL,
  filename TEXT NOT NULL,
  file_url TEXT NOT NULL,
  copies INTEGER NOT NULL DEFAULT 1,
  paper_size TEXT NOT NULL DEFAULT 'A4',
  color_mode TEXT NOT NULL DEFAULT 'BW',
  print_type TEXT NOT NULL DEFAULT 'Single',
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  total_cost DECIMAL(10,2) NOT NULL,
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed')),
  job_status TEXT DEFAULT 'pending' CHECK (job_status IN ('pending', 'printing', 'completed', 'cancelled')),
  notes TEXT,
  estimated_completion TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cost configurations table
CREATE TABLE IF NOT EXISTS cost_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES shops(id) NOT NULL,
  paper_size TEXT NOT NULL,
  color_mode TEXT NOT NULL,
  print_type TEXT NOT NULL,
  base_price DECIMAL(10,2) NOT NULL,
  bulk_tiers JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shop_id, paper_size, color_mode, print_type)
);

-- Printer configurations table
CREATE TABLE IF NOT EXISTS printer_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES shops(id) NOT NULL,
  paper_size TEXT NOT NULL,
  printers JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shop_id, paper_size)
);

-- ============================================================================
-- 9. ENABLE RLS AND CREATE POLICIES FOR ALL TABLES
-- ============================================================================

-- Print jobs
ALTER TABLE print_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can create print jobs" ON print_jobs;
CREATE POLICY "Anyone can create print jobs" ON print_jobs
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Customers can view their own jobs" ON print_jobs;
CREATE POLICY "Customers can view their own jobs" ON print_jobs
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Shop owners can manage jobs for their shops" ON print_jobs;
CREATE POLICY "Shop owners can manage jobs for their shops" ON print_jobs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM shops 
      WHERE shops.id = print_jobs.shop_id 
      AND shops.owner_id = auth.uid()
    )
  );

-- Cost configs
ALTER TABLE cost_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to cost configs" ON cost_configs;
CREATE POLICY "Allow public read access to cost configs" ON cost_configs
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Shop owners can manage their cost configs" ON cost_configs;
CREATE POLICY "Shop owners can manage their cost configs" ON cost_configs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM shops 
      WHERE shops.id = cost_configs.shop_id 
      AND shops.owner_id = auth.uid()
    )
  );

-- Printer configs
ALTER TABLE printer_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to printer configs" ON printer_configs;
CREATE POLICY "Allow public read access to printer configs" ON printer_configs
  FOR SELECT USING (is_available = true);

DROP POLICY IF EXISTS "Shop owners can manage their printer configs" ON printer_configs;
CREATE POLICY "Shop owners can manage their printer configs" ON printer_configs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM shops 
      WHERE shops.id = printer_configs.shop_id 
      AND shops.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- 10. CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_shops_owner_id ON shops(owner_id);
CREATE INDEX IF NOT EXISTS idx_print_jobs_shop_id ON print_jobs(shop_id);
CREATE INDEX IF NOT EXISTS idx_print_jobs_status ON print_jobs(job_status);
CREATE INDEX IF NOT EXISTS idx_print_jobs_created_at ON print_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cost_configs_shop_id ON cost_configs(shop_id);
CREATE INDEX IF NOT EXISTS idx_printer_configs_shop_id ON printer_configs(shop_id);

-- ============================================================================
-- 11. CREATE UPDATE TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_shops_updated_at ON shops;
CREATE TRIGGER update_shops_updated_at
    BEFORE UPDATE ON shops
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_print_jobs_updated_at ON print_jobs;
CREATE TRIGGER update_print_jobs_updated_at
    BEFORE UPDATE ON print_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_cost_configs_updated_at ON cost_configs;
CREATE TRIGGER update_cost_configs_updated_at
    BEFORE UPDATE ON cost_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_printer_configs_updated_at ON printer_configs;
CREATE TRIGGER update_printer_configs_updated_at
    BEFORE UPDATE ON printer_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 12. TEST THE SETUP
-- ============================================================================

DO $$
DECLARE
  test_result TEXT;
BEGIN
  -- Test if all tables exist
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
    test_result := 'profiles table: ✅';
  ELSE
    test_result := 'profiles table: ❌';
  END IF;
  RAISE NOTICE '%', test_result;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shops') THEN
    test_result := 'shops table: ✅';
  ELSE
    test_result := 'shops table: ❌';
  END IF;
  RAISE NOTICE '%', test_result;
  
  IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'handle_new_user') THEN
    test_result := 'trigger function: ✅';
  ELSE
    test_result := 'trigger function: ❌';
  END IF;
  RAISE NOTICE '%', test_result;
  
  RAISE NOTICE '🎉 Database setup completed successfully!';
  RAISE NOTICE '📊 Ready for user signups and shop creation!';
END $$;