import { createClient } from '@supabase/supabase-js'

// ✅ YOUR ACTUAL SUPABASE CREDENTIALS - NOW CONNECTED!
const supabaseUrl = 'https://nnqqdlrarfdjmyjsxxrw.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ucXFkbHJhcmZkam15anN4eHJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwMDI2MDQsImV4cCI6MjA2MjU3ODYwNH0.5E4Mbxtl4VlsKk71o6usEfwGjpHAaE9QAegL9LYYsWw'

export const supabase = createClient(supabaseUrl, supabaseKey)

// Types for our database
export interface Shop {
  id: string
  name: string
  address: string
  phone: string
  email?: string
  owner_id?: string
  qr_code_url?: string
  google_maps_link?: string
  is_active?: boolean
  operating_hours?: any
  payment_info?: any
  business_details?: any
  created_at: string
  updated_at: string
}

export interface PrintJob {
  id: string
  shop_id: string
  filename: string
  file_url: string
  copies: number
  paper_size: string
  color_mode: string
  print_type: string
  nup_pages: number
  nup_orientation: string
  customer_name: string
  customer_email?: string
  customer_phone?: string
  total_cost: number
  payment_status: 'pending' | 'paid' | 'failed'
  job_status: 'pending' | 'printing' | 'completed' | 'cancelled'
  notes?: string
  estimated_completion?: string
  created_at: string
  updated_at: string
}

export interface CostConfig {
  id: string
  shop_id: string
  paper_size: string
  color_mode: string
  print_type: string
  base_price: number
  bulk_tiers: any[]
  is_active?: boolean
  created_at: string
  updated_at: string
}

export interface PrinterConfig {
  id: string
  shop_id: string
  paper_size: string
  printers: string[]
  is_available?: boolean
  created_at: string
  updated_at: string
}

// ============================================================================
// SHOP MANAGEMENT FUNCTIONS
// ============================================================================

export const createShop = async (shopData: Partial<Shop>) => {
  const { data, error } = await supabase
    .from('shops')
    .insert(shopData)
    .select()
    .single()
  
  return { data, error }
}

export const getShop = async (shopId: string) => {
  const { data, error } = await supabase
    .from('shops')
    .select('*')
    .eq('id', shopId)
    .single()
  
  return { data, error }
}

export const updateShop = async (shopId: string, updates: Partial<Shop>) => {
  const { data, error } = await supabase
    .from('shops')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', shopId)
    .select()
    .single()
  
  return { data, error }
}

export const getShopByOwnerId = async (ownerId: string) => {
  const { data, error } = await supabase
    .from('shops')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('is_active', true)
    .single()
  
  return { data, error }
}

export const getAllShops = async () => {
  const { data, error } = await supabase
    .from('shops')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  
  return { data, error }
}

// ============================================================================
// PRINT JOB FUNCTIONS
// ============================================================================

export const createPrintJob = async (jobData: Partial<PrintJob>) => {
  const { data, error } = await supabase
    .from('print_jobs')
    .insert(jobData)
    .select()
    .single()
  
  return { data, error }
}

export const getPrintJobs = async (shopId: string) => {
  const { data, error } = await supabase
    .from('print_jobs')
    .select('*')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })
  
  return { data, error }
}

export const updatePrintJob = async (jobId: string, updates: Partial<PrintJob>) => {
  const { data, error } = await supabase
    .from('print_jobs')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', jobId)
    .select()
    .single()
  
  return { data, error }
}

export const getPrintJobById = async (jobId: string) => {
  const { data, error } = await supabase
    .from('print_jobs')
    .select('*')
    .eq('id', jobId)
    .single()
  
  return { data, error }
}

// Delete print job
export const deletePrintJob = async (jobId: string) => {
  const { data, error } = await supabase
    .from('print_jobs')
    .delete()
    .eq('id', jobId)
  
  return { data, error }
}

// ============================================================================
// 🔥 FIXED: ENHANCED COST CONFIGURATION FUNCTIONS WITH PROPER BULK TIERS
// ============================================================================

export const syncCostConfigs = async (shopId: string, configs: any[]) => {
  try {
    console.log('🔄 Starting cost config sync...', { shopId, configCount: configs.length })
    
    // First, delete existing configs for this shop
    const { error: deleteError } = await supabase
      .from('cost_configs')
      .delete()
      .eq('shop_id', shopId)

    if (deleteError) {
      console.error('❌ Error deleting existing configs:', deleteError)
      return { success: false, error: deleteError.message }
    }

    console.log('✅ Existing configs deleted')

    // Then insert new configs with properly formatted bulk tiers
    const configsToInsert = configs.map(config => {
      // 🔥 FIXED: Properly format bulk tiers for database
      const formattedBulkTiers = config.tiers ? config.tiers.map((tier: any) => ({
        id: tier.id,
        name: tier.name,
        minQuantity: tier.minQuantity,
        maxQuantity: tier.maxQuantity,
        pricePerPage: tier.pricePerPage
      })) : []

      console.log('📊 Formatting config:', {
        paperSize: config.paperSize,
        colorMode: config.colorMode,
        printType: config.printType,
        basePrice: config.basePricePerPage,
        tiersCount: formattedBulkTiers.length,
        tiers: formattedBulkTiers
      })

      return {
        shop_id: shopId,
        paper_size: config.paperSize,
        color_mode: config.colorMode,
        print_type: config.printType,
        base_price: config.basePricePerPage,
        bulk_tiers: formattedBulkTiers, // 🔥 FIXED: Properly formatted bulk tiers
        is_active: true
      }
    })

    console.log('📊 Configs to insert:', configsToInsert)

    if (configsToInsert.length > 0) {
      const { data, error } = await supabase
        .from('cost_configs')
        .insert(configsToInsert)
        .select()
      
      if (error) {
        console.error('❌ Error inserting new configs:', error)
        return { success: false, error: error.message }
      }

      console.log('✅ New configs inserted successfully:', data)
      return { success: true, data }
    }

    console.log('✅ No configs to insert, sync complete')
    return { success: true, data: [] }
  } catch (error) {
    console.error('❌ Error syncing cost configs:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export const getCostConfigs = async (shopId: string) => {
  console.log('📊 Fetching cost configs for shop:', shopId)
  
  const { data, error } = await supabase
    .from('cost_configs')
    .select('*')
    .eq('shop_id', shopId)
    .eq('is_active', true)
  
  if (error) {
    console.error('❌ Error fetching cost configs:', error)
  } else {
    console.log('✅ Cost configs fetched:', data?.length || 0, 'configs')
    // Log the bulk tiers to verify they're properly stored
    data?.forEach(config => {
      console.log(`📊 Config ${config.paper_size}-${config.color_mode}-${config.print_type}:`, {
        basePrice: config.base_price,
        bulkTiers: config.bulk_tiers
      })
    })
  }
  
  return { data, error }
}

// ============================================================================
// 🔥 ENHANCED PRINTER CONFIGURATION FUNCTIONS
// ============================================================================

export const syncPrinterConfigs = async (shopId: string, configs: any[]) => {
  try {
    console.log('🔄 Starting printer config sync...', { shopId, configCount: configs.length })
    
    // First, delete existing configs for this shop
    const { error: deleteError } = await supabase
      .from('printer_configs')
      .delete()
      .eq('shop_id', shopId)

    if (deleteError) {
      console.error('❌ Error deleting existing printer configs:', deleteError)
      return { success: false, error: deleteError.message }
    }

    console.log('✅ Existing printer configs deleted')

    // Then insert new configs
    const configsToInsert = configs.map(config => ({
      shop_id: shopId,
      paper_size: config.paperSize,
      printers: config.printers || [],
      is_available: true
    }))

    console.log('🖨️ Printer configs to insert:', configsToInsert)

    if (configsToInsert.length > 0) {
      const { data, error } = await supabase
        .from('printer_configs')
        .insert(configsToInsert)
        .select()
      
      if (error) {
        console.error('❌ Error inserting new printer configs:', error)
        return { success: false, error: error.message }
      }

      console.log('✅ New printer configs inserted successfully:', data)
      return { success: true, data }
    }

    console.log('✅ No printer configs to insert, sync complete')
    return { success: true, data: [] }
  } catch (error) {
    console.error('❌ Error syncing printer configs:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export const getPrinterConfigs = async (shopId: string) => {
  console.log('🖨️ Fetching printer configs for shop:', shopId)
  
  const { data, error } = await supabase
    .from('printer_configs')
    .select('*')
    .eq('shop_id', shopId)
    .eq('is_available', true)
  
  if (error) {
    console.error('❌ Error fetching printer configs:', error)
  } else {
    console.log('✅ Printer configs fetched:', data?.length || 0, 'configs')
  }
  
  return { data, error }
}

// ============================================================================
// 🔥 NEW: PAYMENT INFORMATION FUNCTIONS
// ============================================================================

export const syncPaymentInfo = async (shopId: string, paymentInfo: any) => {
  try {
    console.log('🔄 Syncing payment info to database...', { shopId, paymentInfo })
    
    const { data, error } = await supabase
      .from('shops')
      .update({ 
        payment_info: paymentInfo,
        updated_at: new Date().toISOString()
      })
      .eq('id', shopId)
      .select()
      .single()
    
    if (error) {
      console.error('❌ Error syncing payment info:', error)
      return { success: false, error: error.message }
    }

    console.log('✅ Payment info synced successfully:', data)
    return { success: true, data }
  } catch (error) {
    console.error('❌ Error syncing payment info:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export const syncBusinessDetails = async (shopId: string, businessDetails: any) => {
  try {
    console.log('🔄 Syncing business details to database...', { shopId, businessDetails })
    
    const { data, error } = await supabase
      .from('shops')
      .update({ 
        business_details: businessDetails,
        updated_at: new Date().toISOString()
      })
      .eq('id', shopId)
      .select()
      .single()
    
    if (error) {
      console.error('❌ Error syncing business details:', error)
      return { success: false, error: error.message }
    }

    console.log('✅ Business details synced successfully:', data)
    return { success: true, data }
  } catch (error) {
    console.error('❌ Error syncing business details:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// ============================================================================
// 🔥 ENHANCED: REAL-TIME SUBSCRIPTIONS WITH ROBUST ERROR HANDLING
// ============================================================================

export const subscribeToNewJobs = (shopId: string, callback: (job: PrintJob) => void) => {
  console.log('🔔 Setting up real-time subscription for shop:', shopId)
  
  // Create a unique channel name to avoid conflicts
  const channelName = `print_jobs_${shopId}_${Date.now()}`
  
  const channel = supabase
    .channel(channelName)
    .on('postgres_changes', 
      { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'print_jobs',
        filter: `shop_id=eq.${shopId}`
      }, 
      (payload) => {
        console.log('🔔 NEW PRINT JOB RECEIVED:', payload.new)
        callback(payload.new as PrintJob)
        
        // Show desktop notification if available
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('New Print Job!', {
            body: `${payload.new.customer_name} ordered ${payload.new.copies} copies of ${payload.new.filename}`,
            icon: '/icon.png'
          })
        }
      }
    )
    .subscribe((status) => {
      console.log('📡 Subscription status:', status)
      if (status === 'SUBSCRIBED') {
        console.log('✅ Successfully subscribed to real-time updates')
      } else if (status === 'CHANNEL_ERROR') {
        console.error('❌ Channel subscription error')
      } else if (status === 'TIMED_OUT') {
        console.error('❌ Subscription timed out')
      } else if (status === 'CLOSED') {
        console.log('📡 Subscription closed')
      }
    })

  return channel
}

export const subscribeToJobUpdates = (shopId: string, callback: (job: PrintJob) => void) => {
  const channelName = `job_updates_${shopId}_${Date.now()}`
  
  return supabase
    .channel(channelName)
    .on('postgres_changes', 
      { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'print_jobs',
        filter: `shop_id=eq.${shopId}`
      }, 
      (payload) => {
        console.log('📝 JOB STATUS UPDATED:', payload.new)
        callback(payload.new as PrintJob)
      }
    )
    .subscribe((status) => {
      console.log('📡 Job updates subscription status:', status)
    })
}

export const subscribeToAllJobChanges = (shopId: string, callback: (job: PrintJob, event: string) => void) => {
  const channelName = `all_job_changes_${shopId}_${Date.now()}`
  
  return supabase
    .channel(channelName)
    .on('postgres_changes', 
      { 
        event: '*', 
        schema: 'public', 
        table: 'print_jobs',
        filter: `shop_id=eq.${shopId}`
      }, 
      (payload) => {
        console.log('🔄 JOB CHANGE:', payload.eventType, payload.new)
        callback(payload.new as PrintJob, payload.eventType)
      }
    )
    .subscribe((status) => {
      console.log('📡 All job changes subscription status:', status)
    })
}

// ============================================================================
// FILE STORAGE FUNCTIONS
// ============================================================================

export const uploadFile = async (file: File, shopId: string) => {
  const fileName = `${shopId}/${Date.now()}_${file.name}`
  
  const { data, error } = await supabase.storage
    .from('print-files')
    .upload(fileName, file)
  
  if (error) {
    console.error('File upload error:', error)
    return { data: null, error }
  }
  
  const { data: { publicUrl } } = supabase.storage
    .from('print-files')
    .getPublicUrl(fileName)
  
  // 🚀 OPTIMIZATION: Start preloading PDF in background (non-blocking)
  // Upload completes immediately, PDF caches in background for faster subsequent views
  if (file.type === 'application/pdf' && publicUrl) {
    console.log('🚀 Starting background PDF preload:', publicUrl)
    import('./pdfUtils').then(({ preloadPdf }) => {
      preloadPdf(publicUrl)
    }).catch(err => {
      console.warn('⚠️ Background preload failed:', err)
    })
  }
  
  return { data: { path: data.path, publicUrl }, error: null }
}

export const downloadFile = async (filePath: string) => {
  const { data, error } = await supabase.storage
    .from('print-files')
    .download(filePath)
  
  return { data, error }
}

export const getFileUrl = (filePath: string) => {
  const { data } = supabase.storage
    .from('print-files')
    .getPublicUrl(filePath)
  
  return data.publicUrl
}

// ============================================================================
// COST CALCULATION FUNCTIONS
// ============================================================================

export const calculateOrderCost = async (shopId: string, orderData: {
  paperSize: string
  colorMode: string
  printType: string
  copies: number
}) => {
  const { data: configs, error } = await getCostConfigs(shopId)
  
  if (error || !configs) {
    console.error('Error getting cost configs:', error)
    return { cost: 0, error, pricePerPage: 0, tier: null }
  }
  
  const matchingConfig = configs.find(config => 
    config.paper_size === orderData.paperSize &&
    config.color_mode === orderData.colorMode &&
    config.print_type === orderData.printType
  )
  
  if (!matchingConfig) {
    return { 
      cost: 0, 
      error: 'No pricing configuration found for this combination', 
      pricePerPage: 0, 
      tier: null 
    }
  }
  
  let pricePerPage = matchingConfig.base_price
  let appliedTier = null
  
  // 🔥 FIXED: Check for bulk pricing tiers with proper structure
  if (matchingConfig.bulk_tiers && Array.isArray(matchingConfig.bulk_tiers) && matchingConfig.bulk_tiers.length > 0) {
    console.log('📊 Checking bulk tiers for', orderData.copies, 'copies:', matchingConfig.bulk_tiers)
    
    const applicableTier = matchingConfig.bulk_tiers
      .filter((tier: any) => orderData.copies >= tier.minQuantity)
      .filter((tier: any) => tier.maxQuantity === null || orderData.copies <= tier.maxQuantity)
      .sort((a: any, b: any) => b.minQuantity - a.minQuantity)[0] // Get the highest applicable tier
    
    if (applicableTier) {
      pricePerPage = applicableTier.pricePerPage
      appliedTier = applicableTier
      console.log('✅ Applied bulk tier:', applicableTier)
    }
  }
  
  const totalCost = pricePerPage * orderData.copies
  
  return { 
    cost: totalCost, 
    error: null, 
    pricePerPage, 
    tier: appliedTier,
    basePrice: matchingConfig.base_price,
    savings: appliedTier ? (matchingConfig.base_price - pricePerPage) * orderData.copies : 0
  }
}

// ============================================================================
// CONNECTION TESTING
// ============================================================================

export const testConnection = async () => {
  try {
    console.log('🔍 Testing Supabase connection...')
    
    const { data, error } = await supabase
      .from('shops')
      .select('count')
      .limit(1)
    
    if (error) {
      console.error('❌ Connection test failed:', error)
      return { success: false, error: error.message }
    }
    
    console.log('✅ Supabase connection successful!')
    return { success: true, error: null }
  } catch (error) {
    console.error('❌ Connection test error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// ============================================================================
// NOTIFICATION HELPERS
// ============================================================================

export const requestNotificationPermission = async () => {
  if ('Notification' in window) {
    const permission = await Notification.requestPermission()
    return permission === 'granted'
  }
  return false
}

export const showNotification = (title: string, options?: NotificationOptions) => {
  if ('Notification' in window && Notification.permission === 'granted') {
    return new Notification(title, {
      icon: '/icon.png',
      badge: '/icon.png',
      ...options
    })
  }
}

// ============================================================================
// 🔥 FIXED: SHOP DATA SYNC FUNCTIONS
// ============================================================================

// Create or update shop with existing shop ID
export const createOrUpdateShopWithId = async (shopId: string, shopData: any, ownerId?: string) => {
  try {
    console.log('🏪 Creating/updating shop in database with ID:', shopId)
    
    // First try to update existing shop
    const { data: existingShop } = await getShop(shopId)
    
    const shopRecord = {
      id: shopId,
      name: shopData.name,
      address: shopData.address,
      phone: shopData.phone,
      email: shopData.email || null,
      google_maps_link: shopData.googleMapsLink || null,
      owner_id: ownerId || null,
      is_active: true
    }

    if (existingShop) {
      // Update existing shop
      const { data, error } = await updateShop(shopId, shopRecord)
      if (error) throw error
      console.log('✅ Shop updated in database:', data)
      return { success: true, data }
    } else {
      // Create new shop with specific ID
      const { data, error } = await supabase
        .from('shops')
        .insert(shopRecord)
        .select()
        .single()
      
      if (error) throw error
      console.log('✅ Shop created in database:', data)
      return { success: true, data }
    }
  } catch (error) {
    console.error('❌ Error creating/updating shop:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// Sync shop info to database (for existing shops)
export const syncShopInfoToDatabase = async (shopId: string, shopInfo: any, ownerId?: string) => {
  try {
    console.log('🔄 Syncing shop info to database for shop:', shopId)
    
    const result = await createOrUpdateShopWithId(shopId, shopInfo, ownerId)
    
    if (result.success) {
      console.log('✅ Shop info synced to database successfully!')
      return { success: true, data: result.data }
    } else {
      console.error('❌ Error syncing shop info:', result.error)
      return { success: false, error: result.error }
    }
  } catch (error) {
    console.error('❌ Error syncing shop info:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// Debug function to check what's in the database
export const debugDatabaseContents = async () => {
  try {
    console.log('🔍 Checking database contents...')
    
    const { data: shops, error } = await getAllShops()
    
    if (error) {
      console.error('❌ Error fetching shops:', error)
      return
    }
    
    console.log('📊 Shops in database:', shops)
    console.log('📊 Total shops found:', shops?.length || 0)
    
    if (shops && shops.length > 0) {
      shops.forEach((shop, index) => {
        console.log(`🏪 Shop ${index + 1}:`, {
          id: shop.id,
          name: shop.name,
          owner_id: shop.owner_id,
          created_at: shop.created_at
        })
      })
    } else {
      console.log('❌ No shops found in database')
    }
    
    return shops
  } catch (error) {
    console.error('❌ Error debugging database:', error)
  }
}

// 🔥 FIXED: Force sync all configurations to database
export const forceSyncAllConfigurations = async (shopId: string) => {
  try {
    console.log('🔄 Force syncing ALL configurations for shop:', shopId)
    
    // Get local configurations
    const costConfigs = JSON.parse(localStorage.getItem('cost-configs') || '[]')
    const printerConfigs = JSON.parse(localStorage.getItem('printer-configs') || '[]')
    const shopInfo = JSON.parse(localStorage.getItem('shop-info') || '{}')
    const paymentInfo = JSON.parse(localStorage.getItem('payment-info') || '{}')
    const businessDetails = JSON.parse(localStorage.getItem('business-details') || '{}')
    
    console.log('📊 Local cost configs:', costConfigs.length)
    console.log('🖨️ Local printer configs:', printerConfigs.length)
    
    // Sync shop info
    if (shopInfo.name) {
      const shopResult = await syncShopInfoToDatabase(shopId, shopInfo)
      console.log('🏪 Shop info sync result:', shopResult)
    }
    
    // Sync cost configs
    if (costConfigs.length > 0) {
      const costResult = await syncCostConfigs(shopId, costConfigs)
      console.log('💰 Cost config sync result:', costResult)
    }
    
    // Sync printer configs
    if (printerConfigs.length > 0) {
      const printerResult = await syncPrinterConfigs(shopId, printerConfigs)
      console.log('🖨️ Printer config sync result:', printerResult)
    }
    
    // Sync payment info
    if (Object.keys(paymentInfo).length > 0) {
      const paymentResult = await syncPaymentInfo(shopId, paymentInfo)
      console.log('💳 Payment info sync result:', paymentResult)
    }
    
    // Sync business details
    if (Object.keys(businessDetails).length > 0) {
      const businessResult = await syncBusinessDetails(shopId, businessDetails)
      console.log('🏢 Business details sync result:', businessResult)
    }
    
    console.log('✅ Force sync completed!')
    return { success: true }
  } catch (error) {
    console.error('❌ Error in force sync:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// Export the configured supabase client as default
export default supabase