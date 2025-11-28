import React, { useState, useEffect } from 'react';
import { Printer, PaperSize, PrinterConfigItem } from '../types';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { GripVertical, Trash2, Plus, X, Settings, CheckCircle, Monitor, Wifi, RefreshCw, FileText, FileImage } from 'lucide-react';
import { syncPrinterConfigs } from '../utils/supabase';

interface PrinterConfigProps {
  printers: Printer[];
  configs: PrinterConfigItem[];
  customSizes: PaperSize[];
  onConfigUpdate: (configs: PrinterConfigItem[]) => void;
  onCustomSizesUpdate: (sizes: PaperSize[]) => void;
}

const DEFAULT_PAPER_SIZES: PaperSize[] = ['A3', 'A4', 'A5', 'Letter', 'Legal', 'Executive'];

const PrinterConfig: React.FC<PrinterConfigProps> = ({ 
  printers, 
  configs, 
  customSizes,
  onConfigUpdate,
  onCustomSizesUpdate 
}) => {
  const [selectedSize, setSelectedSize] = useState<PaperSize>('A4');
  const [selectedPrinter, setSelectedPrinter] = useState<string>('');
  const [customSize, setCustomSize] = useState('');
  const [showCustomSizeInput, setShowCustomSizeInput] = useState(false);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [testingPrinter, setTestingPrinter] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<{[key: string]: {success: boolean, message?: string, error?: string}}>({});
  const [availablePaperSizes, setAvailablePaperSizes] = useState<any[]>([]);
  const [showTestPrintPanel, setShowTestPrintPanel] = useState(false);
  const [testPrintSize, setTestPrintSize] = useState<PaperSize>('A4');
  const [testPrintPrinter, setTestPrintPrinter] = useState<string>('');
  const [isCreatingTestFile, setIsCreatingTestFile] = useState(false);
  const [testFilePath, setTestFilePath] = useState<string | null>(null);

  const allPaperSizes = [...DEFAULT_PAPER_SIZES, ...customSizes];

  // 🔥 NEW: Load available paper sizes from system
  useEffect(() => {
    const loadPaperSizes = async () => {
      if (window.electron) {
        try {
          const result = await window.electron.getAvailablePaperSizes();
          if (result.success && result.paperSizes) {
            setAvailablePaperSizes(result.paperSizes);
            
            // Add any system paper sizes that aren't in our defaults or custom sizes
            const systemSizes = result.paperSizes.map(size => size.key);
            const newCustomSizes = systemSizes.filter(size => 
              !DEFAULT_PAPER_SIZES.includes(size as PaperSize) && 
              !customSizes.includes(size as PaperSize)
            );
            
            if (newCustomSizes.length > 0) {
              onCustomSizesUpdate([...customSizes, ...newCustomSizes as PaperSize[]]);
            }
          }
        } catch (error) {
          console.error('Failed to load paper sizes:', error);
        }
      }
    };
    
    loadPaperSizes();
  }, []);

  useEffect(() => {
    // Save configs to localStorage for persistence
    localStorage.setItem('printer-configs', JSON.stringify(configs));
  }, [configs]);

  const getConfigForSize = (size: PaperSize) => {
    return configs.find(c => c.paperSize === size) || { paperSize: size, printers: [] };
  };

  // 🔥 ENHANCED: Test printer function with paper size
  const testPrinter = async (printerName: string) => {
    if (!window.electron) {
      alert('Print functionality is only available in the desktop app');
      return;
    }

    setTestingPrinter(printerName);

    try {
      console.log('🧪 Testing printer with paper size:', { printerName, paperSize: selectedSize });
      const result = await window.electron.testPrint(printerName, selectedSize);
      
      console.log('🧪 Test result:', result);
      
      if (result.success) {
        // Show success notification
        const event = new CustomEvent('show-notification', {
          detail: {
            type: 'success',
            message: `Test print sent to ${printerName} with ${selectedSize} paper successfully!`
          }
        });
        window.dispatchEvent(event);
      } else {
        // Show error notification
        const event = new CustomEvent('show-notification', {
          detail: {
            type: 'error',
            message: `Test print failed: ${result.error}`
          }
        });
        window.dispatchEvent(event);
      }
      
      setTestResults(prev => ({
        ...prev,
        [printerName]: {
          success: result.success,
          message: result.success ? `Test print successful with ${selectedSize} paper!` : undefined,
          error: result.error
        }
      }));
    } catch (error) {
      console.error('❌ Test print error:', error);
      
      setTestResults(prev => ({
        ...prev,
        [printerName]: {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }));
      
      // Show error notification
      const event = new CustomEvent('show-notification', {
        detail: {
          type: 'error',
          message: `Test print error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      });
      window.dispatchEvent(event);
    } finally {
      setTestingPrinter(null);
    }
  };

  // 🔥 NEW: Create and print test image
  const createAndPrintTestImage = async () => {
    if (!window.electron || !testPrintPrinter) {
      alert('Print functionality is only available in the desktop app');
      return;
    }

    setIsCreatingTestFile(true);

    try {
      // First create a test image file
      const imageResult = await window.electron.createTestImage(testPrintSize);
      
      if (!imageResult.success) {
        throw new Error(imageResult.error || 'Failed to create test image');
      }
      
      setTestFilePath(imageResult.filePath);
      
      // Now print it
      const printResult = await window.electron.directPrintWindows(
        imageResult.filePath,
        testPrintPrinter,
        testPrintSize,
        1
      );
      
      if (printResult.success) {
        // Show success notification
        const event = new CustomEvent('show-notification', {
          detail: {
            type: 'success',
            message: `Test image printed on ${testPrintSize} paper successfully!`
          }
        });
        window.dispatchEvent(event);
      } else {
        throw new Error(printResult.error || 'Failed to print test image');
      }
    } catch (error) {
      console.error('❌ Test image print error:', error);
      
      // Show error notification
      const event = new CustomEvent('show-notification', {
        detail: {
          type: 'error',
          message: `Test image print error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      });
      window.dispatchEvent(event);
    } finally {
      setIsCreatingTestFile(false);
    }
  };

  // 🔥 NEW: Create and print test PDF
  const createAndPrintTestPdf = async () => {
    if (!window.electron || !testPrintPrinter) {
      alert('Print functionality is only available in the desktop app');
      return;
    }

    setIsCreatingTestFile(true);

    try {
      // First create a test PDF file
      const pdfResult = await window.electron.createTestPdf(testPrintSize);
      
      if (!pdfResult.success) {
        throw new Error(pdfResult.error || 'Failed to create test PDF');
      }
      
      setTestFilePath(pdfResult.filePath);
      
      // Now print it
      const printResult = await window.electron.directPrintWindows(
        pdfResult.filePath,
        testPrintPrinter,
        testPrintSize,
        1
      );
      
      if (printResult.success) {
        // Show success notification
        const event = new CustomEvent('show-notification', {
          detail: {
            type: 'success',
            message: `Test PDF printed on ${testPrintSize} paper successfully!`
          }
        });
        window.dispatchEvent(event);
      } else {
        throw new Error(printResult.error || 'Failed to print test PDF');
      }
    } catch (error) {
      console.error('❌ Test PDF print error:', error);
      
      // Show error notification
      const event = new CustomEvent('show-notification', {
        detail: {
          type: 'error',
          message: `Test PDF print error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      });
      window.dispatchEvent(event);
    } finally {
      setIsCreatingTestFile(false);
    }
  };

  // 🔥 NEW: Sync configurations to Supabase database
  const syncConfigsToDatabase = async (updatedConfigs: PrinterConfigItem[]) => {
    setIsSyncing(true);
    try {
      const shopId = localStorage.getItem('shop-id');
      const currentUser = JSON.parse(localStorage.getItem('user-session') || '{}');
      
      if (shopId && currentUser.id) {
        console.log('🔄 Syncing printer configs to database...', updatedConfigs);
        
        const result = await syncPrinterConfigs(shopId, updatedConfigs);
        
        if (result.success) {
          console.log('✅ Printer configs synced to database successfully!');
          
          // Show success notification
          const event = new CustomEvent('show-notification', {
            detail: {
              type: 'success',
              message: `Printer configurations synced! ${updatedConfigs.length} configs updated.`
            }
          });
          window.dispatchEvent(event);
        } else {
          console.warn('⚠️ Failed to sync printer configs:', result.error);
          
          // Show error notification
          const event = new CustomEvent('show-notification', {
            detail: {
              type: 'error',
              message: 'Failed to sync printer configurations. Please try again.'
            }
          });
          window.dispatchEvent(event);
        }
      }
    } catch (error) {
      console.error('❌ Error syncing printer configs:', error);
      
      // Show error notification
      const event = new CustomEvent('show-notification', {
        detail: {
          type: 'error',
          message: 'Error syncing printer configurations. Check your connection.'
        }
      });
      window.dispatchEvent(event);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAddCustomSize = async () => {
    if (customSize && !allPaperSizes.includes(customSize as PaperSize)) {
      const newSizes = [...customSizes, customSize as PaperSize];
      onCustomSizesUpdate(newSizes);
      setCustomSize('');
      setShowCustomSizeInput(false);
      
      // 🔥 NEW: Sync to database after adding custom size
      await syncConfigsToDatabase(configs);
    }
  };

  const handleRemoveSize = async (size: PaperSize) => {
    if (!DEFAULT_PAPER_SIZES.includes(size)) {
      onCustomSizesUpdate(customSizes.filter(s => s !== size));
      const updatedConfigs = configs.filter(c => c.paperSize !== size);
      onConfigUpdate(updatedConfigs);
      
      // 🔥 NEW: Sync to database after removing size
      await syncConfigsToDatabase(updatedConfigs);
    }
  };

  const handleAddPrinter = async () => {
    if (!selectedPrinter) return;

    const newConfigs = [...configs];
    const configIndex = newConfigs.findIndex(c => c.paperSize === selectedSize);

    if (configIndex >= 0) {
      if (!newConfigs[configIndex].printers.includes(selectedPrinter)) {
        newConfigs[configIndex].printers.push(selectedPrinter);
      }
    } else {
      newConfigs.push({
        paperSize: selectedSize,
        printers: [selectedPrinter]
      });
    }

    onConfigUpdate(newConfigs);
    setSelectedPrinter('');
    
    // 🔥 NEW: Sync to database after adding printer
    await syncConfigsToDatabase(newConfigs);
  };

  const handleRemovePrinter = async (size: PaperSize, printerName: string) => {
    const newConfigs = configs.map(config => {
      if (config.paperSize === size) {
        return {
          ...config,
          printers: config.printers.filter(p => p !== printerName)
        };
      }
      return config;
    });
    onConfigUpdate(newConfigs);
    
    // 🔥 NEW: Sync to database after removing printer
    await syncConfigsToDatabase(newConfigs);
  };

  // COMPLETELY FIXED: Proper drag and drop system
  const handleDragStart = (start: any) => {
    setDraggedItem(start.draggableId);
  };

  const handleDragEnd = async (result: any) => {
    setDraggedItem(null);
    
    const { destination, source, draggableId } = result;

    // If dropped outside a droppable area or in same position
    if (!destination || (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    )) {
      return;
    }

    const sourceSize = source.droppableId as PaperSize;
    const destSize = destination.droppableId as PaperSize;
    
    // Extract printer name from draggableId (format: "size-printerName")
    const printerName = draggableId.replace(`${sourceSize}-`, '');

    // Create new configs array
    let newConfigs = [...configs];

    // Find source config
    let sourceConfigIndex = newConfigs.findIndex(c => c.paperSize === sourceSize);
    if (sourceConfigIndex === -1) {
      return; // Source config should exist
    }

    // Find or create destination config
    let destConfigIndex = newConfigs.findIndex(c => c.paperSize === destSize);
    if (destConfigIndex === -1) {
      newConfigs.push({ paperSize: destSize, printers: [] });
      destConfigIndex = newConfigs.length - 1;
    }

    if (sourceSize === destSize) {
      // Reordering within same container
      const printers = Array.from(newConfigs[sourceConfigIndex].printers);
      const [removed] = printers.splice(source.index, 1);
      printers.splice(destination.index, 0, removed);
      
      newConfigs[sourceConfigIndex] = {
        ...newConfigs[sourceConfigIndex],
        printers: printers
      };
    } else {
      // Moving between different containers
      const sourcePrinters = Array.from(newConfigs[sourceConfigIndex].printers);
      const destPrinters = Array.from(newConfigs[destConfigIndex].printers);
      
      // Remove from source
      sourcePrinters.splice(source.index, 1);
      
      // Add to destination if not already there
      if (!destPrinters.includes(printerName)) {
        destPrinters.splice(destination.index, 0, printerName);
      }
      
      // Update both configs
      newConfigs[sourceConfigIndex] = {
        ...newConfigs[sourceConfigIndex],
        printers: sourcePrinters
      };
      
      newConfigs[destConfigIndex] = {
        ...newConfigs[destConfigIndex],
        printers: destPrinters
      };
    }

    // Remove empty configs
    newConfigs = newConfigs.filter(config => config.printers.length > 0);

    onConfigUpdate(newConfigs);
    
    // 🔥 NEW: Sync to database after drag and drop
    await syncConfigsToDatabase(newConfigs);
  };

  // Get paper size description
  const getPaperSizeDescription = (size: string) => {
    const paperSize = availablePaperSizes.find(s => s.key === size);
    return paperSize ? paperSize.description : size;
  };

  return (
    <div className="space-y-6 h-full">
      {/* Header Section */}
      <div className="card p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border-blue-200 dark:border-blue-800 shadow-large">
        <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center shadow-large mr-4">
              <Settings className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-blue-800 dark:text-blue-300">Paper Size Configuration</h2>
              <p className="text-blue-600 dark:text-blue-400">Assign printers to different paper sizes for optimal workflow</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowTestPrintPanel(!showTestPrintPanel)}
              className="btn-secondary shadow-large hover:shadow-xl transform hover:scale-105 transition-all duration-300"
            >
              <FileText className="h-4 w-4 mr-2" />
              Test Print Panel
            </button>
            <button
              onClick={() => setShowCustomSizeInput(true)}
              className="btn-primary shadow-large hover:shadow-xl transform hover:scale-105 transition-all duration-300"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Custom Size
            </button>
          </div>
        </div>
        
        {/* Sync Status Indicator */}
        {isSyncing && (
          <div className="mt-4 flex items-center text-blue-600 dark:text-blue-400">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2"></div>
            <span className="text-sm font-medium">Syncing printer configurations to web app...</span>
          </div>
        )}
      </div>

      {/* 🔥 NEW: Test Print Panel */}
      {showTestPrintPanel && (
        <div className="card p-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 border-green-200 dark:border-green-800 shadow-large animate-scale-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-green-800 dark:text-green-300 flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Test Print Different Paper Sizes
            </h3>
            <button
              onClick={() => setShowTestPrintPanel(false)}
              className="p-2 hover:bg-green-100 dark:hover:bg-green-800 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-green-600 dark:text-green-400" />
            </button>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="form-group">
                <label className="form-label text-green-800 dark:text-green-300">Select Paper Size</label>
                <select
                  value={testPrintSize}
                  onChange={(e) => setTestPrintSize(e.target.value as PaperSize)}
                  className="input cursor-pointer border-green-300 dark:border-green-600 focus:ring-green-500"
                >
                  {allPaperSizes.map(size => (
                    <option key={size} value={size}>
                      {size} {availablePaperSizes.find(s => s.key === size)?.description ? `(${getPaperSizeDescription(size)})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="form-group">
                <label className="form-label text-green-800 dark:text-green-300">Select Printer</label>
                <select
                  value={testPrintPrinter}
                  onChange={(e) => setTestPrintPrinter(e.target.value)}
                  className="input cursor-pointer border-green-300 dark:border-green-600 focus:ring-green-500"
                >
                  <option value="">Select a printer</option>
                  {printers.map(printer => (
                    <option key={printer.name} value={printer.name}>
                      {printer.name} {printer.status === 'Ready' ? '✓' : '⚠️'}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex flex-col gap-4">
                <button
                  onClick={createAndPrintTestImage}
                  disabled={!testPrintPrinter || isCreatingTestFile}
                  className="btn-primary py-3 shadow-large hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreatingTestFile ? (
                    <div className="flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-3"></div>
                      Printing Test Image...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center">
                      <FileImage className="h-5 w-5 mr-3" />
                      Print Test Image on {testPrintSize}
                    </div>
                  )}
                </button>
                
                <button
                  onClick={createAndPrintTestPdf}
                  disabled={!testPrintPrinter || isCreatingTestFile}
                  className="btn-secondary py-3 shadow-large hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isCreatingTestFile ? (
                    <div className="flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-gray-600 border-t-transparent rounded-full animate-spin mr-3"></div>
                      Printing Test PDF...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center">
                      <FileText className="h-5 w-5 mr-3" />
                      Print Test PDF on {testPrintSize}
                    </div>
                  )}
                </button>
              </div>
              
              {testFilePath && (
                <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg text-sm text-green-800 dark:text-green-300">
                  <div className="font-medium mb-1">Test file created:</div>
                  <div className="font-mono text-xs break-all">{testFilePath}</div>
                </div>
              )}
            </div>
          </div>
          
          <div className="mt-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-green-200 dark:border-green-700">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <strong className="text-green-800 dark:text-green-300">How to use:</strong> Select a paper size and printer, then click one of the test print buttons. 
              This will create a test file and send it to your printer with the selected paper size. 
              Check if the printer uses the correct paper size for the print job.
            </p>
          </div>
        </div>
      )}

      {/* Custom Size Input Modal */}
      {showCustomSizeInput && (
        <div className="card p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border-blue-200 dark:border-blue-800 shadow-large animate-scale-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-blue-800 dark:text-blue-300 flex items-center">
              <Plus className="h-5 w-5 mr-2" />
              Add Custom Paper Size
            </h3>
            <button
              onClick={() => setShowCustomSizeInput(false)}
              className="p-2 hover:bg-blue-100 dark:hover:bg-blue-800 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </button>
          </div>
          
          <div className="space-y-4">
            <div className="form-group">
              <label className="form-label text-blue-800 dark:text-blue-300">Custom Paper Size Name</label>
              <input
                type="text"
                value={customSize}
                onChange={(e) => setCustomSize(e.target.value.toUpperCase())}
                placeholder="Enter custom size (e.g., B4, A6, CUSTOM)"
                className="input cursor-visible border-blue-300 dark:border-blue-600 focus:ring-blue-500"
                autoComplete="off"
                spellCheck="false"
              />
              <p className="form-help text-blue-600 dark:text-blue-400">Enter a unique name for your custom paper size</p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={handleAddCustomSize}
                disabled={!customSize.trim() || isSyncing}
                className="btn-primary flex-1 shadow-large hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Add Custom Size
              </button>
              <button
                onClick={() => setShowCustomSizeInput(false)}
                className="btn-secondary flex-1 shadow-large hover:shadow-xl"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Configuration Controls */}
      <div className="card p-6 shadow-large">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center">
          <Monitor className="h-5 w-5 mr-2" />
          Quick Configuration
        </h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="form-group">
              <label className="form-label">Select Paper Size</label>
              <select
                value={selectedSize}
                onChange={(e) => setSelectedSize(e.target.value as PaperSize)}
                className="input cursor-pointer"
              >
                {allPaperSizes.map(size => (
                  <option key={size} value={size}>
                    {size} {availablePaperSizes.find(s => s.key === size)?.description ? `(${getPaperSizeDescription(size)})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <div className="form-group">
              <label className="form-label">Add Printer to {selectedSize}</label>
              <div className="flex gap-3">
                <select
                  value={selectedPrinter}
                  onChange={(e) => setSelectedPrinter(e.target.value)}
                  className="input flex-1 cursor-pointer"
                >
                  <option value="">Select a printer to assign</option>
                  {printers.map(printer => (
                    <option key={printer.name} value={printer.name}>
                      {printer.name} {printer.status === 'Ready' ? '✓' : '⚠️'}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleAddPrinter}
                  disabled={!selectedPrinter || isSyncing}
                  className="btn-primary px-6 shadow-large hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Assign
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* COMPLETELY FIXED: Perfect Drag & Drop System */}
      <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 flex-1">
          {allPaperSizes.map((size, index) => {
            const sizeConfig = getConfigForSize(size);
            return (
              <div 
                key={size} 
                className="card p-4 hover:shadow-xl transition-all duration-300 border-2 border-transparent hover:border-blue-200 dark:hover:border-blue-700 animate-scale-in flex flex-col h-full min-h-[300px]"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Card Header */}
                <div className="flex justify-between items-start mb-4 flex-shrink-0">
                  <div className="flex items-center min-w-0 flex-1">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center shadow-soft mr-2 flex-shrink-0">
                      <span className="text-white font-bold text-xs">{size.length > 4 ? size.substring(0, 4) : size}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-gray-900 dark:text-white text-sm truncate" title={size}>
                        {size} {availablePaperSizes.find(s => s.key === size)?.description ? `(${getPaperSizeDescription(size)})` : ''}
                      </h3>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {sizeConfig.printers.length} printer{sizeConfig.printers.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  
                  {!DEFAULT_PAPER_SIZES.includes(size) && (
                    <button
                      onClick={() => handleRemoveSize(size)}
                      className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-all duration-200 flex-shrink-0 ml-2"
                      title="Remove custom size"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
                
                {/* PERFECT: Droppable Area with Fixed Positioning */}
                <Droppable droppableId={size}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 flex flex-col space-y-2 p-3 rounded-lg border-2 border-dashed transition-all duration-200 min-h-[120px] ${
                        snapshot.isDraggingOver 
                          ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/30' 
                          : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700'
                      }`}
                    >
                      {sizeConfig.printers.length === 0 ? (
                        <div className="text-center py-4 flex-1 flex flex-col justify-center">
                          <Wifi className={`h-6 w-6 mx-auto mb-2 ${snapshot.isDraggingOver ? 'text-blue-500' : 'text-gray-400'}`} />
                          <p className={`font-medium text-xs ${snapshot.isDraggingOver ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
                            {snapshot.isDraggingOver ? 'Drop here' : 'No printers'}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">Drag printers here</p>
                        </div>
                      ) : (
                        <div className="space-y-2 flex-1">
                          {sizeConfig.printers.map((printerName, printerIndex) => {
                            const printer = printers.find(p => p.name === printerName);
                            const isDragging = draggedItem === `${size}-${printerName}`;
                            
                            return (
                              <Draggable 
                                key={`${size}-${printerName}`} 
                                draggableId={`${size}-${printerName}`} 
                                index={printerIndex}
                              >
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    className={`flex items-center justify-between p-2 rounded-lg transition-all duration-200 ${
                                      snapshot.isDragging 
                                        ? 'bg-white dark:bg-gray-800 shadow-2xl z-50 border-2 border-blue-400 transform rotate-2' 
                                        : 'bg-white dark:bg-gray-800 hover:shadow-md border border-gray-200 dark:border-gray-600'
                                    }`}
                                    style={{
                                      ...provided.draggableProps.style,
                                      // CRITICAL: Ensure proper positioning during drag
                                      position: snapshot.isDragging ? 'fixed' : 'relative',
                                      zIndex: snapshot.isDragging ? 9999 : 'auto',
                                      pointerEvents: snapshot.isDragging ? 'none' : 'auto'
                                    }}
                                  >
                                    <div className="flex items-center flex-1 min-w-0">
                                      <span 
                                        {...provided.dragHandleProps} 
                                        className="mr-2 cursor-grab active:cursor-grabbing flex-shrink-0 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                                      >
                                        <GripVertical className="h-3 w-3 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400" />
                                      </span>
                                      
                                      <div className="flex items-center flex-1 min-w-0">
                                        <div className={`w-2 h-2 rounded-full mr-2 flex-shrink-0 ${
                                          printer?.status === 'Ready' ? 'bg-green-500' : 'bg-yellow-500'
                                        }`}></div>
                                        <div className="flex-1 min-w-0">
                                          <p className="font-medium text-gray-900 dark:text-white text-xs truncate" title={printerName}>
                                            {printerName}
                                          </p>
                                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                            {printer?.status || 'Unknown'}
                                            {printer?.default && ' • Default'}
                                          </p>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-1">
                                      {/* 🔥 ENHANCED: Test printer with paper size */}
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          testPrinter(printerName);
                                        }}
                                        disabled={testingPrinter === printerName}
                                        className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-all duration-200 ml-1 flex-shrink-0"
                                        title={`Test printer with ${size} paper`}
                                      >
                                        {testingPrinter === printerName ? (
                                          <RefreshCw className="h-3 w-3 animate-spin" />
                                        ) : (
                                          <RefreshCw className="h-3 w-3" />
                                        )}
                                      </button>
                                      
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleRemovePrinter(size, printerName);
                                        }}
                                        className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-all duration-200 ml-1 flex-shrink-0"
                                        title="Remove printer"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            );
                          })}
                        </div>
                      )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
                
                {/* Test result message */}
                {sizeConfig.printers.map(printerName => (
                  testResults[printerName] && (
                    <div key={`result-${printerName}`} className={`mt-1 text-xs p-2 rounded ${
                      testResults[printerName].success 
                        ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300' 
                        : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                    }`}>
                      {testResults[printerName].success ? (
                        <div className="flex items-center">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          {testResults[printerName].message || `Test print successful with ${size}!`}
                        </div>
                      ) : (
                        <div className="flex items-center">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          {testResults[printerName].error || 'Test print failed'}
                        </div>
                      )}
                    </div>
                  )
                ))}
              </div>
            );
          })}
        </div>
      </DragDropContext>

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
            <span>Instant updates to customer app</span>
          </div>
          <div className="flex items-center">
            <CheckCircle className="h-3 w-3 text-blue-600 mr-2" />
            <span>Automatic printer availability</span>
          </div>
          <div className="flex items-center">
            <CheckCircle className="h-3 w-3 text-blue-600 mr-2" />
            <span>Smart load balancing</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrinterConfig;