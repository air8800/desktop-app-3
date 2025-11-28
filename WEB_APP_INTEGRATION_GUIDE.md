# 🔗 Desktop & Web App Integration Guide

## Overview
This guide explains how to connect your Xerox Manager Desktop App with your Web App to create a complete print shop management ecosystem.

## Architecture Overview

```
┌─────────────────────┐    Real-time Sync    ┌─────────────────────┐
│   Desktop App       │ ←─────────────────→  │     Web App         │
│   (Shop Owner)      │                      │   (Customers)       │
│                     │                      │                     │
│ • Manage Orders     │                      │ • Place Orders      │
│ • Configure Pricing │                      │ • Upload Files      │
│ • Printer Setup     │                      │ • Make Payments     │
│ • Generate QR       │                      │ • Track Status      │
└─────────────────────┘                      └─────────────────────┘
           │                                            │
           └──────────────── Shared Database ──────────┘
                         (Supabase/Firebase)
```

## Integration Methods

### Method 1: Supabase Integration (Recommended)
**Best for: Production-ready, scalable solution**

#### Setup Steps:
1. **Create Supabase Project**
   - Go to https://supabase.com
   - Create new project: "xerox-shop-system"
   - Note your project URL and anon key

2. **Database Schema**
   ```sql
   -- Shops table
   CREATE TABLE shops (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     name TEXT NOT NULL,
     address TEXT NOT NULL,
     phone TEXT NOT NULL,
     email TEXT,
     owner_id UUID REFERENCES auth.users(id),
     qr_code_url TEXT,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );

   -- Print jobs table
   CREATE TABLE print_jobs (
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

   -- Cost configurations table
   CREATE TABLE cost_configs (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     shop_id UUID REFERENCES shops(id),
     paper_size TEXT NOT NULL,
     color_mode TEXT NOT NULL,
     print_type TEXT NOT NULL,
     base_price DECIMAL(10,2) NOT NULL,
     bulk_tiers JSONB,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );

   -- Printer configurations table
   CREATE TABLE printer_configs (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     shop_id UUID REFERENCES shops(id),
     paper_size TEXT NOT NULL,
     printers JSONB NOT NULL,
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```

3. **Enable Row Level Security**
   ```sql
   ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
   ALTER TABLE print_jobs ENABLE ROW LEVEL SECURITY;
   ALTER TABLE cost_configs ENABLE ROW LEVEL SECURITY;
   ALTER TABLE printer_configs ENABLE ROW LEVEL SECURITY;

   -- Policies
   CREATE POLICY "Shop owners can manage their shops" ON shops
     FOR ALL USING (auth.uid() = owner_id);

   CREATE POLICY "Anyone can view shop info" ON shops
     FOR SELECT USING (true);

   CREATE POLICY "Shop owners can manage their jobs" ON print_jobs
     FOR ALL USING (shop_id IN (SELECT id FROM shops WHERE owner_id = auth.uid()));

   CREATE POLICY "Anyone can create print jobs" ON print_jobs
     FOR INSERT WITH CHECK (true);
   ```

#### Desktop App Integration:
```typescript
// src/utils/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'YOUR_SUPABASE_URL'
const supabaseKey = 'YOUR_SUPABASE_ANON_KEY'

export const supabase = createClient(supabaseUrl, supabaseKey)

// Real-time job listening
export const subscribeToNewJobs = (shopId: string, callback: (job: any) => void) => {
  return supabase
    .channel('print_jobs')
    .on('postgres_changes', 
      { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'print_jobs',
        filter: `shop_id=eq.${shopId}`
      }, 
      callback
    )
    .subscribe()
}

// Sync configurations to database
export const syncCostConfigs = async (shopId: string, configs: any[]) => {
  const { error } = await supabase
    .from('cost_configs')
    .upsert(configs.map(config => ({ ...config, shop_id: shopId })))
  
  if (error) throw error
}
```

#### Web App Integration:
```typescript
// In your web app
import { supabase } from './supabase'

// Get shop info by ID
export const getShopInfo = async (shopId: string) => {
  const { data, error } = await supabase
    .from('shops')
    .select('*')
    .eq('id', shopId)
    .single()
  
  return { data, error }
}

// Submit print job
export const submitPrintJob = async (jobData: any) => {
  const { data, error } = await supabase
    .from('print_jobs')
    .insert(jobData)
    .select()
    .single()
  
  return { data, error }
}

// Get cost configurations
export const getCostConfigs = async (shopId: string) => {
  const { data, error } = await supabase
    .from('cost_configs')
    .select('*')
    .eq('shop_id', shopId)
  
  return { data, error }
}
```

### Method 2: Firebase Integration
**Best for: Google ecosystem integration**

#### Setup Steps:
1. **Create Firebase Project**
   - Go to https://console.firebase.google.com
   - Create project: "xerox-shop-system"
   - Enable Firestore Database

2. **Firestore Structure**
   ```
   shops/{shopId}/
   ├── info/
   │   ├── name: "Shop Name"
   │   ├── address: "Shop Address"
   │   ├── phone: "+91 9876543210"
   │   └── qrCodeUrl: "https://..."
   ├── costConfigs/
   │   └── [array of cost configurations]
   ├── printerConfigs/
   │   └── [array of printer configurations]
   └── printJobs/{jobId}/
       ├── filename: "document.pdf"
       ├── status: "pending"
       ├── customerInfo: {...}
       └── timestamp: "2024-01-01T10:00:00Z"
   ```

3. **Desktop App Firebase Integration**
   ```typescript
   // src/utils/firebase.ts
   import { initializeApp } from 'firebase/app'
   import { getFirestore, collection, onSnapshot, addDoc } from 'firebase/firestore'

   const firebaseConfig = {
     // Your Firebase config
   }

   const app = initializeApp(firebaseConfig)
   export const db = getFirestore(app)

   // Listen for new print jobs
   export const listenForNewJobs = (shopId: string, callback: (jobs: any[]) => void) => {
     const jobsRef = collection(db, `shops/${shopId}/printJobs`)
     return onSnapshot(jobsRef, (snapshot) => {
       const jobs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
       callback(jobs)
     })
   }
   ```

### Method 3: Custom API Integration
**Best for: Full control and custom requirements**

#### Setup Steps:
1. **Create Express.js API Server**
   ```javascript
   // server.js
   const express = require('express')
   const cors = require('cors')
   const WebSocket = require('ws')

   const app = express()
   app.use(cors())
   app.use(express.json())

   // WebSocket for real-time updates
   const wss = new WebSocket.Server({ port: 8080 })

   // API endpoints
   app.post('/api/shops/:shopId/jobs', (req, res) => {
     // Handle new print job
     const job = req.body
     
     // Broadcast to desktop app via WebSocket
     wss.clients.forEach(client => {
       if (client.readyState === WebSocket.OPEN) {
         client.send(JSON.stringify({ type: 'NEW_JOB', data: job }))
       }
     })
     
     res.json({ success: true, jobId: job.id })
   })

   app.listen(3000, () => {
     console.log('API server running on port 3000')
   })
   ```

## Data Flow Examples

### 1. Customer Places Order (Web App → Desktop App)
```typescript
// Web App
const placeOrder = async (orderData) => {
  // 1. Upload file to storage
  const fileUrl = await uploadFile(orderData.file)
  
  // 2. Calculate cost based on shop's pricing
  const cost = await calculateCost(shopId, orderData)
  
  // 3. Create print job
  const job = await supabase.from('print_jobs').insert({
    shop_id: shopId,
    filename: orderData.filename,
    file_url: fileUrl,
    copies: orderData.copies,
    paper_size: orderData.paperSize,
    color_mode: orderData.colorMode,
    print_type: orderData.printType,
    customer_name: orderData.customerName,
    customer_email: orderData.customerEmail,
    total_cost: cost,
    payment_status: 'pending',
    job_status: 'pending'
  })
  
  // 4. Show payment QR code
  showPaymentQR(cost)
}

// Desktop App (automatically receives via real-time subscription)
useEffect(() => {
  const subscription = supabase
    .channel('print_jobs')
    .on('postgres_changes', 
      { event: 'INSERT', schema: 'public', table: 'print_jobs' },
      (payload) => {
        // New job received!
        setJobs(prev => [...prev, payload.new])
        showNotification('New print job received!')
      }
    )
    .subscribe()

  return () => subscription.unsubscribe()
}, [])
```

### 2. Shop Owner Updates Pricing (Desktop App → Web App)
```typescript
// Desktop App
const updateCostConfig = async (newConfig) => {
  // 1. Update local state
  setCostConfigs(newConfig)
  
  // 2. Sync to database
  await supabase.from('cost_configs').upsert({
    shop_id: shopId,
    ...newConfig
  })
  
  // 3. Real-time update to web app happens automatically
}

// Web App (automatically receives updated pricing)
useEffect(() => {
  const fetchPricing = async () => {
    const { data } = await supabase
      .from('cost_configs')
      .select('*')
      .eq('shop_id', shopId)
    
    setPricing(data)
  }
  
  fetchPricing()
  
  // Listen for pricing updates
  const subscription = supabase
    .channel('cost_configs')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'cost_configs' },
      () => fetchPricing()
    )
    .subscribe()

  return () => subscription.unsubscribe()
}, [])
```

## QR Code Integration

### Desktop App Generates QR Code:
```typescript
const generateShopQR = async () => {
  const shopData = {
    shopId: currentShopId,
    webAppUrl: `https://your-web-app.com/shop/${currentShopId}`,
    shopInfo: {
      name: shopInfo.name,
      address: shopInfo.address,
      phone: shopInfo.phone
    }
  }
  
  const qrCode = await QRCode.toDataURL(JSON.stringify(shopData))
  return qrCode
}
```

### Web App Reads QR Code:
```typescript
// When customer scans QR code
const handleQRScan = (qrData) => {
  const shopData = JSON.parse(qrData)
  
  // Redirect to shop's ordering page
  window.location.href = shopData.webAppUrl
}
```

## File Upload & Storage

### Option 1: Supabase Storage
```typescript
// Upload file in web app
const uploadFile = async (file) => {
  const fileName = `${Date.now()}_${file.name}`
  const { data, error } = await supabase.storage
    .from('print-files')
    .upload(fileName, file)
  
  if (error) throw error
  
  const { data: { publicUrl } } = supabase.storage
    .from('print-files')
    .getPublicUrl(fileName)
  
  return publicUrl
}

// Download file in desktop app
const downloadFile = async (fileUrl) => {
  const response = await fetch(fileUrl)
  const blob = await response.blob()
  return blob
}
```

## Deployment Strategy

### Desktop App:
1. **Build for distribution:**
   ```bash
   npm run electron:build
   ```

2. **Auto-updater integration:**
   ```typescript
   // In main.js
   const { autoUpdater } = require('electron-updater')
   
   autoUpdater.checkForUpdatesAndNotify()
   ```

### Web App:
1. **Deploy to Vercel/Netlify:**
   ```bash
   # Build and deploy
   npm run build
   vercel --prod
   ```

2. **Environment variables:**
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

## Security Considerations

1. **API Keys:** Use environment variables, never hardcode
2. **File Upload:** Validate file types and sizes
3. **Authentication:** Implement proper user authentication
4. **Data Validation:** Validate all inputs on both client and server
5. **CORS:** Configure properly for your domains

## Testing Integration

### Test Scenarios:
1. **New Order Flow:** Web app → Database → Desktop app notification
2. **Pricing Updates:** Desktop app → Database → Web app pricing refresh
3. **Job Status Updates:** Desktop app → Database → Web app status display
4. **File Upload/Download:** Web app upload → Desktop app download
5. **Real-time Sync:** Multiple devices connected simultaneously

## Next Steps

1. **Choose your integration method** (Supabase recommended)
2. **Set up the database/backend**
3. **Update both apps with integration code**
4. **Test the complete flow**
5. **Deploy both applications**

Would you like me to implement any specific integration method or help you set up the database schema?