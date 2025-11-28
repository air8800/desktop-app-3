/*
  # Add Row Level Security (RLS) for Multi-Tenant Data Isolation
  
  This migration implements industry-standard Row Level Security to ensure:
  - Each shop can only access their own data
  - Print jobs, printers, configs are isolated per shop
  - Defense-in-depth security at the database level
  - Protection against application-level bugs or SQL injection

  ## Security Model
  - Users can only see shops they own (via owner_id)
  - Shop owners can only see data where shop_id matches their shop
  - Profiles are user-specific (tied to auth.users)
  
  ## Tables Protected
  - shops: Users see only shops they own
  - print_jobs: Shop owners see only their jobs
  - printer_configs: Shop owners see only their printers
  - cost_configs: Shop owners see only their pricing
  - profiles: Users see only their own profile
*/

-- ============================================================================
-- 1. ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ============================================================================

-- Enable RLS on shops table
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;

-- Enable RLS on print_jobs table
ALTER TABLE print_jobs ENABLE ROW LEVEL SECURITY;

-- Enable RLS on printer_configs table
ALTER TABLE printer_configs ENABLE ROW LEVEL SECURITY;

-- Enable RLS on cost_configs table
ALTER TABLE cost_configs ENABLE ROW LEVEL SECURITY;

-- Enable RLS on profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. SHOPS TABLE POLICIES
-- ============================================================================

-- Policy: Shop owners can view their own shops
CREATE POLICY "Users can view their own shops"
  ON shops
  FOR SELECT
  USING (auth.uid() = owner_id);

-- Policy: Shop owners can update their own shops
-- WITH CHECK ensures updated row still belongs to the same owner (prevents ownership transfer)
CREATE POLICY "Users can update their own shops"
  ON shops
  FOR UPDATE
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Policy: Authenticated users can create shops
CREATE POLICY "Authenticated users can create shops"
  ON shops
  FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- ============================================================================
-- 3. PRINT JOBS TABLE POLICIES
-- ============================================================================

-- Policy: Shop owners can view their shop's print jobs
CREATE POLICY "Shop owners can view their print jobs"
  ON print_jobs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM shops
      WHERE shops.id = print_jobs.shop_id
      AND shops.owner_id = auth.uid()
    )
  );

-- Policy: Shop owners can insert print jobs for their shop
CREATE POLICY "Shop owners can create print jobs"
  ON print_jobs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM shops
      WHERE shops.id = print_jobs.shop_id
      AND shops.owner_id = auth.uid()
    )
  );

-- Policy: Shop owners can update their shop's print jobs
-- WITH CHECK ensures updated job still belongs to the same shop (prevents cross-shop assignment)
CREATE POLICY "Shop owners can update their print jobs"
  ON print_jobs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM shops
      WHERE shops.id = print_jobs.shop_id
      AND shops.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM shops
      WHERE shops.id = print_jobs.shop_id
      AND shops.owner_id = auth.uid()
    )
  );

-- Policy: Shop owners can delete their shop's print jobs
CREATE POLICY "Shop owners can delete their print jobs"
  ON print_jobs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM shops
      WHERE shops.id = print_jobs.shop_id
      AND shops.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- 4. PRINTER CONFIGS TABLE POLICIES
-- ============================================================================

-- Policy: Shop owners can view their printer configs
CREATE POLICY "Shop owners can view their printer configs"
  ON printer_configs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM shops
      WHERE shops.id = printer_configs.shop_id
      AND shops.owner_id = auth.uid()
    )
  );

-- Policy: Shop owners can create printer configs
CREATE POLICY "Shop owners can create printer configs"
  ON printer_configs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM shops
      WHERE shops.id = printer_configs.shop_id
      AND shops.owner_id = auth.uid()
    )
  );

-- Policy: Shop owners can update their printer configs
-- WITH CHECK ensures updated config still belongs to the same shop (prevents cross-shop assignment)
CREATE POLICY "Shop owners can update their printer configs"
  ON printer_configs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM shops
      WHERE shops.id = printer_configs.shop_id
      AND shops.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM shops
      WHERE shops.id = printer_configs.shop_id
      AND shops.owner_id = auth.uid()
    )
  );

-- Policy: Shop owners can delete their printer configs
CREATE POLICY "Shop owners can delete their printer configs"
  ON printer_configs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM shops
      WHERE shops.id = printer_configs.shop_id
      AND shops.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- 5. COST CONFIGS TABLE POLICIES
-- ============================================================================

-- Policy: Shop owners can view their cost configs
CREATE POLICY "Shop owners can view their cost configs"
  ON cost_configs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM shops
      WHERE shops.id = cost_configs.shop_id
      AND shops.owner_id = auth.uid()
    )
  );

-- Policy: Shop owners can create cost configs
CREATE POLICY "Shop owners can create cost configs"
  ON cost_configs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM shops
      WHERE shops.id = cost_configs.shop_id
      AND shops.owner_id = auth.uid()
    )
  );

-- Policy: Shop owners can update their cost configs
-- WITH CHECK ensures updated config still belongs to the same shop (prevents cross-shop assignment)
CREATE POLICY "Shop owners can update their cost configs"
  ON cost_configs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM shops
      WHERE shops.id = cost_configs.shop_id
      AND shops.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM shops
      WHERE shops.id = cost_configs.shop_id
      AND shops.owner_id = auth.uid()
    )
  );

-- Policy: Shop owners can delete their cost configs
CREATE POLICY "Shop owners can delete their cost configs"
  ON cost_configs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM shops
      WHERE shops.id = cost_configs.shop_id
      AND shops.owner_id = auth.uid()
    )
  );

-- ============================================================================
-- 6. PROFILES TABLE POLICIES
-- ============================================================================

-- Policy: Users can view their own profile
CREATE POLICY "Users can view their own profile"
  ON profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Policy: Users can update their own profile
-- WITH CHECK ensures updated profile still belongs to the same user (prevents profile hijacking)
CREATE POLICY "Users can update their own profile"
  ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy: Users can insert their own profile
CREATE POLICY "Users can insert their own profile"
  ON profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ============================================================================
-- 7. CREATE HELPER FUNCTION FOR GETTING USER'S SHOP ID
-- ============================================================================

-- Function to get the current user's shop ID
-- This is useful for application queries to simplify getting shop_id
CREATE OR REPLACE FUNCTION get_user_shop_id()
RETURNS UUID AS $$
DECLARE
  user_shop_id UUID;
BEGIN
  SELECT id INTO user_shop_id
  FROM shops
  WHERE owner_id = auth.uid()
  AND is_active = true
  LIMIT 1;
  
  RETURN user_shop_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 8. VERIFICATION AND SUMMARY
-- ============================================================================

DO $$
DECLARE
  shops_rls BOOLEAN;
  print_jobs_rls BOOLEAN;
  printer_configs_rls BOOLEAN;
  cost_configs_rls BOOLEAN;
  profiles_rls BOOLEAN;
BEGIN
  -- Check RLS status
  SELECT relrowsecurity INTO shops_rls
  FROM pg_class WHERE relname = 'shops';
  
  SELECT relrowsecurity INTO print_jobs_rls
  FROM pg_class WHERE relname = 'print_jobs';
  
  SELECT relrowsecurity INTO printer_configs_rls
  FROM pg_class WHERE relname = 'printer_configs';
  
  SELECT relrowsecurity INTO cost_configs_rls
  FROM pg_class WHERE relname = 'cost_configs';
  
  SELECT relrowsecurity INTO profiles_rls
  FROM pg_class WHERE relname = 'profiles';

  RAISE NOTICE '============================================';
  RAISE NOTICE '🔒 ROW LEVEL SECURITY MIGRATION COMPLETE!';
  RAISE NOTICE '============================================';
  RAISE NOTICE '';
  RAISE NOTICE '✅ RLS Enabled on Tables:';
  RAISE NOTICE '   - shops: %', CASE WHEN shops_rls THEN 'ENABLED' ELSE 'DISABLED' END;
  RAISE NOTICE '   - print_jobs: %', CASE WHEN print_jobs_rls THEN 'ENABLED' ELSE 'DISABLED' END;
  RAISE NOTICE '   - printer_configs: %', CASE WHEN printer_configs_rls THEN 'ENABLED' ELSE 'DISABLED' END;
  RAISE NOTICE '   - cost_configs: %', CASE WHEN cost_configs_rls THEN 'ENABLED' ELSE 'DISABLED' END;
  RAISE NOTICE '   - profiles: %', CASE WHEN profiles_rls THEN 'ENABLED' ELSE 'DISABLED' END;
  RAISE NOTICE '';
  RAISE NOTICE '🛡️ Security Features:';
  RAISE NOTICE '   - Multi-tenant data isolation';
  RAISE NOTICE '   - Shop owners can only access their own data';
  RAISE NOTICE '   - Database-level access control';
  RAISE NOTICE '   - Protection against application bugs';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Data Isolation:';
  RAISE NOTICE '   - Each shop is completely isolated';
  RAISE NOTICE '   - Print jobs isolated by shop_id';
  RAISE NOTICE '   - Printer configs isolated by shop_id';
  RAISE NOTICE '   - Cost configs isolated by shop_id';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 Your system now has industry-level security!';
  RAISE NOTICE '============================================';
END $$;
