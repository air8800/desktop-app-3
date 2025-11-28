# 🔗 Complete Desktop & Web App Integration Instructions

## 🎯 **SIMPLE ANSWER: Users DON'T need to connect to Supabase every time!**

### **How It Works:**
1. **You set up Supabase once** (using your existing account)
2. **I integrate your credentials** into both apps
3. **Users download and use** - everything works automatically!

---

## 📋 **FOR YOU TO DO (One-Time Setup):**

### **Step 1: Get Your Supabase Credentials**
1. Go to your Supabase dashboard: https://supabase.com/dashboard
2. Select your project (or create new one: "xerox-shop-system")
3. Go to **Settings** → **API**
4. Copy these two values:
   - **Project URL**: `https://your-project.supabase.co`
   - **Anon public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### **Step 2: Set Up Database Tables**
Go to **SQL Editor** in Supabase and run this:

```sql
-- Create shops table
CREATE TABLE IF NOT EXISTS shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  owner_id UUID,
  qr_code_url TEXT,
  google_maps_link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create print jobs table
CREATE TABLE IF NOT EXISTS print_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES shops(id),
  filename TEXT NOT NULL,
  file_url TEXT NOT NULL,
  copies INTEGER NOT NULL,
  paper_size TEXT NOT NULL,
  color_mode TEXT NOT NULL,
  print_type TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  total_cost DECIMAL(10,2),
  payment_status TEXT DEFAULT 'pending',
  job_status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create cost configurations table
CREATE TABLE IF NOT EXISTS cost_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES shops(id),
  paper_size TEXT NOT NULL,
  color_mode TEXT NOT NULL,
  print_type TEXT NOT NULL,
  base_price DECIMAL(10,2) NOT NULL,
  bulk_tiers JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create printer configurations table
CREATE TABLE IF NOT EXISTS printer_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID REFERENCES shops(id),
  paper_size TEXT NOT NULL,
  printers JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE print_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE printer_configs ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (customers can place orders)
CREATE POLICY "Anyone can view shops" ON shops FOR SELECT USING (true);
CREATE POLICY "Anyone can create print jobs" ON print_jobs FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can view cost configs" ON cost_configs FOR SELECT USING (true);
CREATE POLICY "Anyone can view printer configs" ON printer_configs FOR SELECT USING (true);

-- Shop owners can manage their data
CREATE POLICY "Shop owners can manage shops" ON shops 
  FOR ALL USING (auth.uid()::text = owner_id::text);

CREATE POLICY "Shop owners can manage jobs" ON print_jobs 
  FOR ALL USING (shop_id IN (SELECT id FROM shops WHERE owner_id::text = auth.uid()::text));

CREATE POLICY "Shop owners can manage cost configs" ON cost_configs 
  FOR ALL USING (shop_id IN (SELECT id FROM shops WHERE owner_id::text = auth.uid()::text));

CREATE POLICY "Shop owners can manage printer configs" ON printer_configs 
  FOR ALL USING (shop_id IN (SELECT id FROM shops WHERE owner_id::text = auth.uid()::text));
```

### **Step 3: Enable File Storage**
1. Go to **Storage** in Supabase
2. Create a new bucket called `print-files`
3. Make it **public** so customers can upload files

### **Step 4: Share Your Credentials**
Send me your:
- **Supabase URL**
- **Supabase Anon Key**

---

## 🖥️ **INSTRUCTIONS FOR DESKTOP APP PROJECT (This Project):**

I've already integrated Supabase into your desktop app! Once you share your credentials:

1. **I'll update the connection** with your real Supabase details
2. **Test the integration** to make sure everything works
3. **Your desktop app will automatically:**
   - Sync pricing to web app in real-time
   - Receive notifications when customers place orders
   - Download files from customer orders
   - Update job status that customers can see

---

## 📱 **INSTRUCTIONS FOR WEB APP PROJECT (Your Other Project):**

**Copy and paste this EXACT code into your web app project:**

### **1. Install Supabase in Web App:**
```bash
npm install @supabase/supabase-js
```

### **2. Create `src/utils/supabase.js` in Web App:**
```javascript
import { createClient } from '@supabase/supabase-js'

// Replace with YOUR actual Supabase credentials
const supabaseUrl = 'https://your-project.supabase.co'
const supabaseKey = 'your-supabase-anon-key'

export const supabase = createClient(supabaseUrl, supabaseKey)

// Get shop information by ID
export const getShopInfo = async (shopId) => {
  const { data, error } = await supabase
    .from('shops')
    .select('*')
    .eq('id', shopId)
    .single()
  
  return { data, error }
}

// Get pricing for a shop
export const getShopPricing = async (shopId) => {
  const { data, error } = await supabase
    .from('cost_configs')
    .select('*')
    .eq('shop_id', shopId)
  
  return { data, error }
}

// Calculate order cost
export const calculateCost = async (shopId, orderData) => {
  const { data: configs, error } = await getShopPricing(shopId)
  
  if (error || !configs) {
    return { cost: 0, error }
  }
  
  const matchingConfig = configs.find(config => 
    config.paper_size === orderData.paperSize &&
    config.color_mode === orderData.colorMode &&
    config.print_type === orderData.printType
  )
  
  if (!matchingConfig) {
    return { cost: 0, error: 'No pricing found' }
  }
  
  let pricePerPage = matchingConfig.base_price
  
  // Check bulk pricing
  if (matchingConfig.bulk_tiers && matchingConfig.bulk_tiers.length > 0) {
    const tier = matchingConfig.bulk_tiers.find(t => 
      orderData.copies >= t.minQuantity && 
      (t.maxQuantity === null || orderData.copies <= t.maxQuantity)
    )
    
    if (tier) {
      pricePerPage = tier.pricePerPage
    }
  }
  
  return { cost: pricePerPage * orderData.copies, pricePerPage }
}

// Upload file
export const uploadFile = async (file, shopId) => {
  const fileName = `${shopId}/${Date.now()}_${file.name}`
  
  const { data, error } = await supabase.storage
    .from('print-files')
    .upload(fileName, file)
  
  if (error) return { data: null, error }
  
  const { data: { publicUrl } } = supabase.storage
    .from('print-files')
    .getPublicUrl(fileName)
  
  return { data: { path: data.path, publicUrl }, error: null }
}

// Submit print job
export const submitPrintJob = async (jobData) => {
  const { data, error } = await supabase
    .from('print_jobs')
    .insert(jobData)
    .select()
    .single()
  
  return { data, error }
}

// Get job status
export const getJobStatus = async (jobId) => {
  const { data, error } = await supabase
    .from('print_jobs')
    .select('job_status, payment_status')
    .eq('id', jobId)
    .single()
  
  return { data, error }
}

// Listen for job updates
export const subscribeToJobUpdates = (jobId, callback) => {
  return supabase
    .channel('job_updates')
    .on('postgres_changes', 
      { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'print_jobs',
        filter: `id=eq.${jobId}`
      }, 
      (payload) => callback(payload.new)
    )
    .subscribe()
}
```

### **3. Create Order Page in Web App:**
```javascript
// src/pages/OrderPage.jsx
import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { getShopInfo, getShopPricing, calculateCost, uploadFile, submitPrintJob } from '../utils/supabase'

const OrderPage = () => {
  const { shopId } = useParams()
  const [shop, setShop] = useState(null)
  const [pricing, setPricing] = useState([])
  const [orderData, setOrderData] = useState({
    file: null,
    filename: '',
    copies: 1,
    paperSize: 'A4',
    colorMode: 'BW',
    printType: 'Single',
    customerName: '',
    customerEmail: '',
    customerPhone: ''
  })
  const [cost, setCost] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    loadShopData()
  }, [shopId])

  useEffect(() => {
    if (pricing.length > 0) {
      calculateOrderCost()
    }
  }, [orderData.copies, orderData.paperSize, orderData.colorMode, orderData.printType, pricing])

  const loadShopData = async () => {
    const [shopResult, pricingResult] = await Promise.all([
      getShopInfo(shopId),
      getShopPricing(shopId)
    ])

    if (shopResult.data) setShop(shopResult.data)
    if (pricingResult.data) setPricing(pricingResult.data)
  }

  const calculateOrderCost = async () => {
    const result = await calculateCost(shopId, orderData)
    setCost(result.cost || 0)
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setOrderData(prev => ({
        ...prev,
        file,
        filename: file.name
      }))
    }
  }

  const handleSubmitOrder = async () => {
    if (!orderData.file || !orderData.customerName) {
      alert('Please fill all required fields')
      return
    }

    setIsSubmitting(true)

    try {
      // 1. Upload file
      const fileResult = await uploadFile(orderData.file, shopId)
      if (fileResult.error) throw fileResult.error

      // 2. Submit order
      const jobData = {
        shop_id: shopId,
        filename: orderData.filename,
        file_url: fileResult.data.publicUrl,
        copies: orderData.copies,
        paper_size: orderData.paperSize,
        color_mode: orderData.colorMode,
        print_type: orderData.printType,
        customer_name: orderData.customerName,
        customer_email: orderData.customerEmail,
        customer_phone: orderData.customerPhone,
        total_cost: cost,
        payment_status: 'pending',
        job_status: 'pending'
      }

      const jobResult = await submitPrintJob(jobData)
      if (jobResult.error) throw jobResult.error

      alert('Order placed successfully! Job ID: ' + jobResult.data.id)
      
      // Redirect to payment or status page
      // window.location.href = `/payment/${jobResult.data.id}`

    } catch (error) {
      console.error('Error submitting order:', error)
      alert('Failed to submit order: ' + error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!shop) {
    return <div>Loading shop information...</div>
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">{shop.name}</h1>
      <p className="text-gray-600 mb-8">{shop.address}</p>

      <div className="space-y-6">
        {/* File Upload */}
        <div>
          <label className="block text-sm font-medium mb-2">Upload Document</label>
          <input
            type="file"
            onChange={handleFileChange}
            accept=".pdf,.doc,.docx,.jpg,.png"
            className="w-full p-3 border rounded-lg"
            required
          />
        </div>

        {/* Print Options */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Copies</label>
            <input
              type="number"
              min="1"
              value={orderData.copies}
              onChange={(e) => setOrderData(prev => ({ ...prev, copies: parseInt(e.target.value) }))}
              className="w-full p-3 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Paper Size</label>
            <select
              value={orderData.paperSize}
              onChange={(e) => setOrderData(prev => ({ ...prev, paperSize: e.target.value }))}
              className="w-full p-3 border rounded-lg"
            >
              <option value="A4">A4</option>
              <option value="A3">A3</option>
              <option value="Letter">Letter</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Color</label>
            <select
              value={orderData.colorMode}
              onChange={(e) => setOrderData(prev => ({ ...prev, colorMode: e.target.value }))}
              className="w-full p-3 border rounded-lg"
            >
              <option value="BW">Black & White</option>
              <option value="Color">Color</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Print Type</label>
            <select
              value={orderData.printType}
              onChange={(e) => setOrderData(prev => ({ ...prev, printType: e.target.value }))}
              className="w-full p-3 border rounded-lg"
            >
              <option value="Single">Single Sided</option>
              <option value="Double">Double Sided</option>
            </select>
          </div>
        </div>

        {/* Customer Info */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Your Name</label>
            <input
              type="text"
              value={orderData.customerName}
              onChange={(e) => setOrderData(prev => ({ ...prev, customerName: e.target.value }))}
              className="w-full p-3 border rounded-lg"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Phone Number</label>
            <input
              type="tel"
              value={orderData.customerPhone}
              onChange={(e) => setOrderData(prev => ({ ...prev, customerPhone: e.target.value }))}
              className="w-full p-3 border rounded-lg"
            />
          </div>
        </div>

        {/* Cost Display */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="text-lg font-medium">Total Cost:</span>
            <span className="text-2xl font-bold text-blue-600">₹{cost}</span>
          </div>
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmitOrder}
          disabled={isSubmitting}
          className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Placing Order...' : 'Place Order'}
        </button>
      </div>
    </div>
  )
}

export default OrderPage
```

### **4. Add Routing in Web App:**
```javascript
// src/App.jsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import OrderPage from './pages/OrderPage'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/shop/:shopId" element={<OrderPage />} />
        {/* Add other routes */}
      </Routes>
    </Router>
  )
}

export default App
```

---

## 🔄 **HOW IT WORKS:**

### **Real-Time Flow:**
```
Customer (Web App)          →  Supabase  →  Desktop App
─────────────────────────────────────────────────────────

1. Scans QR code           →  Gets shop info
2. Places order           →  Order saved    →  🔔 Notification!
3. Makes payment          →  Status updated →  🔔 Payment alert!
4. Waits for completion   →  Status synced  →  Owner marks done
5. Gets completion alert  ←  Status updated ←  🔔 Order complete!
```

### **For Users:**
- **Shop Owners**: Download desktop app → Sign up → Start using
- **Customers**: Scan QR → Upload file → Place order → Pay → Done!

---

## 🚀 **NEXT STEPS:**

1. **Share your Supabase credentials** with me
2. **I'll configure your desktop app** with real connection
3. **You paste the web app code** into your other project
4. **Test the complete flow** together
5. **Deploy both apps** and start getting customers!

**Ready?** Just share your Supabase URL and anon key! 🎯