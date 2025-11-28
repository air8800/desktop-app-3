import React, { useState, useEffect } from 'react';
import { PrintJob, JobFilters } from '../types';
import { Clock, Check, AlertTriangle, Filter, Search, Download, Eye, MoreVertical, User, FileText, Calendar, Printer, ExternalLink, Trash2, Settings, RefreshCw, CheckCircle } from 'lucide-react';
import PdfPreview from './PdfPreview';
import Modal from './Modal';
import ConfirmationModal from './ConfirmationModal';
import ActionMenu, { 
  createViewDetailsAction, 
  createDeleteAction, 
  createDownloadAction, 
  createPreviewAction, 
  createOpenFileAction,
  createCancelAction,
  createMarkCompletedAction,
  createPrintAction
} from './ActionMenu';
import { deletePrintJob, updatePrintJob } from '../utils/supabase';
import { truncateFilename, isPdfFile } from '../utils/fileUtils';

interface JobListProps {
  jobs: PrintJob[];
  onMarkPrinted: (jobId: string) => void;
}

const JobList: React.FC<JobListProps> = ({ jobs, onMarkPrinted }) => {
  const [filters, setFilters] = useState<JobFilters>({
    status: 'all',
    paymentStatus: 'all',
    searchQuery: '',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [printingJobs, setPrintingJobs] = useState<Set<string>>(new Set());
  const [showPrinterSelection, setShowPrinterSelection] = useState<string | null>(null);
  const [availablePrinters, setAvailablePrinters] = useState<any[]>([]);
  const [testingPrinter, setTestingPrinter] = useState<string | null>(null);
  const [printResults, setPrintResults] = useState<{[key: string]: {success: boolean, message?: string, error?: string}}>({});
  const [selectedPaperSize, setSelectedPaperSize] = useState<string>('');
  const [selectedCopies, setSelectedCopies] = useState<number>(1);
  const [selectedColorMode, setSelectedColorMode] = useState<'BW' | 'Color'>('BW');
  const [selectedPrintType, setSelectedPrintType] = useState<'Single' | 'Double'>('Single');
  const [selectedNupPages, setSelectedNupPages] = useState<number>(1);
  const [selectedNupOrientation, setSelectedNupOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [availablePaperSizes, setAvailablePaperSizes] = useState<any[]>([]);
  const [downloadedFilePath, setDownloadedFilePath] = useState<string | null>(null);
  const [showPrintOutput, setShowPrintOutput] = useState(false);
  const [printOutput, setPrintOutput] = useState<string>('');
  const [showPdfPreview, setShowPdfPreview] = useState<string | null>(null);
  const [muPDFInstalled, setMuPDFInstalled] = useState<boolean>(false);
  const [ghostscriptInstalled, setGhostscriptInstalled] = useState<boolean>(false);
  const [selectedJob, setSelectedJob] = useState<PrintJob | null>(null);
  const [showJobDetails, setShowJobDetails] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [deletedJobIds, setDeletedJobIds] = useState<Set<string>>(new Set());
  const [cancelledJobIds, setCancelledJobIds] = useState<Set<string>>(new Set());
  const [processingJobs, setProcessingJobs] = useState<Set<string>>(new Set());

  // Load available paper sizes
  useEffect(() => {
    const loadPaperSizes = async () => {
      if (window.electron) {
        try {
          const result = await window.electron.getAvailablePaperSizes();
          if (result.success && result.paperSizes) {
            setAvailablePaperSizes(result.paperSizes);
          }
        } catch (error) {
          console.error('Failed to load paper sizes:', error);
        }
      }
    };
    
    loadPaperSizes();
  }, []);

  // Check if MuPDF and Ghostscript are installed
  useEffect(() => {
    const checkPdfTools = async () => {
      if (window.electron) {
        try {
          // Check MuPDF
          const muPdfResult = await window.electron.checkMuPDFInstalled();
          if (muPdfResult.success) {
            setMuPDFInstalled(muPdfResult.installed);
            if (muPdfResult.installed) {
              console.log('MuPDF is installed:', muPdfResult.version);
            }
          }
          
          // Check Ghostscript
          const gsResult = await window.electron.checkGhostscriptInstalled();
          if (gsResult.success) {
            setGhostscriptInstalled(gsResult.installed);
            if (gsResult.installed) {
              console.log('Ghostscript is installed:', gsResult.version);
              
              // Show notification
              const event = new CustomEvent('show-notification', {
                detail: {
                  type: 'info',
                  message: `Ghostscript is installed: ${gsResult.version || 'Unknown version'}`
                }
              });
              window.dispatchEvent(event);
            }
          }
        } catch (error) {
          console.error('Failed to check PDF tools installation:', error);
        }
      }
    };
    
    checkPdfTools();
  }, []);

  const filteredJobs = jobs
    .filter(job => !deletedJobIds.has(job.id))
    .filter(job => {
      if (filters.status !== 'all' && job.job_status !== filters.status) {
        return false;
      }
      
      if (filters.paymentStatus !== 'all' && job.payment_status !== filters.paymentStatus) {
        return false;
      }
      
      if (filters.searchQuery && !job.filename.toLowerCase().includes(filters.searchQuery.toLowerCase()) && 
          !job.customer_name.toLowerCase().includes(filters.searchQuery.toLowerCase())) {
        return false;
      }
      
      return true;
    });

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { name, value } = e.target;
    setFilters(prevFilters => ({
      ...prevFilters,
      [name]: value,
    }));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4" />;
      case 'printing':
        return <Printer className="h-4 w-4" />;
      case 'completed':
        return <Check className="h-4 w-4" />;
      case 'cancelled':
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'status-pending';
      case 'printing':
        return 'status-pending';
      case 'completed':
        return 'status-completed';
      case 'cancelled':
        return 'status-cancelled';
      default:
        return 'status-cancelled';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'failed':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return 'Invalid date';
    }
  };

  const downloadFile = async (fileUrl: string, filename: string) => {
    try {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading file:', error);
      alert('Failed to download file');
    }
  };

  // Get configured printer for paper size
  const getConfiguredPrinter = (paperSize: string) => {
    try {
      const printerConfigs = JSON.parse(localStorage.getItem('printer-configs') || '[]');
      const config = printerConfigs.find((c: any) => c.paperSize === paperSize);
      
      if (config && config.printers && config.printers.length > 0) {
        // Return the first configured printer for this paper size
        return config.printers[0];
      }
      
      return null;
    } catch (error) {
      console.error('Error getting printer config:', error);
      return null;
    }
  };

  // Show printer selection modal with paper size
  const showPrinterSelectionModal = async (jobId: string) => {
    try {
      const printersResult = await window.electron.getPrinters();
      if (!printersResult.success || !printersResult.printers.length) {
        alert('No printers available');
        return;
      }

      // Find the job
      const job = jobs.find(j => j.id === jobId);
      if (job) {
        // Pre-fill all settings from the job data
        setSelectedPaperSize(job.paper_size);
        setSelectedCopies(job.copies);
        setSelectedColorMode(job.color_mode as 'BW' | 'Color');
        setSelectedPrintType(job.print_type as 'Single' | 'Double');
        setSelectedNupPages(job.pages_per_sheet || 1);
        setSelectedNupOrientation(job.nup_orientation || 'portrait');
        setSelectedJob(job);
      }

      setAvailablePrinters(printersResult.printers);
      setShowPrinterSelection(jobId);
    } catch (error) {
      console.error('Error getting printers:', error);
      alert('Failed to get available printers');
    }
  };

  // Test printer function with paper size
  const testPrinter = async (printerName: string) => {
    if (!window.electron) {
      alert('Print functionality is only available in the desktop app');
      return;
    }

    setTestingPrinter(printerName);

    try {
      console.log('🧪 Testing printer with paper size:', { printerName, paperSize: selectedPaperSize });
      const result = await window.electron.testPrint(printerName, selectedPaperSize);
      console.log('🧪 Test result:', result);
      
      if (result.success) {
        // Show success notification
        const event = new CustomEvent('show-notification', {
          detail: {
            type: 'success',
            message: `Test print sent to ${printerName} with ${selectedPaperSize} paper successfully!`
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
      
      setPrintResults(prev => ({
        ...prev,
        [printerName]: {
          success: result.success,
          message: result.success ? `Test print successful with ${selectedPaperSize}!` : undefined,
          error: result.error
        }
      }));
    } catch (error) {
      console.error('❌ Test print error:', error);
      
      setPrintResults(prev => ({
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

  // Download file for direct printing
  const downloadFileForDirectPrinting = async (job: PrintJob) => {
    if (!window.electron) {
      alert('Print functionality is only available in the desktop app');
      return null;
    }

    try {
      // First download the file
      const result = await window.electron.openFileForPrinting(job.file_url, job.filename);
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to download file');
      }
      
      console.log('✅ File downloaded for direct printing:', result.filePath);
      setDownloadedFilePath(result.filePath);
      
      return result.filePath;
    } catch (error) {
      console.error('❌ Failed to download file for direct printing:', error);
      return null;
    }
  };

  // Direct Windows printing
  const handleDirectWindowsPrint = async (job: PrintJob, printerName: string, paperSize: string, copies: number, colorMode: string, printType: string) => {
    if (!window.electron) {
      alert('Print functionality is only available in the desktop app');
      return;
    }

    setPrintingJobs(prev => new Set(prev).add(job.id));
    setPrintOutput('');
    setShowPrintOutput(true);

    try {
      // First download the file
      const filePath = await downloadFileForDirectPrinting(job);
      
      if (!filePath) {
        throw new Error('Failed to download file for printing');
      }
      
      // Check if it's a PDF file
      const isPdf = job.filename.toLowerCase().endsWith('.pdf');
      
      if (isPdf) {
        // Use silent PDF printing for PDFs
        const result = await window.electron.printPdf(
          filePath,
          printerName,
          paperSize,
          copies,
          colorMode,
          printType
        );
        
        if (!result.success) {
          throw new Error(result.error || 'PDF printing failed');
        }
        
        console.log('✅ PDF printing completed:', result);
        
        const pdfToolName = ghostscriptInstalled ? 'Ghostscript' : (muPDFInstalled ? 'MuPDF' : 'SumatraPDF');
        setPrintOutput(prev => prev + `PDF print job sent successfully to ${printerName}!\n\nThe file is being printed silently with ${pdfToolName}.\n`);
      } else {
        // Use direct Windows printing for non-PDFs
        const result = await window.electron.directPrintWindows(
          filePath,
          printerName,
          paperSize,
          copies,
          colorMode,
          printType
        );
        
        if (!result.success) {
          throw new Error(result.error || 'Direct printing failed');
        }
        
        console.log('✅ Direct Windows printing completed:', result);
        
        setPrintOutput(prev => prev + `Print job sent successfully!\nA command window should have opened to execute the print.\n\nIf you don't see any printing activity, please check the command window for details.\n`);
      }
      
      // Show success notification
      const event = new CustomEvent('show-notification', {
        detail: {
          type: 'success',
          message: `Print job sent to ${printerName} on ${paperSize} paper.`
        }
      });
      window.dispatchEvent(event);
      
      // Mark job as completed
      onMarkPrinted(job.id);
      
    } catch (error) {
      console.error('❌ Direct Windows printing failed:', error);
      
      setPrintOutput(prev => prev + `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again or use a different printer.`);
      
      // Show error notification
      const event = new CustomEvent('show-notification', {
        detail: {
          type: 'error',
          message: `Direct printing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      });
      window.dispatchEvent(event);
    } finally {
      setPrintingJobs(prev => {
        const newSet = new Set(prev);
        newSet.delete(job.id);
        return newSet;
      });
    }
  };

  // Print job with selected printer and paper size
  const handlePrintJob = async (job: PrintJob, printOptions?: any) => {
    console.log('🔍🔍🔍 JOBLIST: nupOrientation received:', printOptions?.nupOrientation);
    console.log('🔍🔍🔍 JOBLIST: typeof printOptions?.nupOrientation:', typeof printOptions?.nupOrientation);
    if (!window.electron) {
      alert('Print functionality is only available in the desktop app');
      return;
    }

    setPrintingJobs(prev => new Set(prev).add(job.id));
    setPrintOutput('');
    setShowPrintOutput(true);

    try {
      console.log('🖨️ Starting print job for:', job.filename);

      // 🔥 CRITICAL: Build final parameters with explicit orientation handling
      const finalNupOrientation = printOptions?.nupOrientation || 'landscape';
      console.log('🔍🔍🔍 JOBLIST: Final nupOrientation being sent to Electron:', finalNupOrientation);
      console.log('🔍🔍🔍 JOBLIST: typeof finalNupOrientation:', typeof finalNupOrientation);
      console.log('🔍🔍🔍 JOBLIST: JSON.stringify(finalNupOrientation):', JSON.stringify(finalNupOrientation));
      console.log('🔍🔍🔍 JOBLIST: About to call window.electron.downloadAndPrintFile...');
      
      let printerName = printOptions?.printerName;

      // If no printer selected, try to get configured printer for paper size
      if (!printerName) {
        printerName = getConfiguredPrinter(selectedPaperSize || job.paper_size);
      }

      // If still no printer, get available printers and use default
      if (!printerName) {
        const printersResult = await window.electron.getPrinters();
        if (!printersResult.success || !printersResult.printers.length) {
          throw new Error('No printers available');
        }

        const defaultPrinter = printersResult.printers.find(p => p.default) || printersResult.printers[0];
        printerName = defaultPrinter.name;
      }
      
      console.log('🖨️ Using printer:', printerName);
      console.log('📄 Paper size:', selectedPaperSize || job.paper_size);
      console.log('🎨 Color mode:', selectedColorMode || job.color_mode);
      console.log('📄 Print type:', selectedPrintType || job.print_type);
      console.log('🔢 Copies:', selectedCopies || job.copies);

      setPrintOutput(prev => prev + `Starting print job...\nFile: ${job.filename}\nPrinter: ${printerName}\nPaper Size: ${selectedPaperSize || job.paper_size}\nCopies: ${selectedCopies || job.copies}\nColor Mode: ${selectedColorMode || job.color_mode}\nPrint Type: ${selectedPrintType || job.print_type}\n\n`);

      // Check if it's a PDF file
      const isPdf = job.filename.toLowerCase().endsWith('.pdf');
      
      if (isPdf) {
        // For PDFs, use the downloadAndPrintFile function which will use silent PDF printing
        const result = await window.electron.downloadAndPrintFile(
          job.file_url,
          job.filename,
          printerName,
          selectedCopies || job.copies,
          selectedPaperSize || job.paper_size,
          selectedColorMode || job.color_mode,
          selectedPrintType || job.print_type,
          selectedNupPages || job.nup_pages || 1,
          selectedNupOrientation || job.nup_orientation || 'portrait'
        );
        
        if (!result.success) {
          throw new Error(result.error || 'PDF printing failed');
        }
        
        console.log('✅ PDF printing completed:', result);
        
        const pdfToolName = ghostscriptInstalled ? 'Ghostscript' : (muPDFInstalled ? 'MuPDF' : 'SumatraPDF');
        setPrintOutput(prev => prev + `PDF print job sent successfully to ${printerName}!\n\nThe file is being printed silently with ${pdfToolName}.\n`);
        
        // Show success notification
        const event = new CustomEvent('show-notification', {
          detail: {
            type: 'success',
            message: `Print job sent to ${printerName} on ${selectedPaperSize || job.paper_size} paper.`
          }
        });
        window.dispatchEvent(event);
        
        // Mark job as completed
        onMarkPrinted(job.id);
      } else {
        // For non-PDFs, use direct Windows printing
        await handleDirectWindowsPrint(
          job, 
          printerName, 
          selectedPaperSize || job.paper_size, 
          selectedCopies || job.copies,
          selectedColorMode || job.color_mode,
          selectedPrintType || job.print_type
        );
      }

    } catch (error) {
      console.error('❌ Print job failed:', error);
      
      setPrintOutput(prev => prev + `ERROR: ${error instanceof Error ? error.message : 'Unknown error'}\n\nPlease try again or use a different printer.`);
      
      // Show error notification
      const event = new CustomEvent('show-notification', {
        detail: {
          type: 'error',
          message: `Print failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      });
      window.dispatchEvent(event);
    } finally {
      setPrintingJobs(prev => {
        const newSet = new Set(prev);
        newSet.delete(job.id);
        return newSet;
      });
      setShowPrinterSelection(null);
    }
  };

  // Open file for manual printing
  const handleOpenForPrinting = async (job: PrintJob) => {
    if (!window.electron) {
      alert('File opening functionality is only available in the desktop app');
      return;
    }

    try {
      console.log('📂 Opening file for manual printing:', job.filename);

      const result = await window.electron.openFileForPrinting(job.file_url, job.filename);

      if (!result.success) {
        throw new Error(result.error || 'Failed to open file');
      }

      console.log('✅ File opened successfully:', result.message);

      // Show success notification
      const event = new CustomEvent('show-notification', {
        detail: {
          type: 'success',
          message: `Opened ${job.filename} for manual printing`
        }
      });
      window.dispatchEvent(event);

    } catch (error) {
      console.error('❌ Failed to open file:', error);
      
      // Show error notification
      const event = new CustomEvent('show-notification', {
        detail: {
          type: 'error',
          message: `Failed to open file: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      });
      window.dispatchEvent(event);
    }
  };

  // Handle PDF preview
  const handlePreviewPdf = (job: PrintJob) => {
    // Check if the file is a PDF by extension
    if (!job.filename.toLowerCase().endsWith('.pdf')) {
      // Show error notification
      const event = new CustomEvent('show-notification', {
        detail: {
          type: 'error',
          message: 'This file is not a PDF. Only PDF files can be previewed.'
        }
      });
      window.dispatchEvent(event);
      return;
    }
    
    setShowPdfPreview(job.file_url);
  };

  // Handle print from preview
  const handlePrintFromPreview = (job: PrintJob) => {
    return async (printOptions: {
      printerName: string;
      paperSize: string;
      copies: number;
      colorMode: string;
      printType: string;
      nupPages: number;
      nupOrientation: string;
    }) => {
      try {
        console.log('🖨️ JobList handlePrintFromPreview called with print options:', printOptions);
        console.log('🖨️ Detailed parameters being passed:');
        console.log('  - Printer Name:', printOptions.printerName);
        console.log('  - Paper Size:', printOptions.paperSize);
        console.log('  - Copies:', printOptions.copies);
        console.log('  - Color Mode:', printOptions.colorMode);
        console.log('  - Print Type:', printOptions.printType);
        console.log('  - N-up Pages:', printOptions.nupPages);
        console.log('  - N-up Orientation:', printOptions.nupOrientation);
        
        // Show loading notification
        const event = new CustomEvent('show-notification', {
          detail: {
            type: 'info',
            message: `Sending print job to ${printOptions.printerName}...`
          }
        });
        window.dispatchEvent(event);

        // Call the print function with correct parameter order
        const result = await window.electron.downloadAndPrintFile(
          job.file_url,
          job.filename,
          printOptions.printerName,
          printOptions.copies,
          printOptions.paperSize,
          printOptions.colorMode,
          printOptions.printType,
          printOptions.nupPages,
          printOptions.nupOrientation
        );

        console.log('🖨️ Print result from Electron:', result);

        if (result.success) {
          console.log('✅ Print job completed successfully:', result.message);
          
          // Mark job as completed
          onMarkPrinted(job.id);
          
          // Show success notification
          const successEvent = new CustomEvent('show-notification', {
            detail: {
              type: 'success',
              message: `Print job sent to ${printOptions.printerName} successfully! ${printOptions.nupPages > 1 ? `${printOptions.nupPages} pages per sheet (${printOptions.nupOrientation})` : ''}`
            }
          });
          window.dispatchEvent(successEvent);
          
          // Close preview modal
          setShowPdfPreview(null);
        } else {
          console.error('❌ Print job failed:', result.error);
          
          // Show error notification
          const errorEvent = new CustomEvent('show-notification', {
            detail: {
              type: 'error',
              message: `Print failed on ${printOptions.printerName}: ${result.error || 'Unknown error'}`
            }
          });
          window.dispatchEvent(errorEvent);
        }
      } catch (error) {
        console.error('❌ Print error in handlePrintFromPreview:', error);
        
        // Show error notification
        const errorEvent = new CustomEvent('show-notification', {
          detail: {
            type: 'error',
            message: `Print error on ${printOptions.printerName}: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        });
        window.dispatchEvent(errorEvent);
      }
    };
  };

  // Show job details
  const handleViewJobDetails = (job: PrintJob) => {
    setSelectedJob(job);
    setShowJobDetails(true);
  };

  // Handle delete job
  const handleDeleteJob = (job: PrintJob) => {
    setSelectedJob(job);
    setShowDeleteConfirmation(true);
  };

  // Confirm delete job
  const confirmDeleteJob = async () => {
    if (!selectedJob) return;
    
    setIsDeleting(true);
    
    try {
      const { error } = await deletePrintJob(selectedJob.id);
      
      if (error) {
        throw new Error(error.message);
      }
      
      // Add to deleted jobs set
      setDeletedJobIds(prev => new Set(prev).add(selectedJob.id));
      
      // Show success notification
      const event = new CustomEvent('show-notification', {
        detail: {
          type: 'success',
          message: `Job "${truncateFilename(selectedJob.filename, 20)}" deleted successfully`
        }
      });
      window.dispatchEvent(event);
      
      // Close confirmation modal
      setShowDeleteConfirmation(false);
      
    } catch (error) {
      console.error('Error deleting job:', error);
      
      // Show error notification
      const event = new CustomEvent('show-notification', {
        detail: {
          type: 'error',
          message: `Failed to delete job: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      });
      window.dispatchEvent(event);
      
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle cancel job
  const handleCancelJob = (job: PrintJob) => {
    setSelectedJob(job);
    setShowCancelConfirmation(true);
  };

  // Confirm cancel job
  const confirmCancelJob = async () => {
    if (!selectedJob) return;
    
    setIsCancelling(true);
    
    try {
      const { error } = await updatePrintJob(selectedJob.id, { 
        job_status: 'cancelled',
        updated_at: new Date().toISOString()
      });
      
      if (error) {
        throw new Error(error.message);
      }
      
      // Add to cancelled jobs set for UI update
      setCancelledJobIds(prev => new Set(prev).add(selectedJob.id));
      
      // Update the job in the local state
      const updatedJob = {
        ...selectedJob,
        job_status: 'cancelled',
        updated_at: new Date().toISOString()
      };
      
      setSelectedJob(updatedJob);
      
      // Show success notification
      const event = new CustomEvent('show-notification', {
        detail: {
          type: 'success',
          message: `Job "${truncateFilename(selectedJob.filename, 20)}" cancelled successfully`
        }
      });
      window.dispatchEvent(event);
      
      // Close confirmation modal
      setShowCancelConfirmation(false);
      
    } catch (error) {
      console.error('Error cancelling job:', error);
      
      // Show error notification
      const event = new CustomEvent('show-notification', {
        detail: {
          type: 'error',
          message: `Failed to cancel job: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      });
      window.dispatchEvent(event);
      
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="card p-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center mb-6 gap-4">
        <div className="flex items-center">
          <div className="w-10 h-10 bg-gradient-primary rounded-xl flex items-center justify-center shadow-soft mr-3">
            <FileText className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Print Jobs</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">{filteredJobs.length} of {jobs.length} jobs</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              name="searchQuery"
              value={filters.searchQuery}
              onChange={handleFilterChange}
              placeholder="Search jobs..."
              className="input pl-10 w-64"
            />
          </div>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-secondary ${showFilters ? 'bg-blue-100 dark:bg-blue-900' : ''}`}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="card p-4 mb-6 bg-gray-50 dark:bg-gray-700 animate-slide-up">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="form-group">
              <label className="form-label">Status</label>
              <select
                name="status"
                value={filters.status}
                onChange={handleFilterChange}
                className="input"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="printing">Printing</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            
            <div className="form-group">
              <label className="form-label">Payment</label>
              <select
                name="paymentStatus"
                value={filters.paymentStatus}
                onChange={handleFilterChange}
                className="input"
              >
                <option value="all">All Payments</option>
                <option value="paid">Paid</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
            </div>
            
            <div className="form-group">
              <label className="form-label">Quick Filters</label>
              <div className="flex gap-2">
                <button 
                  onClick={() => setFilters(prev => ({ ...prev, status: 'pending' }))}
                  className="btn-secondary text-xs"
                >
                  Pending Only
                </button>
                <button 
                  onClick={() => setFilters({ status: 'all', paymentStatus: 'all', searchQuery: '' })}
                  className="btn-secondary text-xs"
                >
                  Clear All
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PDF Preview Modal */}
      {showPdfPreview && (
        <Modal isOpen={!!showPdfPreview} onClose={() => setShowPdfPreview(null)} title="" maxWidth="max-w-4xl" showCloseButton={false}>
          <PdfPreview
            fileUrl={showPdfPreview}
            jobData={(() => {
              const job = jobs.find(j => j.file_url === showPdfPreview);
              return job ? {
                paper_size: job.paper_size,
                copies: job.copies,
                color_mode: job.color_mode as 'BW' | 'Color',
                print_type: job.print_type as 'Single' | 'Double',
                pages_per_sheet: job.pages_per_sheet || 1,
                nup_orientation: job.nup_orientation || 'portrait'
              } : undefined;
            })()}
            onPrint={(() => {
              const job = jobs.find(j => j.file_url === showPdfPreview);
              return job ? handlePrintFromPreview(job) : () => {};
            })()}
            onClose={() => setShowPdfPreview(null)}
          />
        </Modal>
      )}

      {/* Print Output Modal */}
      {showPrintOutput && (
        <Modal isOpen={showPrintOutput} onClose={() => setShowPrintOutput(false)} title="Print Job Status">
          <div className="bg-black text-green-400 font-mono text-sm p-4 rounded-lg h-64 overflow-y-auto mb-4">
            {printOutput || 'Waiting for print output...'}
          </div>
          
          <div className="flex justify-between">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              PDF files are printed silently using {ghostscriptInstalled ? 'Ghostscript' : (muPDFInstalled ? 'MuPDF' : 'SumatraPDF')} without opening any windows.
            </p>
            <button
              onClick={() => setShowPrintOutput(false)}
              className="btn-primary"
            >
              Close
            </button>
          </div>
        </Modal>
      )}

      {/* Job Details Modal */}
      {selectedJob && showJobDetails && (
        <Modal 
          isOpen={showJobDetails} 
          onClose={() => setShowJobDetails(false)} 
          title="Job Details"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900 dark:to-indigo-900 rounded-lg flex items-center justify-center">
                <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-gray-900 dark:text-white break-anywhere">
                  {selectedJob.filename}
                </h3>
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                  <Calendar className="h-3 w-3 mr-1" />
                  {formatDate(selectedJob.created_at)}
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-semibold text-gray-900 dark:text-white">Customer Information</h4>
                <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                  <div className="flex items-center mb-2">
                    <User className="h-4 w-4 text-gray-500 mr-2" />
                    <span className="font-medium">{selectedJob.customer_name}</span>
                  </div>
                  {selectedJob.customer_email && (
                    <div className="text-sm text-gray-600 dark:text-gray-400 ml-6">
                      Email: {selectedJob.customer_email}
                    </div>
                  )}
                  {selectedJob.customer_phone && (
                    <div className="text-sm text-gray-600 dark:text-gray-400 ml-6">
                      Phone: {selectedJob.customer_phone}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-semibold text-gray-900 dark:text-white">Job Status</h4>
                <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-600 dark:text-gray-400">Status:</span>
                    <span className={`${getStatusColor(selectedJob.job_status)}`}>
                      {getStatusIcon(selectedJob.job_status)}
                      <span className="ml-1">{selectedJob.job_status.charAt(0).toUpperCase() + selectedJob.job_status.slice(1)}</span>
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Payment:</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${getPaymentStatusColor(selectedJob.payment_status)}`}>
                      {selectedJob.payment_status.charAt(0).toUpperCase() + selectedJob.payment_status.slice(1)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-semibold text-gray-900 dark:text-white">Print Specifications</h4>
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400 text-sm">Copies:</span>
                    <p className="font-medium">{selectedJob.copies}</p>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400 text-sm">Paper Size:</span>
                    <p className="font-medium">{selectedJob.paper_size}</p>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400 text-sm">Color Mode:</span>
                    <p className="font-medium">{selectedJob.color_mode}</p>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400 text-sm">Print Type:</span>
                    <p className="font-medium">{selectedJob.print_type}</p>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400 text-sm">Layout:</span>
                    <p className="font-medium">
                      {selectedJob.pages_per_sheet === 1
                        ? '1-up (Normal)'
                        : `${selectedJob.pages_per_sheet}-up`}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <h4 className="font-semibold text-gray-900 dark:text-white">Payment Information</h4>
              <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Total Cost:</span>
                  <span className="text-xl font-bold text-green-600 dark:text-green-400">₹{selectedJob.total_cost}</span>
                </div>
              </div>
            </div>
            
            {selectedJob.notes && (
              <div className="space-y-2">
                <h4 className="font-semibold text-gray-900 dark:text-white">Notes</h4>
                <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                  <p className="text-gray-600 dark:text-gray-400">{selectedJob.notes}</p>
                </div>
              </div>
            )}
            
            <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              {selectedJob.job_status === 'pending' && (
                <button
                  onClick={() => {
                    setShowJobDetails(false);
                    showPrinterSelectionModal(selectedJob.id);
                  }}
                  className="btn-primary"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Print Now
                </button>
              )}
              
              {selectedJob.job_status !== 'completed' && selectedJob.job_status !== 'cancelled' && (
                <button
                  onClick={() => {
                    setShowJobDetails(false);
                    onMarkPrinted(selectedJob.id);
                  }}
                  className="btn-success"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Mark Completed
                </button>
              )}
              
              {selectedJob.job_status !== 'cancelled' && (
                <button
                  onClick={() => {
                    setShowJobDetails(false);
                    handleCancelJob(selectedJob);
                  }}
                  className="btn-warning"
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Cancel Job
                </button>
              )}
              
              <button
                onClick={() => downloadFile(selectedJob.file_url, selectedJob.filename)}
                className="btn-secondary"
              >
                <Download className="h-4 w-4 mr-2" />
                Download File
              </button>
              
              {isPdfFile(selectedJob.filename) && (
                <button
                  onClick={() => {
                    setShowJobDetails(false);
                    handlePreviewPdf(selectedJob);
                  }}
                  className="btn-secondary"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Preview PDF
                </button>
              )}
              
              <button
                onClick={() => handleOpenForPrinting(selectedJob)}
                className="btn-secondary"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Open File
              </button>
              
              <button
                onClick={() => {
                  setShowJobDetails(false);
                  handleDeleteJob(selectedJob);
                }}
                className="btn-danger"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Job
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirmation}
        onClose={() => setShowDeleteConfirmation(false)}
        onConfirm={confirmDeleteJob}
        title="Delete Job"
        message={`Are you sure you want to delete the job "${selectedJob?.filename}"? This action cannot be undone.`}
        confirmText="Delete Job"
        cancelText="Cancel"
        type="delete"
        isProcessing={isDeleting}
      />

      {/* Cancel Confirmation Modal */}
      <ConfirmationModal
        isOpen={showCancelConfirmation}
        onClose={() => setShowCancelConfirmation(false)}
        onConfirm={confirmCancelJob}
        title="Cancel Job"
        message={`Are you sure you want to cancel the job "${selectedJob?.filename}"? This will mark the job as cancelled.`}
        confirmText="Cancel Job"
        cancelText="Keep Job"
        type="cancel"
        isProcessing={isCancelling}
      />

      {/* Printer Selection Modal */}
      {showPrinterSelection && (
        <Modal isOpen={!!showPrinterSelection} onClose={() => setShowPrinterSelection(null)} title="Print Options">
          <div className="space-y-4">
            {/* Paper Size Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Paper Size
              </label>
              <select
                value={selectedPaperSize}
                onChange={(e) => setSelectedPaperSize(e.target.value)}
                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
              >
                {availablePaperSizes.map((size) => (
                  <option key={size.key} value={size.key}>
                    {size.name} ({size.description})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Make sure your printer supports this paper size
              </p>
            </div>
            
            {/* Copies Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Copies
              </label>
              <input
                type="number"
                min="1"
                max="100"
                value={selectedCopies}
                onChange={(e) => setSelectedCopies(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
              />
            </div>
            
            {/* Color Mode Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Color Mode
              </label>
              <select
                value={selectedColorMode}
                onChange={(e) => setSelectedColorMode(e.target.value as 'BW' | 'Color')}
                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
              >
                <option value="BW">Black & White</option>
                <option value="Color">Color</option>
              </select>
            </div>
            
            {/* Print Type Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Print Type
              </label>
              <select
                value={selectedPrintType}
                onChange={(e) => setSelectedPrintType(e.target.value as 'Single' | 'Double')}
                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg"
              >
                <option value="Single">Single Sided</option>
                <option value="Double">Double Sided</option>
              </select>
            </div>
            
            <div className="space-y-3 max-h-60 overflow-y-auto">
              <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">Select Printer:</h4>
              {availablePrinters.map((printer, index) => (
                <div key={index} className="relative">
                  <button
                    onClick={() => {
                      const job = jobs.find(j => j.id === showPrinterSelection);
                      if (job) {
                        // Create a modified job with the selected options
                        const modifiedJob = {
                          ...job,
                          paper_size: selectedPaperSize || job.paper_size,
                          copies: selectedCopies || job.copies,
                          color_mode: selectedColorMode || job.color_mode,
                          print_type: selectedPrintType || job.print_type
                        };
                        handlePrintJob(modifiedJob, { printerName: printer.name });
                      }
                    }}
                    disabled={testingPrinter === printer.name}
                    className="w-full p-3 flex items-center justify-between bg-gray-50 dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                  >
                    <div className="flex items-center">
                      <div className={`w-2 h-2 rounded-full mr-3 ${printer.status === 'Ready' ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                      <span className="font-medium">{printer.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {printer.default && (
                        <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-300 px-2 py-1 rounded-full">
                          Default
                        </span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          testPrinter(printer.name);
                        }}
                        disabled={testingPrinter === printer.name}
                        className="p-1 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-full"
                        title={`Test printer with ${selectedPaperSize} paper`}
                      >
                        {testingPrinter === printer.name ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </button>
                  
                  {/* Test result message */}
                  {printResults[printer.name] && (
                    <div className={`mt-1 text-xs p-2 rounded ${
                      printResults[printer.name].success 
                        ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300' 
                        : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                    }`}>
                      {printResults[printer.name].success ? (
                        <div className="flex items-center">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          {printResults[printer.name].message || `Test print successful with ${selectedPaperSize}!`}
                        </div>
                      ) : (
                        <div className="flex items-center">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          {printResults[printer.name].error || 'Test print failed'}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  const job = jobs.find(j => j.id === showPrinterSelection);
                  if (job) {
                    // Create a modified job with the selected options
                    const modifiedJob = {
                      ...job,
                      paper_size: selectedPaperSize || job.paper_size,
                      copies: selectedCopies || job.copies,
                      color_mode: selectedColorMode || job.color_mode,
                      print_type: selectedPrintType || job.print_type
                    };
                    handlePrintJob(modifiedJob);
                  }
                }}
                className="btn-primary flex-1"
              >
                <Printer className="h-4 w-4 mr-2" />
                Use Configured Printer
              </button>
              <button
                onClick={() => setShowPrinterSelection(null)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Jobs Grid */}
      <div className="space-y-4">
        {filteredJobs.length > 0 ? (
          filteredJobs.map((job, index) => {
            // Check if job is in the cancelled jobs set
            const isCancelled = job.job_status === 'cancelled' || cancelledJobIds.has(job.id);
            
            // Create action menu items
            const actionItems = [];
            
            // View details action
            actionItems.push(createViewDetailsAction(() => handleViewJobDetails(job)));
            
            // Preview PDF action (if it's a PDF)
            if (isPdfFile(job.filename)) {
              actionItems.push(createPreviewAction(() => handlePreviewPdf(job), true));
            }
            
            // Print action (if job is not completed or cancelled)
            if (job.job_status !== 'completed' && !isCancelled) {
              actionItems.push(createPrintAction(() => showPrinterSelectionModal(job.id)));
            }
            
            // Mark completed action (if job is not completed or cancelled)
            if (job.job_status !== 'completed' && !isCancelled) {
              actionItems.push(createMarkCompletedAction(() => onMarkPrinted(job.id)));
            }
            
            // Cancel action (if job is not completed or cancelled)
            if (job.job_status !== 'completed' && !isCancelled) {
              actionItems.push(createCancelAction(() => handleCancelJob(job)));
            }
            
            // Open file action
            actionItems.push(createOpenFileAction(() => handleOpenForPrinting(job)));
            
            // Download action
            actionItems.push(createDownloadAction(() => downloadFile(job.file_url, job.filename)));
            
            // Delete action
            actionItems.push(createDeleteAction(() => handleDeleteJob(job)));
            
            return (
              <div
                key={job.id}
                className="card p-6 hover:shadow-medium transition-all duration-200 animate-scale-in"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex flex-col gap-4">
                  {/* Job Header */}
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900 dark:to-indigo-900 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                        {truncateFilename(job.filename, 40)}
                      </h3>
                      <div className="flex flex-wrap items-center gap-4 mt-1 text-sm text-gray-600 dark:text-gray-400">
                        <div className="flex items-center">
                          <User className="h-3 w-3 mr-1" />
                          {job.customer_name}
                        </div>
                        <div className="flex items-center">
                          <Calendar className="h-3 w-3 mr-1" />
                          {formatDate(job.created_at)}
                        </div>
                        {job.customer_phone && (
                          <div className="flex items-center">
                            📞 {job.customer_phone}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Job Details - Fixed Grid Layout */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-4 gap-y-2 text-sm">
                    <div className="text-center">
                      <p className="text-gray-500 dark:text-gray-400">Copies</p>
                      <p className="font-semibold text-gray-900 dark:text-white">x {job.copies}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-500 dark:text-gray-400">Type</p>
                      <p className="font-semibold text-gray-900 dark:text-white">{job.print_type}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-500 dark:text-gray-400">Color</p>
                      <p className="font-semibold text-gray-900 dark:text-white">{job.color_mode}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-500 dark:text-gray-400">Size</p>
                      <p className="font-semibold text-gray-900 dark:text-white">{job.paper_size}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-500 dark:text-gray-400">Layout</p>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {job.pages_per_sheet === 1 ? '1-up' : `${job.pages_per_sheet}-up`}
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-500 dark:text-gray-400">Cost</p>
                      <p className="font-semibold text-green-600 dark:text-green-400">₹{job.total_cost}</p>
                    </div>
                  </div>

                  {/* Status and Actions - Fixed Layout */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                    <div className="flex flex-wrap gap-2">
                      <span className={`status-indicator ${getStatusColor(isCancelled ? 'cancelled' : job.job_status)}`}>
                        {getStatusIcon(isCancelled ? 'cancelled' : job.job_status)}
                        {isCancelled ? 'Cancelled' : job.job_status.charAt(0).toUpperCase() + job.job_status.slice(1)}
                      </span>
                      <span className={`status-indicator ${getPaymentStatusColor(job.payment_status)}`}>
                        {job.payment_status.charAt(0).toUpperCase() + job.payment_status.slice(1)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Print Button with Paper Size */}
                      {(job.job_status === 'pending' || job.job_status === 'printing') && !isCancelled && (
                        <button
                          onClick={() => showPrinterSelectionModal(job.id)}
                          disabled={printingJobs.has(job.id)}
                          className="btn-primary"
                        >
                          {printingJobs.has(job.id) ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                              Printing...
                            </>
                          ) : (
                            <>
                              <Printer className="h-4 w-4 mr-2" />
                              Print Now
                            </>
                          )}
                        </button>
                      )}
                      
                      {(job.job_status === 'pending' || job.job_status === 'printing') && !isCancelled && (
                        <button
                          onClick={() => onMarkPrinted(job.id)}
                          className="btn-success"
                        >
                          <Check className="h-4 w-4 mr-2" />
                          Mark Completed
                        </button>
                      )}
                      
                      <div className="flex gap-1">
                        <button 
                          className="btn-secondary p-2" 
                          title="View Details"
                          onClick={() => handleViewJobDetails(job)}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        
                        {/* Preview PDF button - Added next to the eye icon */}
                        {isPdfFile(job.filename) && (
                          <button 
                            className="btn-secondary p-2" 
                            title="Preview PDF"
                            onClick={() => handlePreviewPdf(job)}
                          >
                            <FileText className="h-4 w-4" />
                          </button>
                        )}
                        
                        {/* Action Menu */}
                        <ActionMenu items={actionItems} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {jobs.length === 0 ? 'No orders yet' : 'No jobs found'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              {jobs.length === 0 
                ? 'Print jobs will appear here when customers place orders through your web app.'
                : filters.searchQuery || filters.status !== 'all' || filters.paymentStatus !== 'all'
                ? 'Try adjusting your filters to see more results.'
                : 'No jobs match your current filters.'}
            </p>
            {jobs.length === 0 && (
              <div className="mt-6">
                <p className="text-sm text-blue-600 dark:text-blue-400 mb-2">
                  💡 To receive orders:
                </p>
                <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <li>1. Set up your shop information in Settings</li>
                  <li>2. Configure your pricing and printers</li>
                  <li>3. Generate and display your QR code</li>
                  <li>4. Customers scan QR code to place orders</li>
                </ol>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default JobList;