import React, { useState, useEffect } from 'react';
import PrinterList from '../components/PrinterList';
import PrinterConfig from '../components/PrinterConfig';
import CostConfig from '../components/CostConfig';
import { Printer, PrinterConfigItem, PaperSize, CostConfigItem } from '../types';
import { Settings, Printer as PrinterIcon, DollarSign, RefreshCw } from 'lucide-react';
import { syncPrinterConfigs, syncCostConfigs, forceSyncAllConfigurations } from '../utils/supabase';

const STORAGE_KEY = 'printer-configs';
const CUSTOM_SIZES_KEY = 'custom-paper-sizes';
const COST_CONFIGS_KEY = 'cost-configs';

const Printers: React.FC = () => {
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [printerConfigs, setPrinterConfigs] = useState<PrinterConfigItem[]>([]);
  const [costConfigs, setCostConfigs] = useState<CostConfigItem[]>([]);
  const [customSizes, setCustomSizes] = useState<PaperSize[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'list' | 'config' | 'cost'>('list');
  const [syncStatus, setSyncStatus] = useState<{
    lastSynced: string | null;
    syncing: boolean;
    error: string | null;
  }>({
    lastSynced: null,
    syncing: false,
    error: null
  });
  const [isForceSyncing, setIsForceSyncing] = useState(false);

  const loadPrinters = async () => {
    setIsLoading(true);
    try {
      const result = await window.electron.getPrinters();
      if (result.success) {
        setPrinters(result.printers);
      } else {
        console.error('Error fetching printers:', result.error);
      }
    } catch (error) {
      console.error('Error fetching printers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPrinters();
    
    // Load saved configurations
    const savedConfigs = localStorage.getItem(STORAGE_KEY);
    if (savedConfigs) {
      setPrinterConfigs(JSON.parse(savedConfigs));
    }
    
    // Load custom sizes
    const savedSizes = localStorage.getItem(CUSTOM_SIZES_KEY);
    if (savedSizes) {
      setCustomSizes(JSON.parse(savedSizes));
    }
    
    // Load cost configurations
    const savedCostConfigs = localStorage.getItem(COST_CONFIGS_KEY);
    if (savedCostConfigs) {
      setCostConfigs(JSON.parse(savedCostConfigs));
    }
    
    // 🔥 NEW: Initial sync to database
    initialSyncToDatabase();
  }, []);

  // 🔥 NEW: Initial sync function
  const initialSyncToDatabase = async () => {
    try {
      setSyncStatus(prev => ({ ...prev, syncing: true, error: null }));
      
      const shopId = localStorage.getItem('shop-id');
      if (!shopId) {
        console.warn('No shop ID found for initial sync');
        return;
      }
      
      // Load saved configurations
      const savedConfigs = localStorage.getItem(STORAGE_KEY);
      const savedCostConfigs = localStorage.getItem(COST_CONFIGS_KEY);
      
      if (savedConfigs) {
        const printerConfigsData = JSON.parse(savedConfigs);
        await syncPrinterConfigs(shopId, printerConfigsData);
      }
      
      if (savedCostConfigs) {
        const costConfigsData = JSON.parse(savedCostConfigs);
        await syncCostConfigs(shopId, costConfigsData);
      }
      
      setSyncStatus(prev => ({ 
        ...prev, 
        syncing: false, 
        lastSynced: new Date().toISOString(),
        error: null
      }));
      
      console.log('✅ Initial sync to database completed successfully');
    } catch (error) {
      console.error('❌ Error during initial sync:', error);
      setSyncStatus(prev => ({ 
        ...prev, 
        syncing: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  };

  // 🔥 NEW: Force sync all configurations
  const handleForceSyncAll = async () => {
    setIsForceSyncing(true);
    try {
      const shopId = localStorage.getItem('shop-id');
      
      if (!shopId) {
        console.warn('No shop ID found for force sync');
        return;
      }
      
      console.log('🔄 Starting force sync of all configurations...');
      
      const result = await forceSyncAllConfigurations(shopId);
      
      if (result.success) {
        console.log('✅ All configurations synced to database successfully!');
        
        // Show success notification
        const event = new CustomEvent('show-notification', {
          detail: {
            type: 'success',
            message: 'All configurations synced! Web app updated.'
          }
        });
        window.dispatchEvent(event);
      } else {
        console.error('❌ Error syncing configurations:', result.error);
      }
    } catch (error) {
      console.error('❌ Error in force sync:', error);
    } finally {
      setIsForceSyncing(false);
    }
  };

  const handleConfigUpdate = (newConfigs: PrinterConfigItem[]) => {
    setPrinterConfigs(newConfigs);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfigs));
  };

  const handleCustomSizesUpdate = (newSizes: PaperSize[]) => {
    setCustomSizes(newSizes);
    localStorage.setItem(CUSTOM_SIZES_KEY, JSON.stringify(newSizes));
  };

  const handleCostConfigUpdate = (newCostConfigs: CostConfigItem[]) => {
    setCostConfigs(newCostConfigs);
    localStorage.setItem(COST_CONFIGS_KEY, JSON.stringify(newCostConfigs));
  };

  const tabs = [
    {
      id: 'list',
      label: 'Connected Printers',
      icon: PrinterIcon,
      description: 'View and manage your connected printers with real-time status monitoring'
    },
    {
      id: 'config',
      label: 'Paper Size Config',
      icon: Settings,
      description: 'Configure paper sizes for each printer with drag-and-drop assignment'
    },
    {
      id: 'cost',
      label: 'Cost Configuration',
      icon: DollarSign,
      description: 'Set competitive pricing with bulk discounts and tier management'
    }
  ];

  return (
    <div className="container-max-space animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center shadow-large mr-4">
              <PrinterIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gradient-primary">Printer Management</h1>
              <p className="text-gray-600 dark:text-gray-400">Configure printers, paper sizes, and pricing</p>
            </div>
          </div>
          
          {/* 🔥 NEW: Force Sync Button */}
          <button
            onClick={handleForceSyncAll}
            disabled={isForceSyncing}
            className="btn-primary shadow-large hover:shadow-xl disabled:opacity-50"
          >
            {isForceSyncing ? (
              <div className="flex items-center">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Syncing All Data...
              </div>
            ) : (
              <div className="flex items-center">
                <RefreshCw className="h-4 w-4 mr-2" />
                Force Sync All Data
              </div>
            )}
          </button>
        </div>

        {/* Professional Tab Navigation */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`card p-4 text-left transition-all duration-300 border-2 cursor-pointer ${
                  activeTab === tab.id
                    ? 'border-blue-500 dark:border-blue-400 shadow-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30'
                    : 'border-transparent hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-large'
                }`}
              >
                <div className="flex items-center mb-3">
                  <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center shadow-soft mr-3">
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className={`font-bold ${
                      activeTab === tab.id ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'
                    }`}>
                      {tab.label}
                    </h3>
                  </div>
                  {activeTab === tab.id && (
                    <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                  )}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {tab.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content with Full Space Utilization */}
      <div className="content-max-space animate-slide-up">
        {activeTab === 'list' && (
          <div className="space-y-6 h-full">
            {/* Printer List with Full Height */}
            <div className="flex-1">
              <PrinterList 
                printers={printers} 
                isLoading={isLoading} 
                onRefresh={loadPrinters} 
              />
            </div>
            
            {/* Printer Status Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="card p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border-blue-200 dark:border-blue-800">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center shadow-soft mr-3">
                    <PrinterIcon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-blue-800 dark:text-blue-300">Online Printers</h3>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {printers.filter(p => p.status === 'Ready').length}
                    </p>
                  </div>
                </div>
              </div>

              <div className="card p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border-blue-200 dark:border-blue-800">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center shadow-soft mr-3">
                    <PrinterIcon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-blue-800 dark:text-blue-300">Total Printers</h3>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{printers.length}</p>
                  </div>
                </div>
              </div>

              <div className="card p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border-blue-200 dark:border-blue-800">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center shadow-soft mr-3">
                    <Settings className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-blue-800 dark:text-blue-300">Configured</h3>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{printerConfigs.length}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'config' && (
          <div className="h-full">
            <PrinterConfig 
              printers={printers}
              configs={printerConfigs}
              customSizes={customSizes}
              onConfigUpdate={handleConfigUpdate}
              onCustomSizesUpdate={handleCustomSizesUpdate}
            />
          </div>
        )}

        {activeTab === 'cost' && (
          <div className="h-full">
            <CostConfig 
              customSizes={customSizes}
              costConfigs={costConfigs}
              onCostConfigUpdate={handleCostConfigUpdate}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default Printers;