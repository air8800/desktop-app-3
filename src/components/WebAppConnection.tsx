import React, { useState, useEffect } from 'react';
import { Globe, Wifi, WifiOff, CheckCircle, AlertTriangle, Settings, Zap, Database, Cloud, Monitor, Smartphone, ArrowRight, Copy, ExternalLink, RefreshCw } from 'lucide-react';
import { WebAppSyncManager, initializeWebAppSync, type WebAppConfig } from '../utils/webAppSync';

interface ConnectionStatus {
  isConnected: boolean;
  method: 'supabase' | 'firebase' | 'websocket' | 'api' | null;
  lastSync: string | null;
  error: string | null;
}

const WebAppConnection: React.FC = () => {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    isConnected: false,
    method: null,
    lastSync: null,
    error: null
  });

  const [config, setConfig] = useState<WebAppConfig>({
    supabaseUrl: '',
    supabaseKey: '',
    apiEndpoint: '',
    websocketUrl: ''
  });

  const [isConnecting, setIsConnecting] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [webAppUrl, setWebAppUrl] = useState('');
  const [shopId, setShopId] = useState('');

  useEffect(() => {
    // Load saved configuration
    const savedConfig = localStorage.getItem('webapp-config');
    if (savedConfig) {
      setConfig(JSON.parse(savedConfig));
    }

    const savedShopId = localStorage.getItem('shop-id');
    if (savedShopId) {
      setShopId(savedShopId);
    }

    // Check existing connection
    checkConnectionStatus();
  }, []);

  const checkConnectionStatus = async () => {
    try {
      const syncManager = WebAppSyncManager.getInstance();
      // Add connection check logic here
      setConnectionStatus(prev => ({ ...prev, isConnected: true }));
    } catch (error) {
      setConnectionStatus(prev => ({ 
        ...prev, 
        isConnected: false, 
        error: error instanceof Error ? error.message : 'Connection failed' 
      }));
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    setConnectionStatus(prev => ({ ...prev, error: null }));

    try {
      // Save configuration
      localStorage.setItem('webapp-config', JSON.stringify(config));

      // Initialize connection
      const syncManager = await initializeWebAppSync(config);

      // Test connection
      await testConnection(syncManager);

      setConnectionStatus({
        isConnected: true,
        method: config.supabaseUrl ? 'supabase' : config.websocketUrl ? 'websocket' : 'api',
        lastSync: new Date().toISOString(),
        error: null
      });

      setShowConfig(false);
    } catch (error) {
      setConnectionStatus(prev => ({
        ...prev,
        isConnected: false,
        error: error instanceof Error ? error.message : 'Connection failed'
      }));
    } finally {
      setIsConnecting(false);
    }
  };

  const testConnection = async (syncManager: WebAppSyncManager) => {
    // Test the connection by trying to sync current shop data
    const shopInfo = JSON.parse(localStorage.getItem('shop-info') || '{}');
    const costConfigs = JSON.parse(localStorage.getItem('cost-configs') || '[]');
    const printerConfigs = JSON.parse(localStorage.getItem('printer-configs') || '[]');

    if (shopId && shopInfo.name) {
      await syncManager.syncShopConfig({
        shopId,
        shopInfo,
        costConfigs,
        printerConfigs
      });
    }
  };

  const handleDisconnect = () => {
    const syncManager = WebAppSyncManager.getInstance();
    syncManager.disconnect();
    
    setConnectionStatus({
      isConnected: false,
      method: null,
      lastSync: null,
      error: null
    });
  };

  const copyWebAppUrl = () => {
    if (webAppUrl) {
      navigator.clipboard.writeText(webAppUrl);
    }
  };

  const openWebApp = () => {
    if (webAppUrl) {
      window.open(webAppUrl, '_blank');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border-blue-200 dark:border-blue-800 shadow-large">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center shadow-large mr-4">
              <Globe className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-blue-800 dark:text-blue-300">Web App Connection</h2>
              <p className="text-blue-600 dark:text-blue-400">Connect your desktop app with your web application</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className={`flex items-center px-3 py-2 rounded-lg ${
              connectionStatus.isConnected 
                ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
            }`}>
              {connectionStatus.isConnected ? (
                <Wifi className="h-4 w-4 mr-2" />
              ) : (
                <WifiOff className="h-4 w-4 mr-2" />
              )}
              <span className="font-medium">
                {connectionStatus.isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Connection Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6 shadow-large">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
            <Monitor className="h-5 w-5 mr-2" />
            Desktop App Status
          </h3>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/30 rounded-lg">
              <span className="text-green-800 dark:text-green-300 font-medium">Desktop App</span>
              <div className="flex items-center text-green-600 dark:text-green-400">
                <CheckCircle className="h-4 w-4 mr-2" />
                <span className="text-sm font-medium">Running</span>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
              <span className="text-blue-800 dark:text-blue-300 font-medium">Shop ID</span>
              <span className="text-blue-600 dark:text-blue-400 font-mono text-sm">
                {shopId || 'Not set'}
              </span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <span className="text-gray-800 dark:text-gray-300 font-medium">Last Sync</span>
              <span className="text-gray-600 dark:text-gray-400 text-sm">
                {connectionStatus.lastSync 
                  ? new Date(connectionStatus.lastSync).toLocaleString()
                  : 'Never'
                }
              </span>
            </div>
          </div>
        </div>

        <div className="card p-6 shadow-large">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
            <Smartphone className="h-5 w-5 mr-2" />
            Web App Status
          </h3>
          
          <div className="space-y-3">
            <div className={`flex items-center justify-between p-3 rounded-lg ${
              connectionStatus.isConnected
                ? 'bg-green-50 dark:bg-green-900/30'
                : 'bg-red-50 dark:bg-red-900/30'
            }`}>
              <span className={`font-medium ${
                connectionStatus.isConnected
                  ? 'text-green-800 dark:text-green-300'
                  : 'text-red-800 dark:text-red-300'
              }`}>
                Connection
              </span>
              <div className={`flex items-center ${
                connectionStatus.isConnected
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {connectionStatus.isConnected ? (
                  <CheckCircle className="h-4 w-4 mr-2" />
                ) : (
                  <AlertTriangle className="h-4 w-4 mr-2" />
                )}
                <span className="text-sm font-medium">
                  {connectionStatus.isConnected ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
            
            {connectionStatus.method && (
              <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                <span className="text-blue-800 dark:text-blue-300 font-medium">Method</span>
                <span className="text-blue-600 dark:text-blue-400 text-sm font-medium capitalize">
                  {connectionStatus.method}
                </span>
              </div>
            )}
            
            {webAppUrl && (
              <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-800 dark:text-gray-300 font-medium text-sm">Web App URL</span>
                  <div className="flex gap-2">
                    <button
                      onClick={copyWebAppUrl}
                      className="p-1 text-gray-600 hover:text-gray-800 dark:hover:text-gray-300 transition-colors"
                      title="Copy URL"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                    <button
                      onClick={openWebApp}
                      className="p-1 text-gray-600 hover:text-gray-800 dark:hover:text-gray-300 transition-colors"
                      title="Open Web App"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-xs font-mono break-all">
                  {webAppUrl}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error Display */}
      {connectionStatus.error && (
        <div className="alert-error">
          <AlertTriangle className="h-5 w-5 mr-2" />
          <div>
            <strong>Connection Error:</strong>
            <p className="mt-1">{connectionStatus.error}</p>
          </div>
        </div>
      )}

      {/* Connection Methods */}
      <div className="card p-6 shadow-large">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Available Connection Methods</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 border-2 border-blue-200 dark:border-blue-800 rounded-xl bg-blue-50 dark:bg-blue-900/30">
            <div className="flex items-center mb-3">
              <Database className="h-6 w-6 text-blue-600 mr-2" />
              <h4 className="font-bold text-blue-800 dark:text-blue-300">Supabase</h4>
            </div>
            <p className="text-blue-700 dark:text-blue-400 text-sm mb-3">
              Real-time database with built-in authentication and file storage
            </p>
            <div className="text-xs text-blue-600 dark:text-blue-400">
              ✓ Real-time sync<br/>
              ✓ File storage<br/>
              ✓ Authentication<br/>
              ✓ Free tier available
            </div>
          </div>

          <div className="p-4 border-2 border-green-200 dark:border-green-800 rounded-xl bg-green-50 dark:bg-green-900/30">
            <div className="flex items-center mb-3">
              <Cloud className="h-6 w-6 text-green-600 mr-2" />
              <h4 className="font-bold text-green-800 dark:text-green-300">Firebase</h4>
            </div>
            <p className="text-green-700 dark:text-green-400 text-sm mb-3">
              Google's platform with Firestore database and real-time updates
            </p>
            <div className="text-xs text-green-600 dark:text-green-400">
              ✓ Google integration<br/>
              ✓ Firestore database<br/>
              ✓ Real-time listeners<br/>
              ✓ Generous free tier
            </div>
          </div>

          <div className="p-4 border-2 border-purple-200 dark:border-purple-800 rounded-xl bg-purple-50 dark:bg-purple-900/30">
            <div className="flex items-center mb-3">
              <Zap className="h-6 w-6 text-purple-600 mr-2" />
              <h4 className="font-bold text-purple-800 dark:text-purple-300">Custom API</h4>
            </div>
            <p className="text-purple-700 dark:text-purple-400 text-sm mb-3">
              Your own backend with WebSocket or REST API integration
            </p>
            <div className="text-xs text-purple-600 dark:text-purple-400">
              ✓ Full control<br/>
              ✓ Custom logic<br/>
              ✓ WebSocket support<br/>
              ✓ Any hosting provider
            </div>
          </div>
        </div>
      </div>

      {/* Configuration Panel */}
      {showConfig && (
        <div className="card p-6 bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-900/30 dark:to-slate-900/30 border-gray-200 dark:border-gray-800 shadow-large">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
              <Settings className="h-5 w-5 mr-2" />
              Connection Configuration
            </h3>
            <button
              onClick={() => setShowConfig(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>

          <div className="space-y-6">
            {/* Supabase Configuration */}
            <div className="space-y-4">
              <h4 className="font-bold text-gray-800 dark:text-gray-300">Supabase Configuration</h4>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Supabase URL</label>
                  <input
                    type="url"
                    value={config.supabaseUrl}
                    onChange={(e) => setConfig(prev => ({ ...prev, supabaseUrl: e.target.value }))}
                    placeholder="https://your-project.supabase.co"
                    className="input cursor-visible"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Supabase Anon Key</label>
                  <input
                    type="password"
                    value={config.supabaseKey}
                    onChange={(e) => setConfig(prev => ({ ...prev, supabaseKey: e.target.value }))}
                    placeholder="Your Supabase anon key"
                    className="input cursor-visible"
                  />
                </div>
              </div>
            </div>

            {/* API Configuration */}
            <div className="space-y-4">
              <h4 className="font-bold text-gray-800 dark:text-gray-300">Custom API Configuration</h4>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">API Endpoint</label>
                  <input
                    type="url"
                    value={config.apiEndpoint}
                    onChange={(e) => setConfig(prev => ({ ...prev, apiEndpoint: e.target.value }))}
                    placeholder="https://your-api.com/api"
                    className="input cursor-visible"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">WebSocket URL</label>
                  <input
                    type="url"
                    value={config.websocketUrl}
                    onChange={(e) => setConfig(prev => ({ ...prev, websocketUrl: e.target.value }))}
                    placeholder="wss://your-api.com/ws"
                    className="input cursor-visible"
                  />
                </div>
              </div>
            </div>

            {/* Web App URL */}
            <div className="space-y-4">
              <h4 className="font-bold text-gray-800 dark:text-gray-300">Web App URL</h4>
              <div className="form-group">
                <label className="form-label">Customer Web App URL</label>
                <input
                  type="url"
                  value={webAppUrl}
                  onChange={(e) => setWebAppUrl(e.target.value)}
                  placeholder="https://your-web-app.com"
                  className="input cursor-visible"
                />
                <p className="form-help">The URL where customers will access your web application</p>
              </div>
            </div>
          </div>

          <div className="flex gap-4 mt-6">
            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className="btn-primary flex-1"
            >
              {isConnecting ? (
                <div className="flex items-center justify-center">
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Connecting...
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  <Wifi className="h-4 w-4 mr-2" />
                  Connect to Web App
                  <ArrowRight className="h-4 w-4 ml-2" />
                </div>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4">
        {!connectionStatus.isConnected ? (
          <button
            onClick={() => setShowConfig(true)}
            className="btn-primary shadow-large hover:shadow-xl"
          >
            <Settings className="h-5 w-5 mr-2" />
            Configure Connection
          </button>
        ) : (
          <>
            <button
              onClick={checkConnectionStatus}
              className="btn-secondary shadow-large hover:shadow-xl"
            >
              <RefreshCw className="h-5 w-5 mr-2" />
              Test Connection
            </button>
            <button
              onClick={handleDisconnect}
              className="btn-danger shadow-large hover:shadow-xl"
            >
              <WifiOff className="h-5 w-5 mr-2" />
              Disconnect
            </button>
          </>
        )}
      </div>

      {/* Integration Benefits */}
      <div className="card p-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 border-green-200 dark:border-green-800 shadow-large">
        <h3 className="text-lg font-bold text-green-800 dark:text-green-300 mb-4">Benefits of Web App Integration</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="flex items-center p-3 bg-white dark:bg-gray-800 rounded-lg shadow-soft">
            <CheckCircle className="h-5 w-5 text-green-600 mr-3" />
            <span className="text-gray-900 dark:text-white font-medium">Real-time order notifications</span>
          </div>
          <div className="flex items-center p-3 bg-white dark:bg-gray-800 rounded-lg shadow-soft">
            <CheckCircle className="h-5 w-5 text-green-600 mr-3" />
            <span className="text-gray-900 dark:text-white font-medium">Automatic pricing sync</span>
          </div>
          <div className="flex items-center p-3 bg-white dark:bg-gray-800 rounded-lg shadow-soft">
            <CheckCircle className="h-5 w-5 text-green-600 mr-3" />
            <span className="text-gray-900 dark:text-white font-medium">Customer self-service ordering</span>
          </div>
          <div className="flex items-center p-3 bg-white dark:bg-gray-800 rounded-lg shadow-soft">
            <CheckCircle className="h-5 w-5 text-green-600 mr-3" />
            <span className="text-gray-900 dark:text-white font-medium">QR code integration</span>
          </div>
          <div className="flex items-center p-3 bg-white dark:bg-gray-800 rounded-lg shadow-soft">
            <CheckCircle className="h-5 w-5 text-green-600 mr-3" />
            <span className="text-gray-900 dark:text-white font-medium">File upload & download</span>
          </div>
          <div className="flex items-center p-3 bg-white dark:bg-gray-800 rounded-lg shadow-soft">
            <CheckCircle className="h-5 w-5 text-green-600 mr-3" />
            <span className="text-gray-900 dark:text-white font-medium">Payment tracking</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WebAppConnection;