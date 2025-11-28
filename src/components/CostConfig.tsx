import React, { useState, useEffect } from 'react';
import { PaperSize, CostConfigItem, CostTier } from '../types';
import { Plus, Trash2, DollarSign, Calculator, AlertTriangle, TrendingUp, Target, CheckCircle, Edit3, Save, X, RefreshCw } from 'lucide-react';
import { syncCostConfigs } from '../utils/supabase';

interface CostConfigProps {
  customSizes: PaperSize[];
  costConfigs: CostConfigItem[];
  onCostConfigUpdate: (configs: CostConfigItem[]) => void;
}

const DEFAULT_PAPER_SIZES: PaperSize[] = ['A3', 'A4', 'A5', 'Letter', 'Legal', 'Executive'];

const CostConfig: React.FC<CostConfigProps> = ({ 
  customSizes, 
  costConfigs, 
  onCostConfigUpdate 
}) => {
  const [selectedSize, setSelectedSize] = useState<PaperSize>('A4');
  const [selectedColorMode, setSelectedColorMode] = useState<'Color' | 'BW'>('BW');
  const [selectedPrintType, setSelectedPrintType] = useState<'Single' | 'Double'>('Single');
  const [newTier, setNewTier] = useState({
    minQuantity: 1,
    maxQuantity: 10,
    pricePerPage: 1.0,
    name: ''
  });
  const [basePricePerPage, setBasePricePerPage] = useState(1.0);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [editingTier, setEditingTier] = useState<string | null>(null);
  const [editingTierData, setEditingTierData] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const allPaperSizes = [...DEFAULT_PAPER_SIZES, ...customSizes];

  useEffect(() => {
    // Save configs to localStorage for persistence
    localStorage.setItem('cost-configs', JSON.stringify(costConfigs));
  }, [costConfigs]);

  const getConfigForSelection = () => {
    return costConfigs.find(c => 
      c.paperSize === selectedSize && 
      c.colorMode === selectedColorMode && 
      c.printType === selectedPrintType
    );
  };

  // 🔥 ENHANCED: Better sync with detailed logging
  const syncConfigsToDatabase = async (updatedConfigs: CostConfigItem[]) => {
    setIsSyncing(true);
    try {
      const shopId = localStorage.getItem('shop-id');
      const currentUser = JSON.parse(localStorage.getItem('user-session') || '{}');
      
      if (shopId && currentUser.id) {
        console.log('🔄 Syncing cost configs to database...', {
          shopId,
          configCount: updatedConfigs.length,
          configs: updatedConfigs
        });
        
        const result = await syncCostConfigs(shopId, updatedConfigs);
        
        if (result.success) {
          console.log('✅ Cost configs synced to database successfully!');
          
          // 🔥 NEW: Show success notification
          const event = new CustomEvent('show-notification', {
            detail: {
              type: 'success',
              message: `Cost configurations synced! ${updatedConfigs.length} configs updated.`
            }
          });
          window.dispatchEvent(event);
        } else {
          console.warn('⚠️ Failed to sync cost configs:', result.error);
          
          // Show error notification
          const event = new CustomEvent('show-notification', {
            detail: {
              type: 'error',
              message: 'Failed to sync cost configurations. Please try again.'
            }
          });
          window.dispatchEvent(event);
        }
      } else {
        console.warn('⚠️ Missing shop ID or user session for sync');
      }
    } catch (error) {
      console.error('❌ Error syncing cost configs:', error);
      
      // Show error notification
      const event = new CustomEvent('show-notification', {
        detail: {
          type: 'error',
          message: 'Error syncing configurations. Check your connection.'
        }
      });
      window.dispatchEvent(event);
    } finally {
      setIsSyncing(false);
    }
  };

  const validateTier = (tier: typeof newTier): string[] => {
    const errors: string[] = [];
    
    if (!tier.name.trim()) {
      errors.push('Tier name is required');
    }
    
    if (tier.minQuantity <= 0) {
      errors.push('Minimum quantity must be greater than 0');
    }
    
    if (tier.maxQuantity !== null && tier.maxQuantity <= 0) {
      errors.push('Maximum quantity must be greater than 0');
    }
    
    if (tier.maxQuantity !== null && tier.maxQuantity < tier.minQuantity) {
      errors.push('Maximum quantity cannot be less than minimum quantity');
    }
    
    if (tier.pricePerPage <= 0) {
      errors.push('Price per page must be greater than 0');
    }
    
    const config = getConfigForSelection();
    if (config) {
      const overlapping = config.tiers.some(existingTier => {
        if (editingTier && existingTier.id === editingTier) return false;
        
        const newMin = tier.minQuantity;
        const newMax = tier.maxQuantity || Infinity;
        const existingMin = existingTier.minQuantity;
        const existingMax = existingTier.maxQuantity || Infinity;
        
        return (newMin <= existingMax && newMax >= existingMin);
      });
      
      if (overlapping) {
        errors.push('Quantity range overlaps with existing tier');
      }
    }
    
    return errors;
  };

  const handleSetConfigForSize = (size: PaperSize, colorMode: 'Color' | 'BW', printType: 'Single' | 'Double') => {
    setSelectedSize(size);
    setSelectedColorMode(colorMode);
    setSelectedPrintType(printType);
    setValidationErrors([]);
    setEditingTier(null);
    setEditingTierData(null);
    
    const existingConfig = costConfigs.find(c => 
      c.paperSize === size && 
      c.colorMode === colorMode && 
      c.printType === printType
    );
    
    if (existingConfig) {
      setBasePricePerPage(existingConfig.basePricePerPage);
    }
  };

  const handleAddOrUpdateConfig = async () => {
    const existingConfigIndex = costConfigs.findIndex(c => 
      c.paperSize === selectedSize && 
      c.colorMode === selectedColorMode && 
      c.printType === selectedPrintType
    );

    const newConfig: CostConfigItem = {
      paperSize: selectedSize,
      colorMode: selectedColorMode,
      printType: selectedPrintType,
      basePricePerPage: basePricePerPage,
      tiers: []
    };

    let updatedConfigs = [...costConfigs];
    if (existingConfigIndex >= 0) {
      updatedConfigs[existingConfigIndex] = { ...updatedConfigs[existingConfigIndex], basePricePerPage };
    } else {
      updatedConfigs.push(newConfig);
    }

    onCostConfigUpdate(updatedConfigs);
    
    // 🔥 ENHANCED: Immediate sync with better error handling
    await syncConfigsToDatabase(updatedConfigs);
  };

  const handleAddTier = async () => {
    const errors = validateTier(newTier);
    
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    
    setValidationErrors([]);

    const config = getConfigForSelection();
    if (!config) {
      await handleAddOrUpdateConfig();
      return;
    }

    const tierWithId: CostTier = {
      id: Date.now().toString(),
      minQuantity: newTier.minQuantity,
      maxQuantity: newTier.maxQuantity || null,
      pricePerPage: newTier.pricePerPage,
      name: newTier.name
    };

    const updatedConfigs = costConfigs.map(c => {
      if (c.paperSize === selectedSize && 
          c.colorMode === selectedColorMode && 
          c.printType === selectedPrintType) {
        return {
          ...c,
          tiers: [...c.tiers, tierWithId].sort((a, b) => a.minQuantity - b.minQuantity)
        };
      }
      return c;
    });

    onCostConfigUpdate(updatedConfigs);
    setNewTier({ minQuantity: 1, maxQuantity: 10, pricePerPage: 1.0, name: '' });
    
    // 🔥 ENHANCED: Immediate sync
    await syncConfigsToDatabase(updatedConfigs);
  };

  const handleEditTier = (tier: CostTier) => {
    setEditingTier(tier.id);
    setEditingTierData({
      name: tier.name,
      minQuantity: tier.minQuantity,
      maxQuantity: tier.maxQuantity,
      pricePerPage: tier.pricePerPage
    });
    setValidationErrors([]);
  };

  const handleSaveEditTier = async () => {
    if (!editingTier || !editingTierData) return;

    const errors = validateTier(editingTierData);
    
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }
    
    setValidationErrors([]);

    const updatedConfigs = costConfigs.map(c => {
      if (c.paperSize === selectedSize && 
          c.colorMode === selectedColorMode && 
          c.printType === selectedPrintType) {
        return {
          ...c,
          tiers: c.tiers.map(t => 
            t.id === editingTier 
              ? { ...t, ...editingTierData }
              : t
          ).sort((a, b) => a.minQuantity - b.minQuantity)
        };
      }
      return c;
    });

    onCostConfigUpdate(updatedConfigs);
    setEditingTier(null);
    setEditingTierData(null);
    
    // 🔥 ENHANCED: Immediate sync
    await syncConfigsToDatabase(updatedConfigs);
  };

  const handleCancelEdit = () => {
    setEditingTier(null);
    setEditingTierData(null);
    setValidationErrors([]);
  };

  const handleRemoveTier = async (tierId: string) => {
    const updatedConfigs = costConfigs.map(c => {
      if (c.paperSize === selectedSize && 
          c.colorMode === selectedColorMode && 
          c.printType === selectedPrintType) {
        return {
          ...c,
          tiers: c.tiers.filter(t => t.id !== tierId)
        };
      }
      return c;
    });

    onCostConfigUpdate(updatedConfigs);
    
    // 🔥 ENHANCED: Immediate sync
    await syncConfigsToDatabase(updatedConfigs);
  };

  const handleRemoveConfig = async (size: PaperSize, colorMode: 'Color' | 'BW', printType: 'Single' | 'Double') => {
    const updatedConfigs = costConfigs.filter(c => 
      !(c.paperSize === size && c.colorMode === colorMode && c.printType === printType)
    );
    onCostConfigUpdate(updatedConfigs);
    
    // 🔥 ENHANCED: Immediate sync
    await syncConfigsToDatabase(updatedConfigs);
  };

  // 🔥 NEW: Force sync all cost configs
  const handleForceSyncConfigs = async () => {
    setIsSyncing(true);
    try {
      const shopId = localStorage.getItem('shop-id');
      if (!shopId) {
        console.warn('No shop ID found for sync');
        return;
      }
      
      console.log('🔄 Force syncing all cost configs...');
      const result = await syncCostConfigs(shopId, costConfigs);
      
      if (result.success) {
        console.log('✅ All cost configs synced successfully!');
        
        // Show success notification
        const event = new CustomEvent('show-notification', {
          detail: {
            type: 'success',
            message: `All cost configurations synced! ${costConfigs.length} configs updated.`
          }
        });
        window.dispatchEvent(event);
      } else {
        console.warn('⚠️ Failed to sync cost configs:', result.error);
      }
    } catch (error) {
      console.error('❌ Error syncing cost configs:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  const currentConfig = getConfigForSelection();

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="card p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border-blue-200 dark:border-blue-800 shadow-large">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center shadow-large mr-4">
              <DollarSign className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-blue-800 dark:text-blue-300">Cost Configuration</h2>
              <p className="text-blue-600 dark:text-blue-400">Set competitive pricing with bulk discounts to maximize revenue</p>
            </div>
          </div>
          {isSyncing && (
            <div className="flex items-center text-blue-600 dark:text-blue-400">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2"></div>
              <span className="text-sm font-medium">Syncing to web app...</span>
            </div>
          )}
          {/* 🔥 NEW: Force Sync Button */}
          {!isSyncing && costConfigs.length > 0 && (
            <button
              onClick={handleForceSyncConfigs}
              className="btn-primary shadow-large hover:shadow-xl"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Force Sync All Pricing
            </button>
          )}
        </div>
      </div>

      {/* Selection Controls */}
      <div className="card p-6 shadow-large">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
          <Target className="h-5 w-5 mr-2" />
          Configuration Setup
        </h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="space-y-3">
            <div className="form-group">
              <label className="form-label">Paper Size</label>
              <select
                value={selectedSize}
                onChange={(e) => setSelectedSize(e.target.value as PaperSize)}
                className="input cursor-pointer"
              >
                {allPaperSizes.map(size => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <div className="form-group">
              <label className="form-label">Color Mode</label>
              <select
                value={selectedColorMode}
                onChange={(e) => setSelectedColorMode(e.target.value as 'Color' | 'BW')}
                className="input cursor-pointer"
              >
                <option value="BW">Black & White</option>
                <option value="Color">Color</option>
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <div className="form-group">
              <label className="form-label">Print Type</label>
              <select
                value={selectedPrintType}
                onChange={(e) => setSelectedPrintType(e.target.value as 'Single' | 'Double')}
                className="input cursor-pointer"
              >
                <option value="Single">Single Sided</option>
                <option value="Double">Double Sided</option>
              </select>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="form-group">
              <label className="form-label">Base Price per Page (₹)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-semibold">₹</span>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={basePricePerPage}
                  onChange={(e) => setBasePricePerPage(parseFloat(e.target.value) || 0)}
                  className="input pl-8 cursor-visible"
                  placeholder="1.00"
                />
              </div>
              <p className="form-help">Default price when no bulk tiers apply</p>
            </div>
          </div>

          <div className="flex items-end">
            <button
              onClick={handleAddOrUpdateConfig}
              disabled={isSyncing}
              className="w-full btn-primary shadow-large hover:shadow-xl transform hover:scale-105 transition-all duration-300 disabled:opacity-50"
            >
              <Save className="h-4 w-4 mr-2" />
              {currentConfig ? 'Update Base Price' : 'Set Base Price'}
            </button>
          </div>
        </div>
      </div>

      {/* Current Configuration Display */}
      {currentConfig && (
        <div className="card p-6 shadow-large">
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center mb-6 gap-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
                <TrendingUp className="h-5 w-5 mr-2" />
                {selectedSize} - {selectedColorMode} - {selectedPrintType}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Base Price: <span className="font-bold text-blue-600 dark:text-blue-400">₹{currentConfig.basePricePerPage.toFixed(2)}</span> per page
              </p>
            </div>
            <button
              onClick={() => handleRemoveConfig(selectedSize, selectedColorMode, selectedPrintType)}
              disabled={isSyncing}
              className="btn-danger shadow-large hover:shadow-xl disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Remove Configuration
            </button>
          </div>

          {/* Bulk Pricing Tiers */}
          <div className="space-y-4">
            <h4 className="font-bold text-gray-900 dark:text-white flex items-center">
              <Calculator className="h-4 w-4 mr-2" />
              Bulk Pricing Tiers
            </h4>
            
            {currentConfig.tiers.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {currentConfig.tiers.map((tier) => (
                  <div key={tier.id} className="card p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border-blue-200 dark:border-blue-800 hover:shadow-lg transition-all duration-300">
                    {editingTier === tier.id ? (
                      <div className="space-y-3\" onClick={(e) => e.stopPropagation()}>
                        <div className="form-group">
                          <label className="form-label">Tier Name</label>
                          <input
                            type="text"
                            value={editingTierData?.name || ''}
                            onChange={(e) => setEditingTierData(prev => ({ ...prev, name: e.target.value }))}
                            className="input cursor-visible"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="form-group">
                            <label className="form-label">Min Quantity</label>
                            <input
                              type="number"
                              min="1"
                              value={editingTierData?.minQuantity || 1}
                              onChange={(e) => setEditingTierData(prev => ({ ...prev, minQuantity: parseInt(e.target.value) || 1 }))}
                              className="input cursor-visible"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Max Quantity</label>
                            <input
                              type="number"
                              value={editingTierData?.maxQuantity || ''}
                              onChange={(e) => setEditingTierData(prev => ({ ...prev, maxQuantity: e.target.value ? parseInt(e.target.value) : null }))}
                              className="input cursor-visible"
                              placeholder="Unlimited"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Price per Page (₹)</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            value={editingTierData?.pricePerPage || 0}
                            onChange={(e) => setEditingTierData(prev => ({ ...prev, pricePerPage: parseFloat(e.target.value) || 0 }))}
                            className="input cursor-visible"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSaveEditTier();
                            }}
                            disabled={isSyncing}
                            className="btn-primary flex-1 disabled:opacity-50"
                          >
                            <Save className="h-3 w-3 mr-2" />
                            Save
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCancelEdit();
                            }}
                            className="btn-secondary flex-1"
                          >
                            <X className="h-3 w-3 mr-2" />
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="cursor-pointer" onClick={() => handleEditTier(tier)}>
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            <h5 className="font-bold text-blue-800 dark:text-blue-300">{tier.name}</h5>
                            <p className="text-blue-600 dark:text-blue-400 text-sm">
                              {tier.minQuantity} - {tier.maxQuantity || '∞'} pages
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditTier(tier);
                              }}
                              className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 dark:hover:bg-blue-800 rounded transition-colors"
                            >
                              <Edit3 className="h-3 w-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveTier(tier.id);
                              }}
                              disabled={isSyncing}
                              className="p-1 text-red-600 hover:text-red-800 hover:bg-red-100 dark:hover:bg-red-800 rounded transition-colors disabled:opacity-50"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                        
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600 dark:text-gray-400 text-sm">Price per page:</span>
                            <span className="text-lg font-bold text-blue-600 dark:text-blue-400">₹{tier.pricePerPage.toFixed(2)}</span>
                          </div>
                          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Savings: ₹{(currentConfig.basePricePerPage - tier.pricePerPage).toFixed(2)} per page
                          </div>
                        </div>
                        
                        <div className="mt-3 text-center">
                          <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">Click to edit</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <Calculator className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400 font-medium">No bulk pricing tiers configured</p>
                <p className="text-gray-400 dark:text-gray-500 text-sm">Add tiers below to offer volume discounts</p>
              </div>
            )}

            {/* Validation Errors */}
            {validationErrors.length > 0 && (
              <div className="alert-error animate-scale-in">
                <AlertTriangle className="h-4 w-4 mr-2" />
                <div>
                  <strong>Please fix the following errors:</strong>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    {validationErrors.map((error, index) => (
                      <li key={index}>{error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Add New Tier Form */}
            <div className="card p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border-blue-200 dark:border-blue-800 shadow-large">
              <h5 className="font-bold text-blue-800 dark:text-blue-300 mb-4 flex items-center">
                <Plus className="h-4 w-4 mr-2" />
                Add New Bulk Pricing Tier
              </h5>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="form-label text-blue-800 dark:text-blue-300">Tier Name</label>
                    <input
                      type="text"
                      placeholder="e.g., Small Bulk, Large Order"
                      value={newTier.name}
                      onChange={(e) => setNewTier({ ...newTier, name: e.target.value })}
                      className="input cursor-visible border-blue-300 dark:border-blue-600 focus:ring-blue-500"
                      autoComplete="off"
                      spellCheck="false"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label text-blue-800 dark:text-blue-300">Price per Page (₹)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-semibold">₹</span>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        placeholder="0.50"
                        value={newTier.pricePerPage}
                        onChange={(e) => setNewTier({ ...newTier, pricePerPage: parseFloat(e.target.value) || 0 })}
                        className="input pl-8 cursor-visible border-blue-300 dark:border-blue-600 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  <div className="form-group">
                    <label className="form-label text-blue-800 dark:text-blue-300">Min Quantity</label>
                    <input
                      type="number"
                      min="1"
                      placeholder="1"
                      value={newTier.minQuantity}
                      onChange={(e) => setNewTier({ ...newTier, minQuantity: parseInt(e.target.value) || 1 })}
                      className="input cursor-visible border-blue-300 dark:border-blue-600 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label text-blue-800 dark:text-blue-300">Max Quantity (optional)</label>
                    <input
                      type="number"
                      min={newTier.minQuantity}
                      placeholder="Leave empty for unlimited"
                      value={newTier.maxQuantity || ''}
                      onChange={(e) => setNewTier({ ...newTier, maxQuantity: e.target.value ? parseInt(e.target.value) : null })}
                      className="input cursor-visible border-blue-300 dark:border-blue-600 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div className="flex items-end">
                    <button
                      onClick={handleAddTier}
                      disabled={!newTier.name.trim() || isSyncing}
                      className="w-full btn-primary shadow-large hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Tier
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* All Configurations Overview */}
      <div className="card p-6 shadow-large">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">All Cost Configurations</h3>
          
          {/* 🔥 NEW: Force Sync Button */}
          {costConfigs.length > 0 && (
            <button
              onClick={handleForceSyncConfigs}
              disabled={isSyncing}
              className="btn-primary shadow-large hover:shadow-xl disabled:opacity-50"
            >
              {isSyncing ? (
                <div className="flex items-center">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Syncing...
                </div>
              ) : (
                <div className="flex items-center">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Force Sync All Pricing
                </div>
              )}
            </button>
          )}
        </div>
        
        {costConfigs.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {costConfigs.map((config, index) => (
              <div 
                key={`${config.paperSize}-${config.colorMode}-${config.printType}`} 
                className="card p-4 cursor-pointer hover:shadow-xl transition-all duration-300 border-2 border-transparent hover:border-blue-200 dark:hover:border-blue-700 animate-scale-in transform hover:scale-105"
                style={{ animationDelay: `${index * 100}ms` }}
                onClick={() => handleSetConfigForSize(config.paperSize, config.colorMode, config.printType)}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center shadow-soft mr-3">
                      <span className="text-white font-bold text-xs">{config.paperSize}</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 dark:text-white">{config.paperSize}</h4>
                      <p className="text-xs text-gray-600 dark:text-gray-400">{config.colorMode} • {config.printType}</p>
                    </div>
                  </div>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveConfig(config.paperSize, config.colorMode, config.printType);
                    }}
                    disabled={isSyncing}
                    className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-all duration-200 disabled:opacity-50"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
                
                <div className="space-y-2">
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 dark:text-gray-400 text-sm">Base Price:</span>
                      <span className="font-bold text-blue-600 dark:text-blue-400">₹{config.basePricePerPage.toFixed(2)}/page</span>
                    </div>
                  </div>
                  
                  {config.tiers.length > 0 && (
                    <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3">
                      <div className="flex justify-between items-center">
                        <span className="text-blue-600 dark:text-blue-400 text-sm">Bulk Tiers:</span>
                        <span className="font-bold text-blue-600 dark:text-blue-400">{config.tiers.length} tier{config.tiers.length > 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="mt-3 text-center">
                  <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">Click to configure</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <DollarSign className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h4 className="text-lg font-bold text-gray-500 dark:text-gray-400 mb-3">No cost configurations set up yet</h4>
            <p className="text-gray-400 dark:text-gray-500 mb-6">Select a paper size, color mode, and print type above to get started</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-lg mx-auto">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                <Target className="h-6 w-6 text-blue-600 mx-auto mb-2" />
                <p className="text-xs font-medium text-blue-800 dark:text-blue-300">Set Base Prices</p>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                <TrendingUp className="h-6 w-6 text-blue-600 mx-auto mb-2" />
                <p className="text-xs font-medium text-blue-800 dark:text-blue-300">Add Bulk Tiers</p>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                <Calculator className="h-6 w-6 text-blue-600 mx-auto mb-2" />
                <p className="text-xs font-medium text-blue-800 dark:text-blue-300">Preview Costs</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Real-time Status */}
      <div className="card p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border-blue-200 dark:border-blue-800 shadow-large">
        <div className="flex items-center text-blue-800 dark:text-blue-300">
          <div className="w-3 h-3 bg-blue-500 rounded-full mr-3 animate-pulse"></div>
          <CheckCircle className="h-5 w-5 mr-2" />
          <span className="font-semibold">Configuration changes are automatically synced to your web app in real-time</span>
        </div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="flex items-center">
            <CheckCircle className="h-3 w-3 text-blue-600 mr-2" />
            <span>Instant price updates</span>
          </div>
          <div className="flex items-center">
            <CheckCircle className="h-3 w-3 text-blue-600 mr-2" />
            <span>Dynamic bulk discounts</span>
          </div>
          <div className="flex items-center">
            <CheckCircle className="h-3 w-3 text-blue-600 mr-2" />
            <span>Real-time cost calculator</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CostConfig;