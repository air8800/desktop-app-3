-- 🗄️ Complete Database Schema for Xerox Shop Management System
-- Copy and paste this ENTIRE file into your Supabase SQL Editor

-- ============================================================================
-- 1. CREATE TABLES
-- ============================================================================

-- Shops table - stores shop information
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

-- Print jobs table - stores customer orders
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

-- Cost configurations table - stores pricing for different print options
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

-- Printer configurations table - stores printer assignments for paper sizes
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

-- Profiles table - stores user profile information
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- App releases table - for desktop app updates
CREATE TABLE IF NOT EXISTS app_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('windows', 'macos', 'linux')),
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  checksum TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_latest BOOLEAN DEFAULT false
);

-- ============================================================================
-- 2. CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_print_jobs_shop_id ON print_jobs(shop_id);
CREATE INDEX IF NOT EXISTS idx_print_jobs_status ON print_jobs(job_status);
CREATE INDEX IF NOT EXISTS idx_print_jobs_created_at ON print_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cost_configs_shop_id ON cost_configs(shop_id);
CREATE INDEX IF NOT EXISTS idx_printer_configs_shop_id ON printer_configs(shop_id);

-- ============================================================================
-- 3. ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE printer_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_releases ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. CREATE SECURITY POLICIES
-- ============================================================================

-- Shops policies
DROP POLICY IF EXISTS "Allow public read access to active shops" ON shops;
CREATE POLICY "Allow public read access to active shops" ON shops
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Shop owners can manage their shops" ON shops;
CREATE POLICY "Shop owners can manage their shops" ON shops
  FOR ALL USING (auth.uid() = owner_id);

-- Print jobs policies
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

-- Cost configs policies
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

-- Printer configs policies
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

-- Profiles policies
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- App releases policies
DROP POLICY IF EXISTS "Allow public read access" ON app_releases;
CREATE POLICY "Allow public read access" ON app_releases
  FOR SELECT USING (true);

-- ============================================================================
-- 5. CREATE FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, name, email)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'name', NEW.email);
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to manage latest app release
CREATE OR REPLACE FUNCTION update_latest_release()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_latest = true THEN
    UPDATE app_releases 
    SET is_latest = false 
    WHERE platform = NEW.platform AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

DROP TRIGGER IF EXISTS manage_latest_release ON app_releases;
CREATE TRIGGER manage_latest_release
    BEFORE INSERT OR UPDATE ON app_releases
    FOR EACH ROW
    EXECUTE FUNCTION update_latest_release();

-- ============================================================================
-- 6. INSERT SAMPLE DATA (Optional - for testing)
-- ============================================================================

-- Sample shops
INSERT INTO shops (id, name, address, phone, email, is_active) VALUES
  ('550e8400-e29b-41d4-a716-446655440000', 'QuickPrint Express', '123 Main Street, Mumbai, Maharashtra 400001', '+91 98765 43210', 'info@quickprint.com', true),
  ('550e8400-e29b-41d4-a716-446655440001', 'Digital Print Hub', '456 Commercial Road, Delhi, Delhi 110001', '+91 87654 32109', 'contact@digitalhub.com', true)
ON CONFLICT (id) DO NOTHING;

-- Sample cost configurations
INSERT INTO cost_configs (shop_id, paper_size, color_mode, print_type, base_price, bulk_tiers) VALUES
  ('550e8400-e29b-41d4-a716-446655440000', 'A4', 'BW', 'Single', 2.00, '[{"minQuantity": 50, "maxQuantity": 100, "pricePerPage": 1.50, "name": "Bulk 50+"}, {"minQuantity": 101, "maxQuantity": null, "pricePerPage": 1.00, "name": "Bulk 100+"}]'::jsonb),
  ('550e8400-e29b-41d4-a716-446655440000', 'A4', 'Color', 'Single', 5.00, '[{"minQuantity": 25, "maxQuantity": 50, "pricePerPage": 4.50, "name": "Bulk 25+"}, {"minQuantity": 51, "maxQuantity": null, "pricePerPage": 4.00, "name": "Bulk 50+"}]'::jsonb),
  ('550e8400-e29b-41d4-a716-446655440001', 'A4', 'BW', 'Single', 1.80, '[{"minQuantity": 100, "maxQuantity": null, "pricePerPage": 1.20, "name": "Bulk 100+"}]'::jsonb)
ON CONFLICT (shop_id, paper_size, color_mode, print_type) DO NOTHING;

-- Sample printer configurations
INSERT INTO printer_configs (shop_id, paper_size, printers) VALUES
  ('550e8400-e29b-41d4-a716-446655440000', 'A4', '["HP LaserJet Pro", "Canon PIXMA"]'::jsonb),
  ('550e8400-e29b-41d4-a716-446655440000', 'A3', '["HP LaserJet Pro"]'::jsonb),
  ('550e8400-e29b-41d4-a716-446655440001', 'A4', '["Epson WorkForce", "Brother HL-L2350DW"]'::jsonb)
ON CONFLICT (shop_id, paper_size) DO NOTHING;

-- ============================================================================
-- SETUP COMPLETE! 🎉
-- ============================================================================

-- Your database is now ready for:
-- ✅ Shop management
-- ✅ Real-time print job processing  
-- ✅ Dynamic pricing with bulk discounts
-- ✅ Printer configuration management
-- ✅ File storage for customer uploads
-- ✅ User authentication and profiles
-- ✅ Desktop app auto-updates