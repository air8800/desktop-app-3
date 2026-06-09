import React, { useState, useEffect } from 'react';
import PrinterList from '../components/PrinterList';
import PrinterConfig from '../components/PrinterConfig';
import CostConfig from '../components/CostConfig';
import { Printer, PrinterConfigItem, PaperSize, CostConfigItem } from '../types';
import { Settings, Printer as PrinterIcon, IndianRupee, RefreshCw } from 'lucide-react';
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
      icon: IndianRupee,
      description: 'Set per-page rates in ₹ with bulk discounts and tiers'
    }
  ];

  const readyCount = printers.filter((p) => p.status === 'Ready').length;
  const activeTabMeta = tabs.find((t) => t.id === activeTab);

  return (
    <div className="container-max-space animate-fade-in">
      <div className="mb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center shadow-soft shrink-0">
              <PrinterIcon className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Printers & pricing</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                Devices on this PC, paper routing, and ₹ rates for your web shop
              </p>
            </div>
          </div>

          <button
            onClick={handleForceSyncAll}
            disabled={isForceSyncing}
            className="btn-secondary shrink-0 disabled:opacity-50"
            title="Push printer and pricing config to your online shop"
          >
            {isForceSyncing ? (
              <>
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2 inline-block align-middle" />
                Syncing…
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2 inline" />
                Sync to web shop
              </>
            )}
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div
            className="inline-flex flex-wrap gap-1 p-1 rounded-xl bg-gray-100/90 dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700"
            role="tablist"
          >
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-white dark:bg-gray-700 text-blue-700 dark:text-blue-300 shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {activeTab === 'list' && printers.length > 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              <span className="font-semibold text-gray-800 dark:text-gray-200">{readyCount}</span> ready ·{' '}
              <span className="font-semibold text-gray-800 dark:text-gray-200">{printers.length}</span> total ·{' '}
              <span className="font-semibold text-gray-800 dark:text-gray-200">{printerConfigs.length}</span> size maps
            </p>
          )}
        </div>

        {activeTabMeta && (
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">{activeTabMeta.description}</p>
        )}
      </div>

      <div className="content-max-space animate-slide-up">
        {activeTab === 'list' && (
          <div className="space-y-6 h-full">
            <PrinterList
              printers={printers}
              isLoading={isLoading}
              onRefresh={loadPrinters}
            />
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