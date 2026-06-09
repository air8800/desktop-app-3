import React, { useState, useEffect, useMemo, useRef } from 'react';
import { PrintJob, JobFilters } from '../types';
import { Clock, Check, AlertTriangle, Search, Download, Eye, User, FileText, Calendar, Printer, ExternalLink, Trash2, RefreshCw, CheckCircle, X, Hash, Banknote } from 'lucide-react';
import { formatPickupOrderLabel, getJobDisplayLabel, jobMatchesSearch, buildOrderMarkPayload } from '../utils/orderIdentification';
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
import { updatePrintJob } from '../utils/supabase';
import { truncateFilename, isPdfFile } from '../utils/fileUtils';
import DownloadManager from './DownloadManager';
import DownloadIndicator from './DownloadIndicator';

interface JobListProps {
  jobs: PrintJob[];
  onMarkPrinted: (jobId: string, details?: { processingTime?: number }) => void;
  onPrintStarted?: (jobId: string, printerName: string, settings: any) => void;
  /** Called after a successful Supabase update so the dashboard list stays in sync (realtime is INSERT-only today). */
  onJobUpdated?: (jobId: string, updates: Partial<PrintJob>) => void;
}

// Elapsed Timer component - shows counting up from a start time
const ElapsedTimer: React.FC<{ startTime: number }> = ({ startTime }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  return <span>{mins}:{secs.toString().padStart(2, '0')}</span>;
};

const JobList: React.FC<JobListProps> = ({ jobs, onMarkPrinted, onPrintStarted, onJobUpdated }) => {
  const [filters, setFilters] = useState<JobFilters>({
    status: 'all',
    paymentStatus: 'all',
    searchQuery: '',
  });
  const [marginSetting, setMarginSetting] = useState<'off' | 'low' | 'normal'>('normal');
  const [printingJobs, setPrintingJobs] = useState<Set<string>>(new Set());
  const [showPrinterSelection, setShowPrinterSelection] = useState<string | null>(null);
  const [availablePrinters] = useState<any[]>([]);
  const [testingPrinter, setTestingPrinter] = useState<string | null>(null);
  const [printResults, setPrintResults] = useState<{ [key: string]: { success: boolean, message?: string, error?: string } }>({});
  const [selectedPaperSize, setSelectedPaperSize] = useState<string>('');
  const [selectedCopies, setSelectedCopies] = useState<number>(1);
  const [selectedColorMode, setSelectedColorMode] = useState<'BW' | 'Color'>('BW');
  const [selectedPrintType, setSelectedPrintType] = useState<'Single' | 'Double'>('Single');
  const [selectedNupPages] = useState<number>(1);
  const [selectedNupOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [availablePaperSizes, setAvailablePaperSizes] = useState<any[]>([]);
  const [downloadedFilePath, setDownloadedFilePath] = useState<string | null>(null);
  const [showPrintOutput, setShowPrintOutput] = useState(false);
  const [printOutput, setPrintOutput] = useState<string>('');
  const [showPdfPreview, setShowPdfPreview] = useState<string | null>(null);
  const [previewJobId, setPreviewJobId] = useState<string | null>(null);
  const [muPDFInstalled, setMuPDFInstalled] = useState<boolean>(false);

  const [selectedJob, setSelectedJob] = useState<PrintJob | null>(null);
  const [recordingPaymentJobId, setRecordingPaymentJobId] = useState<string | null>(null);
  const [showJobDetails, setShowJobDetails] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [deletedJobIds, setDeletedJobIds] = useState<Set<string>>(new Set());
  const [cancelledJobIds, setCancelledJobIds] = useState<Set<string>>(new Set());
  // Ref to access current cancelled state inside async functions
  const cancelledJobIdsRef = useRef(cancelledJobIds);
  useEffect(() => {
    cancelledJobIdsRef.current = cancelledJobIds;
  }, [cancelledJobIds]);

  const [cancellingJobs, setCancellingJobs] = useState<Set<string>>(new Set());
  const [processingJobs, setProcessingJobs] = useState<Set<string>>(new Set());
  // Single-click "Print Now" phase tracking. Drives the button label so the
  // user sees Downloading -> Applying edits -> Printing without any popup.
  type PrintPhase = 'downloading' | 'applying_edits' | 'printing';
  const [printPhases, setPrintPhases] = useState<Map<string, PrintPhase>>(new Map());
  const setPhase = (jobId: string, phase: PrintPhase | null) => {
    setPrintPhases(prev => {
      const next = new Map(prev);
      if (phase) next.set(jobId, phase);
      else next.delete(jobId);
      return next;
    });
  };
  const [isPdfPreviewProcessing, setIsPdfPreviewProcessing] = useState(false);
  const [showDownloadManager, setShowDownloadManager] = useState(false);
  const [downloadStates, setDownloadStates] = useState<Map<string, { status: string; progress: number; filePath?: string }>>(new Map());

  // Print queue tracking
  const [printingStartTimes, setPrintingStartTimes] = useState<Map<string, number>>(new Map());
  const [printDurations, setPrintDurations] = useState<Map<string, number>>(new Map());
  const [showFullQueue, setShowFullQueue] = useState(false);

  // Helper to render job card
  const renderJobCard = (job: PrintJob, index: number, isQueueItem: boolean = false) => {
    const isCancelled = (job.job_status === 'cancelled' || cancelledJobIds.has(job.id)) && job.job_status !== 'completed';
    const isFailed = job.payment_status === 'failed' && job.job_status !== 'completed';
    const phase = printPhases.get(job.id);
    const isThisJobPrinting = !!phase || printingStartTimes.has(job.id) || printingJobs.has(job.id);
    const isThisJobCancelling = cancellingJobs.has(job.id);
    const phaseLabel = phase === 'downloading'
      ? 'Downloading...'
      : phase === 'applying_edits'
        ? 'Applying edits...'
        : phase === 'printing'
          ? 'Printing...'
          : 'Printing...';
    const phaseEmoji = phase === 'downloading' ? '📥' : phase === 'applying_edits' ? '✏️' : '🖨️';
    const phaseStatusText = phase === 'downloading'
      ? 'Downloading'
      : phase === 'applying_edits'
        ? 'Applying edits'
        : 'Printing';

    // Create action menu items
    const actionItems = [];
    actionItems.push(createViewDetailsAction(() => handleViewJobDetails(job)));
    if (isPdfFile(job.filename)) {
      actionItems.push(createPreviewAction(() => handlePreviewPdf(job), true));
    }
    if (job.job_status !== 'completed' && !isCancelled) {
      actionItems.push(createPrintAction(() => handleQuickPrint(job)));
      actionItems.push(createMarkCompletedAction(() => onMarkPrinted(job.id)));
      actionItems.push(createCancelAction(() => handleCancelJob(job)));
    }
    actionItems.push(createOpenFileAction(() => handleOpenForPrinting(job)));
    actionItems.push(createDownloadAction(() => downloadFile(job.file_url, job.filename)));
    actionItems.push(createDeleteAction(() => handleDeleteJob(job)));

    return (
      <div
        key={job.id}
        className={`card p-6 hover:shadow-medium transition-all duration-200 animate-scale-in ${isThisJobPrinting ? 'ring-2 ring-green-500 dark:ring-green-400 shadow-lg shadow-green-500/10' : ''}`}
        style={{ animationDelay: `${index * 50}ms` }}
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${isThisJobPrinting ? 'bg-green-100 dark:bg-green-900/30' : 'bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900 dark:to-indigo-900'}`}>
              {isThisJobPrinting ? <Printer className="h-6 w-6 text-green-600 dark:text-green-400 animate-pulse" /> : <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                  {truncateFilename(job.filename, 40)}
                </h3>
                <DownloadIndicator
                  status={downloadStates.get(job.id)?.status as any || 'idle'}
                  progress={downloadStates.get(job.id)?.progress || 0}
                  onClick={(e) => handleIndicatorClick(e, job)}
                />
              </div>
              <div className="flex flex-wrap items-center gap-4 mt-1 text-sm text-gray-600 dark:text-gray-400">
                <div className="flex items-center font-semibold text-blue-700 dark:text-blue-300">
                  <Hash className="h-3 w-3 mr-1" />
                  {getJobDisplayLabel(job)}
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

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <div className="flex flex-wrap gap-2">
              <span className={`status-indicator ${isThisJobCancelling ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-200' : isThisJobPrinting ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200' : getStatusColor(isCancelled || isFailed ? 'cancelled' : job.job_status)}`}>
                {isThisJobCancelling ? '⏳' : isThisJobPrinting ? phaseEmoji : getStatusIcon(isCancelled || isFailed ? 'cancelled' : job.job_status)}
                {isThisJobCancelling ? 'Cancelling...' : isThisJobPrinting ? phaseStatusText : isCancelled ? 'Cancelled' : isFailed ? 'Payment Failed' : job.job_status.charAt(0).toUpperCase() + job.job_status.slice(1)}
              </span>
              {isThisJobPrinting && !isThisJobCancelling && printingStartTimes.has(job.id) && <ElapsedTimer startTime={printingStartTimes.get(job.id)!} />}
              {job.job_status === 'completed' && !isCancelled && !isThisJobPrinting && (job.completed_at || job.updated_at || printDurations.has(job.id)) && (
                <span className="status-indicator bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 text-xs">
                  {(job.completed_at || job.updated_at) && (
                    <>Printed at: {new Date(job.completed_at || job.updated_at).toLocaleDateString([], { day: 'numeric', month: 'short' })}{' '}
                      {new Date(job.completed_at || job.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </>
                  )}
                  {(job.processing_time_seconds || printDurations.get(job.id)) && (
                    <> · ⏱ {(job.processing_time_seconds || printDurations.get(job.id))?.toFixed(1)}s taken</>
                  )}
                </span>
              )}
              {isCancelled && !isThisJobCancelling && !isThisJobPrinting && (
                <span className="status-indicator bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs">
                  {job.updated_at && (
                    <>{new Date(job.updated_at).toLocaleDateString([], { day: 'numeric', month: 'short' })}{' '}
                      {new Date(job.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </>
                  )}
                </span>
              )}
              <span
                className={`status-indicator ${getPaymentStatusColor(job.payment_status)}`}
                title="Database payment status. UPI (PhonePe, GPay, etc.) does not update this automatically — use job details to record payment when you have received it."
              >
                Payment {job.payment_status.charAt(0).toUpperCase() + job.payment_status.slice(1)}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {isThisJobCancelling ? (
                <button
                  disabled
                  className="btn-danger opacity-90 cursor-default"
                >
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Cancelling...
                </button>
              ) : isThisJobPrinting ? (
                <>
                  <button
                    disabled
                    className="btn-primary opacity-90 cursor-default"
                  >
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    {phaseLabel}
                  </button>
                  <button
                    onClick={() => handleCancelJob(job)}
                    className="btn-danger"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  {(job.job_status === 'pending' || job.job_status === 'printing') && !isCancelled && (
                    <button
                      onClick={() => handleQuickPrint(job)}
                      disabled={printingJobs.has(job.id)}
                      className="btn-primary"
                    >
                      <Printer className="h-4 w-4 mr-2" />
                      Print Now
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

                    {isPdfFile(job.filename) && (
                      <button
                        className="btn-secondary p-2"
                        title="Preview PDF"
                        onClick={() => handlePreviewPdf(job)}
                      >
                        <FileText className="h-4 w-4" />
                      </button>
                    )}

                    <ActionMenu items={actionItems} />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

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

  // Listen for download updates and fetching initial state
  useEffect(() => {
    if (!window.electron?.onDownloadUpdate || !window.electron?.downloadStatus) return;

    // Fetch initial status
    window.electron.downloadStatus().then((data) => {
      console.log('📦 [JOBLIST] Initial download status:', data);
      const newStates = new Map<string, { status: string; progress: number; filePath?: string }>();
      for (const item of data.downloading || []) {
        newStates.set(item.jobId, { status: item.status, progress: item.progress });
      }
      for (const item of data.downloaded || []) {
        newStates.set(item.jobId, { status: 'completed', progress: 100, filePath: item.filePath });
      }
      setDownloadStates(newStates);
    }).catch(err => console.error('Failed to fetch download status:', err));

    // Listen for updates
    const unsubscribe = window.electron.onDownloadUpdate((data) => {
      const newStates = new Map<string, { status: string; progress: number; filePath?: string }>();
      for (const item of data.downloading || []) {
        newStates.set(item.jobId, { status: item.status, progress: item.progress });
      }
      for (const item of data.downloaded || []) {
        newStates.set(item.jobId, { status: 'completed', progress: 100, filePath: item.filePath });
      }
      setDownloadStates(newStates);
    });

    return () => unsubscribe?.();
  }, []);


  // Safety: If any currently printing job becomes 'completed' (and we aren't tracking it as printing locally), clear its timer
  useEffect(() => {
    printingStartTimes.forEach((_, jobId) => {
      const job = jobs.find(j => j.id === jobId);
      // Only clear if the job is marked completed AND it's not currently being tracked as printing locally
      if (job && job.job_status === 'completed' && !printingJobs.has(jobId)) {
        setPrintingStartTimes(prev => {
          const newMap = new Map(prev);
          newMap.delete(jobId);
          return newMap;
        });
      }
    });
  }, [jobs, printingStartTimes, printingJobs]);

  // Check if MuPDF is installed
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
      // CRITICAL: Ignore orders that are still uploading.
      if (job.file_url === '__uploading__') {
        return false;
      }

      // Determine effective status (priority: completed > cancelled > failed payment > original status)
      const isFailed = job.payment_status === 'failed';
      let effectiveStatus = job.job_status;
      
      if (job.job_status === 'completed') {
        effectiveStatus = 'completed';
      } else if (cancelledJobIds.has(job.id) || isFailed || job.job_status === 'cancelled') {
        effectiveStatus = 'cancelled';
      }
      
      if (filters.status !== 'all' && effectiveStatus !== filters.status) {
        return false;
      }

      if (filters.paymentStatus !== 'all' && job.payment_status !== filters.paymentStatus) {
        return false;
      }

      if (filters.searchQuery && !jobMatchesSearch(job, filters.searchQuery)) {
        return false;
      }

      return true;
    })
    .sort((a, b) => {
      // 1. Sort by Status Priority
      // Priority: Printing (0) > Pending (1) > Others (2)
      const getStatusPriority = (status: string) => {
        if (status === 'printing') return 0;
        if (status === 'pending') return 1;
        if (status === 'completed') return 2;
        return 3; // cancelled, failed
      };

      const priorityA = getStatusPriority(a.job_status);
      const priorityB = getStatusPriority(b.job_status);

      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      if (priorityA >= 2) {
        // For completed/cancelled jobs, sort by updated_at (newest first)
        const dateA = new Date(a.updated_at || a.created_at).getTime();
        const dateB = new Date(b.updated_at || b.created_at).getTime();
        return dateB - dateA;
      }

      // 2. Secondary Sort: Date (Newest First) for printing/pending
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
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
        // Always route PDFs through the native pipeline so slip/on-page ID is embedded
        // into a processed PDF file before printer command is sent.
        const result = await window.electron.downloadAndPrintFile(
          filePath,
          job.filename,
          printerName,
          copies,
          paperSize,
          colorMode,
          printType,
          1,
          'portrait',
          buildOrderMarkPayload(job)
        );

        if (!result.success) {
          throw new Error(result.error || 'PDF printing failed');
        }

        console.log('✅ PDF printing completed:', result);

        const pdfToolName = muPDFInstalled ? 'MuPDF' : 'PDFtoPrinter';
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

    // Capture printer name for stats
    const printerToUse = printOptions?.printerName || (availablePrinters.find(p => p.default)?.name) || availablePrinters[0]?.name;

    // NOTIFY PARENT COMPONENT THAT PRINTING STARTED
    if (onPrintStarted && printerToUse) {
      onPrintStarted(job.id, printerToUse, {
        paper_size: selectedPaperSize || job.paper_size,
        color_mode: selectedColorMode || job.color_mode,
        print_type: selectedPrintType || job.print_type,
        copies: selectedCopies || job.copies,
        total_pages: job.total_pages || (job as any).recipe?.source?.totalPages || 1
      });
    }

    setPrintingJobs(prev => new Set(prev).add(job.id));
    setPrintOutput('');
    setShowPrintOutput(true);

    // Clear old completion data when re-printing a job
    setPrintDurations(prev => {
      const newMap = new Map(prev);
      newMap.delete(job.id);
      return newMap;
    });
    // Remove from cancelled if it was previously cancelled
    setCancelledJobIds(prev => {
      if (prev.has(job.id)) {
        const newSet = new Set(prev);
        newSet.delete(job.id);
        return newSet;
      }
      return prev;
    });

    // Track print start for queue UI
    const printStartTime = Date.now();
    setPrintingStartTimes(prev => new Map(prev).set(job.id, printStartTime));

    // Optimistically update local printing state to prevent race conditions
    setPrintingJobs(prev => new Set(prev).add(job.id));

    // Update Supabase to 'printing' status
    try {
      await updatePrintJob(job.id, { job_status: 'printing', updated_at: new Date().toISOString() });
    } catch (e) {
      console.warn('Failed to update job status to printing:', e);
    }

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

      // Check for locally cached file
      const downloadState = downloadStates.get(job.id);
      const localFilePath = downloadState?.status === 'completed' ? downloadState.filePath : undefined;
      const fileToUse = localFilePath || job.file_url;

      if (localFilePath) {
        console.log('📁 Using cached local file for print:', localFilePath);
      }

      if (isPdf) {
        // For PDFs, use the downloadAndPrintFile function which will use silent PDF printing
        const result = await window.electron.downloadAndPrintFile(
          fileToUse,
          job.filename,
          printerName,
          selectedCopies || job.copies,
          selectedPaperSize || job.paper_size,
          selectedColorMode || job.color_mode,
          selectedPrintType || job.print_type,
          selectedNupPages || job.pages_per_sheet || 1,
          selectedNupOrientation || job.nup_orientation || 'portrait',
          buildOrderMarkPayload(job)
        );

        if (!result.success) {
          throw new Error(result.error || 'PDF printing failed');
        }

        console.log('✅ PDF printing completed:', result);

        const pdfToolName = muPDFInstalled ? 'MuPDF' : 'PDFtoPrinter';
        setPrintOutput(prev => prev + `PDF print job sent successfully to ${printerName}!\n\nThe file is being printed silently with ${pdfToolName}.\n`);

        // Show success notification
        const event = new CustomEvent('show-notification', {
          detail: {
            type: 'success',
            message: `Print job sent to ${printerName} on ${selectedPaperSize || job.paper_size} paper.`
          }
        });
        window.dispatchEvent(event);

        // Wait 3 seconds to ensure printer has processed the job (simulating "last page out")
        // User requested: "after spoof complete the last printe page take about 2-3 sec"
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Record duration using local startTime (avoids stale closure on currentlyPrinting)
        const duration = (Date.now() - printStartTime) / 1000; // in seconds
        setPrintDurations(prev => new Map(prev).set(job.id, duration));

        // Mark job as completed with duration IF not cancelled
        if (!cancelledJobIdsRef.current.has(job.id)) {
          onMarkPrinted(job.id, { processingTime: duration });
        }
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

        // Also mark non-PDFs as printed IF not cancelled
        const duration = (Date.now() - printStartTime) / 1000;
        setPrintDurations(prev => new Map(prev).set(job.id, duration));
        if (!cancelledJobIdsRef.current.has(job.id)) {
          onMarkPrinted(job.id, { processingTime: duration });
        }
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
      // Clear print tracking
      setPrintingStartTimes(prev => {
        const newMap = new Map(prev);
        newMap.delete(job.id);
        return newMap;
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

  // NEW: Watch for download completion of the currently previewed job
  // If the file finishes downloading while preview is open, switch to the local file
  useEffect(() => {
    if (!showPdfPreview || !previewJobId) return;

    // Check if it's currently a remote URL (http/https)
    if (showPdfPreview.startsWith('http')) {
      const downloadState = downloadStates.get(previewJobId);

      // If download just finished and we have a path
      if (downloadState?.status === 'completed' && downloadState.filePath) {
        console.log('⚡ [PREVIEW] Download finished while open! Switching to local file:', downloadState.filePath);

        // Use local-pdf:// protocol
        const localUrl = `local-pdf://read?path=${encodeURIComponent(downloadState.filePath)}`;
        setShowPdfPreview(localUrl);

        // Show notification
        const event = new CustomEvent('show-notification', {
          detail: { type: 'success', message: 'Download complete! Opening local file...' }
        });
        window.dispatchEvent(event);
      }
    }
  }, [downloadStates, previewJobId, showPdfPreview]);

  // Handle PDF preview - Optimized for INSTANT response using local cache
  const handlePreviewPdf = async (job: PrintJob) => {
    const clickTime = performance.now();
    console.log(`⚡ [PERF] Button Clicked at ${clickTime.toFixed(2)}ms`);

    // 1. Basic Validation (Sync, Fast)
    if (!job.filename.toLowerCase().endsWith('.pdf')) {
      const event = new CustomEvent('show-notification', {
        detail: {
          type: 'error',
          message: 'This file is not a PDF. Only PDF files can be previewed.'
        }
      });
      window.dispatchEvent(event);
      return;
    }

    // Track the job ID for the preview
    setPreviewJobId(job.id);

    // 2. Determine State (Sync, Fast)
    const hasProcessed = !!(job.has_edits && job.recipe && job.processed_file_url);
    const needsProcessing = !hasProcessed && !!(job.has_edits && job.recipe && window.electron?.processPdfWithRecipe);

    // Check if file is already downloaded locally
    const downloadState = downloadStates.get(job.id);
    const localFilePath = downloadState?.status === 'completed' ? downloadState.filePath : undefined;
    const isDownloading = downloadState?.status === 'downloading';

    // NEW: Trigger download if file needs processing but isn't downloaded yet
    // UPDATE: Now triggering for ALL files if not downloaded (User request: "new way")
    if (!localFilePath && !isDownloading) {
      console.log('📥 [PREVIEW] Triggering download for on-demand preview:', job.filename);
      // Don't await here - let it download in background
      // The runBackgroundRecipe will wait for completion
      window.electron.downloadStart(job.id, job.file_url, job.filename);
    }

    console.log('📋 [PREVIEW] Job state:', {
      jobId: job.id,
      filename: job.filename,
      hasProcessed,
      needsProcessing,
      hasLocalFile: !!localFilePath,
      isDownloading,
      localFilePath: localFilePath || 'N/A',
      processedFilePath: job.processed_file_path || 'N/A'
    });

    // 3. Determine target URL - Priority: Local processed file > Remote URL (wait for processing)
    // Use local-pdf:// protocol for local files (avoids slow base64 encoding)
    let targetUrl: string;

    // First priority: Use local PROCESSED file if available (for jobs with edits)
    if (hasProcessed && job.processed_file_path) {
      // Use query param for robust path handling (avoids colon stripping issues)
      // Format: local-pdf://read?path=C%3A%2F...
      targetUrl = `local-pdf://read?path=${encodeURIComponent(job.processed_file_path)}`;
      console.log('⚡ [PREVIEW] Using LOCAL-PDF protocol for processed file:', targetUrl);
    }
    // Second priority: Use local ORIGINAL file ONLY if NO processing needed
    else if (!needsProcessing && localFilePath) {
      targetUrl = `local-pdf://read?path=${encodeURIComponent(localFilePath)}`;
      console.log('⚡ [PREVIEW] Using LOCAL-PDF protocol for original file (no edits):', targetUrl);
    }
    // Third priority: Use processed data URL if no local processed file
    else if (hasProcessed && job.processed_file_url) {
      console.log('🔄 [PREVIEW] Using processed data URL (no local processed file)');
      targetUrl = job.processed_file_url;
    }
    // For files that need processing: show remote URL, processing will update it
    else if (needsProcessing) {
      console.log('⏳ [PREVIEW] Needs processing - showing remote URL, will update after recipe applied');
      targetUrl = job.file_url || '';
    }
    // Last resort: Download from remote URL
    else {
      console.log('🌐 [PREVIEW] No local file available, will download from URL');
      targetUrl = job.file_url || '';
    }

    // 4. Set states and open modal
    const renderStart = performance.now();
    console.log('⚡ [UI] Opening Preview Modal (Delay: ' + (renderStart - clickTime).toFixed(2) + 'ms)');

    // Set states in batch
    if (hasProcessed) {
      setIsPdfPreviewProcessing(false);
    } else {
      setIsPdfPreviewProcessing(needsProcessing);
      if (needsProcessing) {
        setProcessingJobs(prev => new Set(prev).add(job.id));
      }
    }

    // Open Modal
    setShowPdfPreview(targetUrl);

    // 5. Trigger Background Work (Async, Non-blocking)
    if (needsProcessing) {
      setTimeout(() => runBackgroundRecipe(job, clickTime), 0);
    }
  };

  // Separated background processing logic
  const runBackgroundRecipe = async (job: PrintJob, clickTime: number) => {
    const procStart = performance.now();
    console.log('🔄 [BG] Background processing started at +', (procStart - clickTime).toFixed(2), 'ms');

    try {
      if (!window.electron?.processPdfWithRecipe) throw new Error('Electron API missing');

      // Wait for file to be downloaded (up to 2 minutes)
      const maxWaitTime = 3600000; // 1 hour (effectively no limit)
      const startTime = Date.now();
      let localFilePath: string | undefined;

      while (Date.now() - startTime < maxWaitTime) {
        const downloadState = downloadStates.get(job.id);

        if (downloadState?.status === 'completed' && downloadState.filePath) {
          localFilePath = downloadState.filePath;
          console.log('📁 [BG] File download completed:', localFilePath);
          break;
        }

        if (downloadState?.status === 'error') {
          throw new Error('Download failed');
        }

        // FALLBACK: Check if file is already downloaded (for cached files that don't emit events)
        if (!localFilePath && window.electron.downloadGetPath) {
          try {
            const result = await window.electron.downloadGetPath(job.id);
            if (result.success && result.filePath) {
              localFilePath = result.filePath;
              console.log('📁 [BG] Found cached file via direct query:', localFilePath);
              break;
            }
          } catch (e) {
            // Ignore errors from downloadGetPath
          }
        }

        // Wait 500ms before checking again
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (!localFilePath) {
        throw new Error('Download timeout after 1 hour');
      }

      // Show notification that we're processing
      window.dispatchEvent(new CustomEvent('show-notification', {
        detail: { type: 'info', message: 'Applying edits to preview...' }
      }));

      console.log('🔄 [BG] Processing with local file:', localFilePath);
      const result = await window.electron.processPdfWithRecipe(localFilePath, job.recipe);

      if (result.success && result.processedUrl) {
        console.log('✅ [BG] Processing success:', result.processedUrl);

        // Update job data locally
        job.processed_file_url = result.processedUrl;
        job.processed_file_path = result.processedPath;

        // Clear processing state & Update Preview with local-pdf protocol
        setPreviewJobId(job.id);

        // Use local-pdf:// protocol for processed file (faster than data URL)
        if (job.processed_file_path) {
          const processedUrl = `local-pdf://read?path=${encodeURIComponent(job.processed_file_path)}`;
          console.log('⚡ [UI] Switching to processed file via local-pdf protocol:', processedUrl);
          setShowPdfPreview(processedUrl);
        }
        setIsPdfPreviewProcessing(false); // Clear processing state
        window.dispatchEvent(new CustomEvent('show-notification', {
          detail: { type: 'success', message: 'Edits applied to preview!' }
        }));
      } else {
        console.warn('⚠️ [BG] Processing failed:', result.error);
        setIsPdfPreviewProcessing(false);
      }
    } catch (error) {
      console.error('❌ [BG] Processing error:', error);
      setIsPdfPreviewProcessing(false);
    } finally {
      setProcessingJobs(prev => {
        const newSet = new Set(prev);
        newSet.delete(job.id);
        return newSet;
      });
    }
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
      // Remove from cancelled if it was previously cancelled
      setCancelledJobIds(prev => {
        if (prev.has(job.id)) {
          const newSet = new Set(prev);
          newSet.delete(job.id);
          return newSet;
        }
        return prev;
      });

      // Clear old completion data when re-printing a job
      setPrintDurations(prev => {
        const newMap = new Map(prev);
        newMap.delete(job.id);
        return newMap;
      });

      // Track print start for queue UI
      const startTime = Date.now();
      setPrintingStartTimes(prev => new Map(prev).set(job.id, startTime));
      setPrintingJobs(prev => new Set(prev).add(job.id));

      // Notify parent for stats tracking
      if (onPrintStarted) {
        onPrintStarted(job.id, printOptions.printerName, {
          paper_size: printOptions.paperSize,
          color_mode: printOptions.colorMode,
          print_type: printOptions.printType,
          copies: printOptions.copies
        });
      }

      // Update Supabase to 'printing'
      try {
        await updatePrintJob(job.id, { job_status: 'printing', updated_at: new Date().toISOString() });
      } catch (e) {
        console.warn('Failed to update job status to printing:', e);
      }

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
        // USE PROCESSED FILE PATH IF AVAILABLE (for edits to apply)
        const fileToPrint = job.processed_file_path || job.file_url;
        console.log('🖨️ Printing file:', fileToPrint, job.processed_file_path ? '(Processed with edits)' : '(Original)');

        const result = await window.electron.downloadAndPrintFile(
          fileToPrint,
          job.filename,
          printOptions.printerName,
          printOptions.copies,
          printOptions.paperSize,
          printOptions.colorMode,
          printOptions.printType,
          printOptions.nupPages,
          printOptions.nupOrientation,
          buildOrderMarkPayload(job)
        );

        console.log('🖨️ Print result from Electron:', result);

        if (result.success) {
          console.log('✅ Print job completed successfully:', result.message);

          // Mark job as completed
          const duration = (Date.now() - startTime) / 1000;
          if (!cancelledJobIdsRef.current.has(job.id)) {
            onMarkPrinted(job.id, { processingTime: duration });
          }

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
      } finally {
        // Clear print tracking
        if (printingStartTimes.has(job.id)) {
          setPrintingStartTimes(prev => {
            const newMap = new Map(prev);
            newMap.delete(job.id);
            return newMap;
          });
        }
        setPrintingJobs(prev => {
          const newSet = new Set(prev);
          newSet.delete(job.id);
          return newSet;
        });
      }
    };
  };

  // Single-click "Print Now". Mirrors the preview pipeline (download -> apply
  // recipe -> downloadAndPrintFile) but without opening any popup. Honors the
  // Dashboard's pre-fetch and recipe queues: any phase whose output is already
  // ready is skipped entirely.
  const handleQuickPrint = async (originalJob: PrintJob) => {
    if (!window.electron) {
      alert('Print functionality is only available in the desktop app');
      return;
    }

    // Phase 0a - Resolve printer (configured-for-paper-size -> system default)
    let printerName: string | null = null;
    try {
      const configured = getConfiguredPrinter(originalJob.paper_size);
      if (configured) {
        printerName = configured;
      } else {
        const printersResult = await window.electron.getPrinters();
        if (printersResult.success && printersResult.printers?.length) {
          const def = printersResult.printers.find(p => p.default) || printersResult.printers[0];
          printerName = def?.name || null;
        }
      }
    } catch (e) {
      console.error('Failed to resolve printer for quick print:', e);
    }

    if (!printerName) {
      window.dispatchEvent(new CustomEvent('show-notification', {
        detail: { type: 'error', message: 'No printer available. Configure one in Printer settings.' }
      }));
      return;
    }

    // Phase 0b - Build print options, preferring the recipe.
    const recipe = originalJob.recipe;
    const recipePrint = recipe?.print;
    const paperSize = recipePrint?.paperSize || originalJob.paper_size;
    const copies = recipePrint?.copies || originalJob.copies;
    const colorMode = recipePrint?.colorMode
      ? (recipePrint.colorMode === 'color' ? 'Color' : 'BW')
      : originalJob.color_mode;
    const printType = recipePrint?.duplex !== undefined
      ? (recipePrint.duplex ? 'Double' : 'Single')
      : originalJob.print_type;
    const nupPages = recipePrint?.pagesPerSheet || originalJob.pages_per_sheet || 1;
    const nupOrientation = originalJob.nup_orientation || 'portrait';

    // Phase 0c - Snapshot what's already been done by background queues.
    const hasProcessed = !!originalJob.processed_file_path;
    const initialDlState = downloadStates.get(originalJob.id);
    let localFilePath: string | undefined =
      initialDlState?.status === 'completed' ? initialDlState.filePath : undefined;

    // Cached-file fallback (file may be on disk but no `download-update` was
    // delivered to this renderer). Same trick runBackgroundRecipe uses.
    if (!localFilePath && !hasProcessed && window.electron.downloadGetPath) {
      try {
        const r = await window.electron.downloadGetPath(originalJob.id);
        if (r.success && r.filePath) localFilePath = r.filePath;
      } catch {
        // ignore
      }
    }

    const needsRecipe = !!(originalJob.has_edits && originalJob.recipe && !hasProcessed);
    const needsDownload = !hasProcessed && !localFilePath;

    // Common setup: clear cancelled, mark printing-started, update Supabase, etc.
    setCancelledJobIds(prev => {
      if (prev.has(originalJob.id)) {
        const newSet = new Set(prev);
        newSet.delete(originalJob.id);
        return newSet;
      }
      return prev;
    });
    setPrintDurations(prev => {
      const newMap = new Map(prev);
      newMap.delete(originalJob.id);
      return newMap;
    });

    const printStartTime = Date.now();
    setPrintingStartTimes(prev => new Map(prev).set(originalJob.id, printStartTime));
    setPrintingJobs(prev => new Set(prev).add(originalJob.id));

    if (onPrintStarted) {
      onPrintStarted(originalJob.id, printerName, {
        paper_size: paperSize,
        color_mode: colorMode,
        print_type: printType,
        copies,
        total_pages: originalJob.total_pages || originalJob.recipe?.source?.totalPages || 1
      });
    }

    try {
      await updatePrintJob(originalJob.id, { job_status: 'printing', updated_at: new Date().toISOString() });
    } catch (e) {
      console.warn('Failed to update job status to printing:', e);
    }

    const isCancelled = () => cancelledJobIdsRef.current.has(originalJob.id);

    try {
      // Phase 1 - Download (skipped if already cached)
      if (needsDownload) {
        setPhase(originalJob.id, 'downloading');

        // Don't double-trigger if Dashboard's auto-queue already started one.
        const inFlight = downloadStates.get(originalJob.id)?.status === 'downloading';
        if (!inFlight && window.electron.downloadStart) {
          try {
            window.electron.downloadStart(originalJob.id, originalJob.file_url, originalJob.filename);
          } catch (e) {
            console.warn('downloadStart threw (will still poll):', e);
          }
        }

        // Poll for completion (mirrors runBackgroundRecipe's loop, lines 1150-1183).
        const startWait = Date.now();
        const maxWait = 3600000; // 1 hour - effectively no limit
        while (Date.now() - startWait < maxWait) {
          if (isCancelled()) throw new Error('cancelled');

          const state = downloadStates.get(originalJob.id);
          if (state?.status === 'completed' && state.filePath) {
            localFilePath = state.filePath;
            break;
          }
          if (state?.status === 'error') {
            throw new Error('Download failed');
          }

          if (window.electron.downloadGetPath) {
            try {
              const r = await window.electron.downloadGetPath(originalJob.id);
              if (r.success && r.filePath) {
                localFilePath = r.filePath;
                break;
              }
            } catch {
              // ignore
            }
          }

          await new Promise(resolve => setTimeout(resolve, 500));
        }

        if (!localFilePath) throw new Error('Download timeout');
      }

      if (isCancelled()) throw new Error('cancelled');

      // Phase 2 - Apply recipe (skipped if already processed or no edits)
      let phase2ProcessedPath: string | undefined;
      if (needsRecipe && localFilePath && window.electron.processPdfWithRecipe) {
        setPhase(originalJob.id, 'applying_edits');
        try {
          const result = await window.electron.processPdfWithRecipe(localFilePath, originalJob.recipe);
          if (result.success && result.processedPath) {
            phase2ProcessedPath = result.processedPath;
            originalJob.processed_file_path = result.processedPath;
            if (result.processedUrl) originalJob.processed_file_url = result.processedUrl;
          } else {
            console.warn('Recipe processing failed, printing original:', result.error);
            window.dispatchEvent(new CustomEvent('show-notification', {
              detail: { type: 'info', message: 'Could not apply edits, printing original file.' }
            }));
          }
        } catch (e) {
          console.warn('processPdfWithRecipe threw, printing original:', e);
        }
      }

      if (isCancelled()) throw new Error('cancelled');

      // Phase 3 - Print
      setPhase(originalJob.id, 'printing');

      const fileToPrint =
        phase2ProcessedPath ||
        originalJob.processed_file_path ||
        localFilePath ||
        originalJob.file_url;

      const isPdf = originalJob.filename.toLowerCase().endsWith('.pdf');
      console.log('Quick Print: sending', {
        file: fileToPrint, printer: printerName, copies, paperSize, colorMode, printType, nupPages, nupOrientation
      });

      const result = await window.electron.downloadAndPrintFile(
        fileToPrint,
        originalJob.filename,
        printerName,
        copies,
        paperSize,
        colorMode,
        printType,
        nupPages,
        nupOrientation,
        buildOrderMarkPayload(originalJob)
      );

      if (!result.success) throw new Error(result.error || 'Print failed');

      if (isPdf) {
        // Match the existing PDF flow's "last page out" wait (line 908).
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      const duration = (Date.now() - printStartTime) / 1000;
      setPrintDurations(prev => new Map(prev).set(originalJob.id, duration));

      if (!isCancelled()) {
        onMarkPrinted(originalJob.id, { processingTime: duration });
        window.dispatchEvent(new CustomEvent('show-notification', {
          detail: { type: 'success', message: `Print job sent to ${printerName}` }
        }));
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      if (msg !== 'cancelled') {
        console.error('Quick print failed:', error);
        window.dispatchEvent(new CustomEvent('show-notification', {
          detail: { type: 'error', message: `Print failed: ${msg}` }
        }));
      }
    } finally {
      setPhase(originalJob.id, null);
      setPrintingJobs(prev => {
        const newSet = new Set(prev);
        newSet.delete(originalJob.id);
        return newSet;
      });
      setPrintingStartTimes(prev => {
        const newMap = new Map(prev);
        newMap.delete(originalJob.id);
        return newMap;
      });
    }
  };

  // Show job details
  const handleViewJobDetails = (job: PrintJob) => {
    setSelectedJob(job);
    setShowJobDetails(true);
  };

  const handleRecordPaymentReceived = async (job: PrintJob) => {
    if (job.payment_status === 'paid') return;
    setRecordingPaymentJobId(job.id);
    try {
      const { error } = await updatePrintJob(job.id, { payment_status: 'paid' });
      if (error) throw new Error(error.message);
      onJobUpdated?.(job.id, { payment_status: 'paid' });
      setSelectedJob((prev) => (prev && prev.id === job.id ? { ...prev, payment_status: 'paid' } : prev));
      window.dispatchEvent(
        new CustomEvent('show-notification', {
          detail: { type: 'success', message: 'Payment recorded as paid in PrintGet.' }
        })
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      window.dispatchEvent(
        new CustomEvent('show-notification', {
          detail: { type: 'error', message: `Could not update payment: ${msg}` }
        })
      );
    } finally {
      setRecordingPaymentJobId(null);
    }
  };

  // Handle delete job
  const handleDeleteJob = (job: PrintJob) => {
    setSelectedJob(job);
    setShowDeleteConfirmation(true);
  };

  // Confirm delete job
  // Behavior split by job status:
  //  - Incomplete (pending / printing / cancelled / failed): mark job_status='cancelled' on Supabase
  //    so the customer's web app sees it as cancelled, then hide locally.
  //  - Completed: hide locally only. The server row is left untouched.
  const confirmDeleteJob = async () => {
    if (!selectedJob) return;

    setIsDeleting(true);

    const isCompleted = selectedJob.job_status === 'completed';

    try {
      if (!isCompleted) {
        const { error } = await updatePrintJob(selectedJob.id, {
          job_status: 'cancelled',
          updated_at: new Date().toISOString()
        });

        if (error) {
          throw new Error(error.message);
        }
      }

      setDeletedJobIds(prev => new Set(prev).add(selectedJob.id));

      const event = new CustomEvent('show-notification', {
        detail: {
          type: 'success',
          message: isCompleted
            ? `Job "${truncateFilename(selectedJob.filename, 20)}" removed from dashboard`
            : `Job "${truncateFilename(selectedJob.filename, 20)}" cancelled and removed`
        }
      });
      window.dispatchEvent(event);

      setShowDeleteConfirmation(false);

    } catch (error) {
      console.error('Error deleting job:', error);

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
    // Immediately show cancelling state in UI
    setCancellingJobs(prev => new Set(prev).add(selectedJob.id));

    try {
      const { error } = await updatePrintJob(selectedJob.id, {
        job_status: 'cancelled',
        updated_at: new Date().toISOString()
      });

      if (error) {
        throw new Error(error.message);
      }

      // Clear printing state if this job was printing
      if (printingStartTimes.has(selectedJob.id)) {
        setPrintingStartTimes(prev => {
          const newMap = new Map(prev);
          newMap.delete(selectedJob.id);
          return newMap;
        });
      }
      setPrintingJobs(prev => {
        const newSet = new Set(prev);
        newSet.delete(selectedJob.id);
        return newSet;
      });
      setPhase(selectedJob.id, null);

      // Add to cancelled jobs set for UI update
      setCancelledJobIds(prev => new Set(prev).add(selectedJob.id));

      // Update the job in the local state
      const updatedJob = {
        ...selectedJob,
        job_status: 'cancelled' as const,
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
      if (selectedJob) {
        setCancellingJobs(prev => {
          const newSet = new Set(prev);
          newSet.delete(selectedJob.id);
          return newSet;
        });
      }
    }
  };

  const handleIndicatorClick = (e: React.MouseEvent, job: PrintJob) => {
    e.stopPropagation();
    const state = downloadStates.get(job.id);
    const status = state?.status || 'idle';

    if (status === 'downloading') {
      window.electron?.downloadPause?.(job.id);
    } else if (status === 'paused') {
      window.electron?.downloadResume?.(job.id);
    } else if (status === 'completed') {
      setShowDownloadManager(true);
    } else {
      // Idle or error -> Start download
      console.log('Starting download for:', job.filename);
      window.electron?.downloadStart?.(job.id, job.file_url, job.filename);
    }
  };

  // Calculate queue positions for pending jobs (FIFO by created_at)
  const queuePositions = useMemo(() => {
    const positions = new Map<string, number>();
    const pendingJobs = jobs
      .filter(j => j.job_status === 'pending' && !cancelledJobIds.has(j.id) && !deletedJobIds.has(j.id))
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    pendingJobs.forEach((job, idx) => {
      positions.set(job.id, idx + 1);
    });
    return positions;
  }, [jobs, cancelledJobIds, deletedJobIds]);

  // Computed queue layout: printing jobs (multiple allowed) + ready-to-print + up-next
  const { topJobs, isPrintingNow, queueUpNext, queueJobIds } = useMemo(() => {
    // Apply search filter to queue as well for consistent UI
    const searchFilteredJobs = jobs.filter(job => {
      if (!filters.searchQuery) return true;
      return jobMatchesSearch(job, filters.searchQuery);
    });

    // Find ALL currently printing jobs
    const printing = searchFilteredJobs.filter(j =>
      !deletedJobIds.has(j.id) &&
      !cancellingJobs.has(j.id) && (
        j.job_status === 'printing' ||
        printingJobs.has(j.id) ||
        printingStartTimes.has(j.id)
      )
    );
    const printingIds = new Set(printing.map(j => j.id));

    const pending = searchFilteredJobs
      .filter(j =>
        j.job_status === 'pending' &&
        j.payment_status !== 'failed' &&
        !cancelledJobIds.has(j.id) &&
        !deletedJobIds.has(j.id) &&
        !cancellingJobs.has(j.id) &&
        !printingIds.has(j.id)
      )
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    // Top jobs: all printing jobs. If none printing, show first pending as "Ready to Print"
    const top = printing.length > 0 ? [...printing] : (pending.length > 0 ? [pending[0]] : []);
    const topIds = new Set(top.map(j => j.id));
    const upNext = pending.filter(j => !topIds.has(j.id));

    const ids = new Set<string>();
    top.forEach(j => ids.add(j.id));
    upNext.forEach(j => ids.add(j.id));

    return { topJobs: top, isPrintingNow: printing.length > 0, queueUpNext: upNext, queueJobIds: ids };
  }, [jobs, printingStartTimes, cancelledJobIds, deletedJobIds, printingJobs, cancellingJobs, filters.searchQuery]);

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
            <p className="text-sm text-gray-600 dark:text-gray-400">{jobs.length} jobs</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowDownloadManager(true)}
            className="btn-secondary flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Downloads
          </button>

          {/* Margin Toggle */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300 hidden sm:inline">Margin</span>
            <div className="relative flex items-center bg-gray-100 dark:bg-gray-800 rounded-full p-0.5 border border-gray-200 dark:border-gray-600" style={{ minWidth: '116px' }}>
              {/* Sliding pill indicator */}
              <div
                className="absolute top-0.5 bottom-0.5 rounded-full transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
                style={{
                  width: 'calc(50% - 2px)',
                  left: marginSetting === 'low' ? '2px' : 'calc(50% + 0px)',
                  background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
                  boxShadow: '0 1px 3px rgba(59, 130, 246, 0.4), 0 1px 2px rgba(59, 130, 246, 0.2)',
                }}
              />
              {(['low', 'normal'] as const).map((option) => (
                <button
                  key={option}
                  onClick={() => setMarginSetting(option)}
                  className="relative z-10 flex-1 py-1 text-[11px] font-semibold text-center rounded-full transition-colors duration-300"
                  style={{
                    color: marginSetting === option ? '#ffffff' : undefined,
                  }}
                >
                  <span className={marginSetting !== option ? 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200' : ''}>
                    {option === 'low' ? 'Low' : 'Normal'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>



      {/* PDF Preview Modal */}
      {showPdfPreview && (
        <Modal isOpen={!!showPdfPreview} onClose={() => { setShowPdfPreview(null); setIsPdfPreviewProcessing(false); }} title="" maxWidth="max-w-4xl" showCloseButton={false}>
          <PdfPreview
            isProcessing={isPdfPreviewProcessing}
            isDownloading={previewJobId ? downloadStates.get(previewJobId)?.status === 'downloading' : false}
            downloadProgress={previewJobId ? downloadStates.get(previewJobId)?.progress || 0 : 0}
            fileUrl={showPdfPreview}
            jobData={(() => {
              const job = jobs.find(j => j.id === previewJobId);
              return job ? {
                paper_size: job.paper_size,
                copies: job.copies,
                color_mode: job.color_mode as 'BW' | 'Color',
                print_type: job.print_type as 'Single' | 'Double',
                pages_per_sheet: job.pages_per_sheet || 1,
                nup_orientation: job.nup_orientation || 'portrait',
                margin: marginSetting
              } : undefined;
            })()}
            onPrint={(() => {
              const job = jobs.find(j => j.id === previewJobId);
              if (!job) console.warn('⚠️ Job not found for preview ID:', previewJobId);
              return job ? handlePrintFromPreview(job) : async () => { console.error('❌ No job found for print handler'); };
            })()}
            onClose={() => { setShowPdfPreview(null); setPreviewJobId(null); setIsPdfPreviewProcessing(false); }}
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
              PDF files are printed silently using {muPDFInstalled ? 'MuPDF' : 'PDFtoPrinter'} without opening any windows.
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
                <h4 className="font-semibold text-gray-900 dark:text-white">Pickup Order ID</h4>
                <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                  <div className="flex items-center mb-2">
                    <Hash className="h-4 w-4 text-blue-600 mr-2" />
                    <span className="font-mono font-bold text-lg">{formatPickupOrderLabel(selectedJob)}</span>
                  </div>
                  {selectedJob.customer_name && selectedJob.customer_name !== 'Customer' && (
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 ml-6 mb-1">
                      <User className="h-3.5 w-3.5 mr-1.5" />
                      {selectedJob.customer_name}
                    </div>
                  )}
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
                  <div className="flex justify-between items-start gap-2">
                    <span className="text-gray-600 dark:text-gray-400 shrink-0">Payment:</span>
                    <div className="text-right space-y-2 min-w-0">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${getPaymentStatusColor(selectedJob.payment_status)}`}>
                        {selectedJob.payment_status.charAt(0).toUpperCase() + selectedJob.payment_status.slice(1)}
                      </span>
                      {selectedJob.payment_status !== 'paid' && (
                        <>
                          <p className="text-xs text-gray-500 dark:text-gray-400 text-left max-w-xs">
                            PhonePe and other UPI apps pay your shop directly. PrintGet is not notified by those apps, so this can stay pending until you confirm here or your customer web flow updates the order in the database.
                          </p>
                          <button
                            type="button"
                            disabled={recordingPaymentJobId === selectedJob.id}
                            onClick={() => handleRecordPaymentReceived(selectedJob)}
                            className="btn-success text-sm py-1.5 px-3 inline-flex items-center gap-1.5"
                          >
                            <Banknote className="h-4 w-4 shrink-0" />
                            {recordingPaymentJobId === selectedJob.id ? 'Saving…' : 'Record payment received'}
                          </button>
                        </>
                      )}
                    </div>
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
                    handleQuickPrint(selectedJob);
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
        message={
          selectedJob?.job_status === 'completed'
            ? `Remove "${selectedJob?.filename}" from your dashboard? The job remains on the server (this only hides it locally).`
            : `Delete "${selectedJob?.filename}"? This will cancel the job on the server and remove it from your dashboard.`
        }
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
                    <div className={`mt-1 text-xs p-2 rounded ${printResults[printer.name].success
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

      {/* Print Queue Section - Always shows top job(s) */}
      {(() => {
        if (topJobs.length === 0 && queueUpNext.length === 0) return null;

        const visibleUpNext = showFullQueue ? queueUpNext : queueUpNext.slice(0, 2);
        const hiddenCount = queueUpNext.length - 2;

        return (
          <div className="mb-8">
            {/* Queue Header */}
            <div className="flex items-center justify-between mb-4 px-1">
              <div className="flex items-center gap-2">
                <Printer className="h-5 w-5 text-gray-400" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Print Queue</h3>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                  {topJobs.length + queueUpNext.length}
                </span>
              </div>
              {isPrintingNow ? (
                <span className="flex items-center gap-1.5 text-sm font-medium text-green-600 dark:text-green-400">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  Printing Now
                </span>
              ) : topJobs.length > 0 ? (
                <span className="flex items-center gap-1.5 text-sm font-medium text-blue-600 dark:text-blue-400">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  Ready to Print
                </span>
              ) : null}
            </div>

            <div className="space-y-4">
              {/* Top Jobs: Currently Printing or Ready to Print */}
              {topJobs.map((job, idx) => renderJobCard(job, idx, true))}

              {/* Up Next */}
              {visibleUpNext.length > 0 && (
                <>
                  <div className="pt-2 pb-1 px-1">
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Up Next</span>
                  </div>
                  {visibleUpNext.map((job, idx) => renderJobCard(job, idx + topJobs.length, true))}
                </>
              )}

              {/* Expand/Collapse */}
              {!showFullQueue && hiddenCount > 0 && (
                <button
                  onClick={() => setShowFullQueue(true)}
                  className="w-full py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-center"
                >
                  ▼ Show {hiddenCount} More in Queue
                </button>
              )}
              {showFullQueue && queueUpNext.length > 2 && (
                <button
                  onClick={() => setShowFullQueue(false)}
                  className="w-full py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-center"
                >
                  ▲ Show Less
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* Completed & Cancelled Section */}
      <div className="space-y-4">
        {(() => {
          const mainListJobs = filteredJobs.filter(job => !queueJobIds.has(job.id));

          return (
            <div className="animate-fade-in">
              {/* Filter tabs + Search bar */}
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setFilters(prev => ({ ...prev, status: prev.status === 'completed' ? 'all' : 'completed' }))}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${filters.status === 'completed'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                  >
                    <CheckCircle className="h-3.5 w-3.5 inline mr-1" />
                    Completed
                  </button>
                  <button
                    onClick={() => setFilters(prev => ({ ...prev, status: prev.status === 'cancelled' ? 'all' : 'cancelled' }))}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${filters.status === 'cancelled'
                      ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                  >
                    <AlertTriangle className="h-3.5 w-3.5 inline mr-1" />
                    Cancelled / Failed
                  </button>
                  <span className="text-xs font-medium text-gray-400 dark:text-gray-500 ml-1">
                    {mainListJobs.length}
                  </span>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    name="searchQuery"
                    value={filters.searchQuery}
                    onChange={handleFilterChange}
                    placeholder="Search jobs..."
                    className="input pl-10 w-48"
                  />
                </div>
              </div>

              {mainListJobs.length > 0 ? (
                <div className="space-y-4">
                  {mainListJobs.map((job, index) => renderJobCard(job, index))}
                </div>
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
                      : filters.searchQuery || filters.status !== 'all'
                        ? 'Try adjusting your filters to see more results.'
                        : 'All matching jobs are in the queue above.'}
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
          );
        })()}
      </div>

      {/* Download Manager Popup */}
      <DownloadManager
        isOpen={showDownloadManager}
        onClose={() => setShowDownloadManager(false)}
        jobs={jobs}
      />
    </div >
  );
};

export default JobList;