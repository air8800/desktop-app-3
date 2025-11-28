// Real-time synchronization utilities for sending data to web app

export interface ShopConfigUpdate {
  shopId: string;
  timestamp: string;
  type: 'cost-config-update' | 'printer-config-update' | 'shop-info-update';
  data: any;
}

export class RealTimeSync {
  private static instance: RealTimeSync;
  private websocket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  private constructor() {}

  public static getInstance(): RealTimeSync {
    if (!RealTimeSync.instance) {
      RealTimeSync.instance = new RealTimeSync();
    }
    return RealTimeSync.instance;
  }

  // Initialize WebSocket connection
  public async connect(shopId: string): Promise<void> {
    try {
      // In production, this would be your WebSocket server URL
      const wsUrl = `ws://localhost:3001/ws/${shopId}`;
      
      this.websocket = new WebSocket(wsUrl);
      
      this.websocket.onopen = () => {
        console.log('Real-time sync connected');
        this.reconnectAttempts = 0;
      };
      
      this.websocket.onclose = () => {
        console.log('Real-time sync disconnected');
        this.handleReconnect(shopId);
      };
      
      this.websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
    } catch (error) {
      console.error('Failed to connect to real-time sync:', error);
    }
  }

  // Send configuration update to web app
  public async sendConfigUpdate(update: ShopConfigUpdate): Promise<void> {
    try {
      if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
        this.websocket.send(JSON.stringify(update));
        console.log('Config update sent via WebSocket:', update);
      } else {
        // Fallback to HTTP API if WebSocket is not available
        await this.sendViaHTTP(update);
      }
    } catch (error) {
      console.error('Failed to send config update:', error);
      // Try HTTP fallback
      await this.sendViaHTTP(update);
    }
  }

  // HTTP fallback for sending updates
  private async sendViaHTTP(update: ShopConfigUpdate): Promise<void> {
    try {
      // In production, this would be your API endpoint
      const response = await fetch('/api/shops/config-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify(update)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      console.log('Config update sent via HTTP:', update);
    } catch (error) {
      console.error('Failed to send update via HTTP:', error);
      // Store in local queue for retry
      this.queueForRetry(update);
    }
  }

  // Handle WebSocket reconnection
  private handleReconnect(shopId: string): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
      
      setTimeout(() => {
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.connect(shopId);
      }, delay);
    }
  }

  // Get authentication token (implement based on your auth system)
  private getAuthToken(): string {
    // This would return the actual auth token from your authentication system
    return localStorage.getItem('authToken') || '';
  }

  // Queue failed updates for retry
  private queueForRetry(update: ShopConfigUpdate): void {
    const queue = JSON.parse(localStorage.getItem('pendingUpdates') || '[]');
    queue.push(update);
    localStorage.setItem('pendingUpdates', JSON.stringify(queue));
  }

  // Process queued updates
  public async processQueuedUpdates(): Promise<void> {
    const queue = JSON.parse(localStorage.getItem('pendingUpdates') || '[]');
    
    for (const update of queue) {
      try {
        await this.sendConfigUpdate(update);
      } catch (error) {
        console.error('Failed to process queued update:', error);
        break; // Stop processing if one fails
      }
    }
    
    // Clear processed updates
    localStorage.setItem('pendingUpdates', '[]');
  }

  // Disconnect WebSocket
  public disconnect(): void {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
  }
}

// Helper functions for specific update types
export const sendCostConfigUpdate = async (shopId: string, costConfigs: any[]) => {
  const sync = RealTimeSync.getInstance();
  await sync.sendConfigUpdate({
    shopId,
    timestamp: new Date().toISOString(),
    type: 'cost-config-update',
    data: { costConfigs }
  });
};

export const sendPrinterConfigUpdate = async (shopId: string, printerConfigs: any[]) => {
  const sync = RealTimeSync.getInstance();
  await sync.sendConfigUpdate({
    shopId,
    timestamp: new Date().toISOString(),
    type: 'printer-config-update',
    data: { printerConfigs }
  });
};

export const sendShopInfoUpdate = async (shopId: string, shopInfo: any) => {
  const sync = RealTimeSync.getInstance();
  await sync.sendConfigUpdate({
    shopId,
    timestamp: new Date().toISOString(),
    type: 'shop-info-update',
    data: { shopInfo }
  });
};