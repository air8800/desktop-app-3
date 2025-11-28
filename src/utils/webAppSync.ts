// Web App Synchronization Utilities
// This file handles real-time communication between Desktop App and Web App

export interface WebAppConfig {
  supabaseUrl?: string;
  supabaseKey?: string;
  firebaseConfig?: any;
  apiEndpoint?: string;
  websocketUrl?: string;
}

export interface PrintJobData {
  id: string;
  shopId: string;
  filename: string;
  fileUrl: string;
  copies: number;
  paperSize: string;
  colorMode: 'Color' | 'BW';
  printType: 'Single' | 'Double';
  pagesPerSheet: number;
  nupOrientation: 'portrait' | 'landscape';
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  totalCost: number;
  paymentStatus: 'pending' | 'paid' | 'failed';
  jobStatus: 'pending' | 'printing' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

export interface ShopConfigData {
  shopId: string;
  shopInfo: {
    name: string;
    address: string;
    phone: string;
    email: string;
  };
  costConfigs: any[];
  printerConfigs: any[];
  qrCodeUrl?: string;
}

export class WebAppSyncManager {
  private static instance: WebAppSyncManager;
  private config: WebAppConfig = {};
  private supabase: any = null;
  private websocket: WebSocket | null = null;
  private listeners: Map<string, Function[]> = new Map();

  private constructor() {}

  public static getInstance(): WebAppSyncManager {
    if (!WebAppSyncManager.instance) {
      WebAppSyncManager.instance = new WebAppSyncManager();
    }
    return WebAppSyncManager.instance;
  }

  // Initialize with configuration
  public async initialize(config: WebAppConfig): Promise<void> {
    this.config = config;
    
    try {
      // Initialize Supabase if configured
      if (config.supabaseUrl && config.supabaseKey) {
        await this.initializeSupabase();
      }
      
      // Initialize WebSocket if configured
      if (config.websocketUrl) {
        await this.initializeWebSocket();
      }
      
      console.log('WebApp sync initialized successfully');
    } catch (error) {
      console.error('Failed to initialize WebApp sync:', error);
    }
  }

  // Initialize Supabase connection
  private async initializeSupabase(): Promise<void> {
    try {
      // Dynamic import to avoid bundling if not used
      const { createClient } = await import('@supabase/supabase-js');
      
      this.supabase = createClient(
        this.config.supabaseUrl!,
        this.config.supabaseKey!
      );
      
      console.log('Supabase client initialized');
    } catch (error) {
      console.error('Failed to initialize Supabase:', error);
      throw error;
    }
  }

  // Initialize WebSocket connection
  private async initializeWebSocket(): Promise<void> {
    try {
      this.websocket = new WebSocket(this.config.websocketUrl!);
      
      this.websocket.onopen = () => {
        console.log('WebSocket connected to web app');
      };
      
      this.websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleWebSocketMessage(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };
      
      this.websocket.onclose = () => {
        console.log('WebSocket disconnected');
        // Attempt to reconnect after 5 seconds
        setTimeout(() => this.initializeWebSocket(), 5000);
      };
      
      this.websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
    } catch (error) {
      console.error('Failed to initialize WebSocket:', error);
    }
  }

  // Handle incoming WebSocket messages
  private handleWebSocketMessage(data: any): void {
    const { type, payload } = data;
    
    switch (type) {
      case 'NEW_PRINT_JOB':
        this.notifyListeners('newPrintJob', payload);
        break;
      case 'JOB_STATUS_UPDATE':
        this.notifyListeners('jobStatusUpdate', payload);
        break;
      case 'PAYMENT_RECEIVED':
        this.notifyListeners('paymentReceived', payload);
        break;
      default:
        console.log('Unknown WebSocket message type:', type);
    }
  }

  // Subscribe to real-time print jobs (Supabase)
  public subscribeToNewJobs(shopId: string, callback: (job: PrintJobData) => void): () => void {
    if (!this.supabase) {
      console.error('Supabase not initialized');
      return () => {};
    }

    const subscription = this.supabase
      .channel('print_jobs')
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'print_jobs',
          filter: `shop_id=eq.${shopId}`
        }, 
        (payload: any) => {
          console.log('New print job received:', payload.new);
          callback(payload.new as PrintJobData);
        }
      )
      .subscribe();

    return () => subscription.unsubscribe();
  }

  // Subscribe to job status updates (Supabase)
  public subscribeToJobUpdates(shopId: string, callback: (job: PrintJobData) => void): () => void {
    if (!this.supabase) {
      console.error('Supabase not initialized');
      return () => {};
    }

    const subscription = this.supabase
      .channel('job_updates')
      .on('postgres_changes', 
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'print_jobs',
          filter: `shop_id=eq.${shopId}`
        }, 
        (payload: any) => {
          console.log('Job status updated:', payload.new);
          callback(payload.new as PrintJobData);
        }
      )
      .subscribe();

    return () => subscription.unsubscribe();
  }

  // Sync shop configuration to web app
  public async syncShopConfig(shopData: ShopConfigData): Promise<void> {
    try {
      if (this.supabase) {
        await this.syncToSupabase(shopData);
      }
      
      if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
        this.websocket.send(JSON.stringify({
          type: 'SHOP_CONFIG_UPDATE',
          payload: shopData
        }));
      }
      
      // Fallback to HTTP API
      if (this.config.apiEndpoint) {
        await this.syncViaAPI(shopData);
      }
      
      console.log('Shop configuration synced successfully');
    } catch (error) {
      console.error('Failed to sync shop configuration:', error);
      throw error;
    }
  }

  // Sync to Supabase
  private async syncToSupabase(shopData: ShopConfigData): Promise<void> {
    if (!this.supabase) return;

    try {
      // Update shop info
      await this.supabase
        .from('shops')
        .upsert({
          id: shopData.shopId,
          ...shopData.shopInfo,
          qr_code_url: shopData.qrCodeUrl,
          updated_at: new Date().toISOString()
        });

      // Update cost configurations
      if (shopData.costConfigs.length > 0) {
        await this.supabase
          .from('cost_configs')
          .delete()
          .eq('shop_id', shopData.shopId);

        await this.supabase
          .from('cost_configs')
          .insert(
            shopData.costConfigs.map(config => ({
              shop_id: shopData.shopId,
              paper_size: config.paperSize,
              color_mode: config.colorMode,
              print_type: config.printType,
              base_price: config.basePricePerPage,
              bulk_tiers: config.tiers
            }))
          );
      }

      // Update printer configurations
      if (shopData.printerConfigs.length > 0) {
        await this.supabase
          .from('printer_configs')
          .delete()
          .eq('shop_id', shopData.shopId);

        await this.supabase
          .from('printer_configs')
          .insert(
            shopData.printerConfigs.map(config => ({
              shop_id: shopData.shopId,
              paper_size: config.paperSize,
              printers: config.printers
            }))
          );
      }

    } catch (error) {
      console.error('Supabase sync error:', error);
      throw error;
    }
  }

  // Sync via HTTP API
  private async syncViaAPI(shopData: ShopConfigData): Promise<void> {
    try {
      const response = await fetch(`${this.config.apiEndpoint}/shops/${shopData.shopId}/config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify(shopData)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

    } catch (error) {
      console.error('API sync error:', error);
      throw error;
    }
  }

  // Update job status
  public async updateJobStatus(jobId: string, status: string, additionalData?: any): Promise<void> {
    try {
      const updateData = {
        job_status: status,
        updated_at: new Date().toISOString(),
        ...additionalData
      };

      if (this.supabase) {
        await this.supabase
          .from('print_jobs')
          .update(updateData)
          .eq('id', jobId);
      }

      if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
        this.websocket.send(JSON.stringify({
          type: 'JOB_STATUS_UPDATE',
          payload: { jobId, status, ...additionalData }
        }));
      }

      console.log(`Job ${jobId} status updated to ${status}`);
    } catch (error) {
      console.error('Failed to update job status:', error);
      throw error;
    }
  }

  // Download file from web app
  public async downloadJobFile(fileUrl: string): Promise<Blob> {
    try {
      const response = await fetch(fileUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.status}`);
      }
      
      return await response.blob();
    } catch (error) {
      console.error('Failed to download job file:', error);
      throw error;
    }
  }

  // Get shop configuration from web app
  public async getShopConfig(shopId: string): Promise<ShopConfigData | null> {
    try {
      if (this.supabase) {
        const [shopInfo, costConfigs, printerConfigs] = await Promise.all([
          this.supabase.from('shops').select('*').eq('id', shopId).single(),
          this.supabase.from('cost_configs').select('*').eq('shop_id', shopId),
          this.supabase.from('printer_configs').select('*').eq('shop_id', shopId)
        ]);

        if (shopInfo.data) {
          return {
            shopId,
            shopInfo: {
              name: shopInfo.data.name,
              address: shopInfo.data.address,
              phone: shopInfo.data.phone,
              email: shopInfo.data.email
            },
            costConfigs: costConfigs.data || [],
            printerConfigs: printerConfigs.data || [],
            qrCodeUrl: shopInfo.data.qr_code_url
          };
        }
      }

      return null;
    } catch (error) {
      console.error('Failed to get shop configuration:', error);
      return null;
    }
  }

  // Event listener management
  public addEventListener(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  public removeEventListener(event: string, callback: Function): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const index = eventListeners.indexOf(callback);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  private notifyListeners(event: string, data: any): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error in event listener:', error);
        }
      });
    }
  }

  // Get authentication token
  private getAuthToken(): string {
    return localStorage.getItem('auth-token') || '';
  }

  // Cleanup
  public disconnect(): void {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    
    this.listeners.clear();
    console.log('WebApp sync disconnected');
  }
}

// Helper functions for easy integration
export const initializeWebAppSync = async (config: WebAppConfig) => {
  const syncManager = WebAppSyncManager.getInstance();
  await syncManager.initialize(config);
  return syncManager;
};

export const syncShopConfiguration = async (shopData: ShopConfigData) => {
  const syncManager = WebAppSyncManager.getInstance();
  await syncManager.syncShopConfig(shopData);
};

export const subscribeToNewJobs = (shopId: string, callback: (job: PrintJobData) => void) => {
  const syncManager = WebAppSyncManager.getInstance();
  return syncManager.subscribeToNewJobs(shopId, callback);
};

export const updateJobStatus = async (jobId: string, status: string, additionalData?: any) => {
  const syncManager = WebAppSyncManager.getInstance();
  await syncManager.updateJobStatus(jobId, status, additionalData);
};