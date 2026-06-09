import React, { useState, useEffect, useRef } from 'react';
import JobList from '../components/JobList';
import StatsCards from '../components/StatsCards';
// import AveragePrintTimeStats from '../components/AveragePrintTimeStats'; // Removed from main view, used in Sidebar only
import { PrintJob } from '../types';
import { supabase, getPrintJobs, subscribeToNewJobs, updatePrintJob, requestNotificationPermission, testConnection } from '../utils/supabase';
import { NOTIFICATION_ICON_URL } from '../utils/assetUrl';
import { Activity, FileText, RefreshCw, Wifi, WifiOff } from 'lucide-react';

const Dashboard: React.FC = () => {
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');
  const [lastJobCount, setLastJobCount] = useState(0);
  const [downloadingFiles, setDownloadingFiles] = useState<Set<string>>(new Set());
  const [downloadedFilePaths, setDownloadedFilePaths] = useState<Map<string, string>>(new Map());
  const [queueTrigger, setQueueTrigger] = useState(0); // Trigger for sequential queue

  // Refs for cleanup
  const subscriptionRef = useRef<any>(null);
  const pollingIntervalRef = useRef<any>(null);
  const mountedRef = useRef(true);
  const processingQueueRef = useRef<boolean>(false);
  const jobPrinterMapRef = useRef<Map<string, { printerName: string, settings: any }>>(new Map());

  // Auto-print disabled flag - DEFAULT TO TRUE (disabled)
  const [autoProcessingDisabled, setAutoProcessingDisabled] = useState(true);

  useEffect(() => {
    mountedRef.current = true;

    // Priority 1: Load jobs immediately (user sees content first)
    loadJobs();

    // Priority 2: Notification permission (non-blocking)
    requestNotificationPermission();

    // Stagger remaining startup tasks to reduce main thread contention
    // and prevent UI lag on app open

    // +200ms: Test database connection
    const dbTimer = setTimeout(() => {
      if (mountedRef.current) testDatabaseConnection();
    }, 200);

    // +400ms: Setup real-time subscriptions
    const rtTimer = setTimeout(() => {
      if (mountedRef.current) setupRealTimeAndPolling();
    }, 400);

    // +600ms: Clean up old print files
    const cleanupTimer = setTimeout(() => {
      if (mountedRef.current) cleanupOldFiles();
    }, 600);

    // +800ms: Fetch initial download status
    const downloadTimer = setTimeout(() => {
      if (!mountedRef.current) return;
      if (window.electron?.downloadStatus) {
        window.electron.downloadStatus().then((data) => {
          console.log('📦 [DASHBOARD] Initial download status:', data);
          const newPaths = new Map<string, string>();
          for (const item of data.downloaded || []) {
            if (item.filePath) {
              newPaths.set(item.jobId, item.filePath);
            }
          }
          setDownloadedFilePaths(newPaths);
        });
      }
    }, 800);

    // Listen for download updates to track cached file paths
    let unsubscribeDownload: (() => void) | undefined;
    if (window.electron?.onDownloadUpdate) {
      unsubscribeDownload = window.electron.onDownloadUpdate((data) => {
        const newPaths = new Map<string, string>();
        for (const item of data.downloaded || []) {
          if (item.filePath) {
            newPaths.set(item.jobId, item.filePath);
          }
        }
        setDownloadedFilePaths(newPaths);
      });
    }

    // Cleanup on unmount
    return () => {
      mountedRef.current = false;

      // Clear staggered startup timers
      clearTimeout(dbTimer);
      clearTimeout(rtTimer);
      clearTimeout(cleanupTimer);
      clearTimeout(downloadTimer);

      cleanupSubscriptions();
      unsubscribeDownload?.();
    };
  }, []);

  const testDatabaseConnection = async () => {
    try {
      const result = await testConnection();
      if (result.success) {
        setConnectionStatus('connected');
        console.log('✅ Database connection successful');
      } else {
        setConnectionStatus('disconnected');
        console.error('❌ Database connection failed:', result.error);
      }
    } catch (error) {
      setConnectionStatus('disconnected');
      console.error('❌ Database connection error:', error);
    }
  };

  // Background processing helper
  const processJobInBackground = async (job: PrintJob) => {
    // 1. Preload PDF in browser cache (PDF.js)
    if (job.file_url) {
      import('../utils/pdfUtils').then(({ preloadPdf }) => {
        preloadPdf(job.file_url);
      });
    }

    // 2. Pre-process recipe in Electron (for instant edits)
    if (window.electron?.processPdfWithRecipe && job.has_edits && job.recipe && !job.processed_file_url) {
      try {
        // CRITICAL: Check if file is downloaded first - recipe processor ONLY accepts local files
        const localFilePath = downloadedFilePaths.get(job.id);

        if (!localFilePath) {
          console.log('⏭️ [BACKGROUND] Skipping recipe processing - file not downloaded yet:', job.filename);
          return; // Don't process, don't download - just skip
        }

        console.log('🔄 [BACKGROUND] Starting recipe processing for:', job.filename);
        console.log('🧾 [BACKGROUND] Job Recipe:', JSON.stringify(job.recipe, null, 2));
        console.log('📁 [BACKGROUND] Using cached local file:', localFilePath);

        const startTime = performance.now();
        const result = await window.electron.processPdfWithRecipe(localFilePath, job.recipe);
        const duration = performance.now() - startTime;

        if (result.success && result.processedUrl) {
          console.log('✅ [BACKGROUND] Recipe processing completed for:', job.filename);
          console.log('⏱️ [BACKGROUND] Processing took:', duration.toFixed(2), 'ms');

          // Update state to reflect the processed file is ready
          setJobs(prevJobs =>
            prevJobs.map(j =>
              j.id === job.id
                ? {
                  ...j,
                  processed_file_url: result.processedUrl,
                  processed_file_path: result.processedPath
                }
                : j
            )
          );
        } else {
          console.warn('⚠️ [BACKGROUND] Recipe processing failed for:', job.filename, result.error);
        }
      } catch (error) {
        console.error('❌ [BACKGROUND] Recipe processing error for:', job.filename, error);
      }
    }
  };

  // Auto-download and notify but don't auto-print
  const processNewJob = async (job: PrintJob) => {
    if (!window.electron) {
      console.warn('Electron not available, skipping job processing');
      return;
    }

    if (downloadingFiles.has(job.id)) {
      console.log('File already being processed for job:', job.id);
      return;
    }

    setDownloadingFiles(prev => new Set(prev).add(job.id));

    try {
      console.log('🔄 New job received:', job.filename);

      // NOTE: We DO NOT auto-download here anymore.
      // Downloading is strictly handled by the "Top 3" useEffect to prevent
      // flooding the disk with low-priority jobs.

      // Show notification for new job
      showNotification(job);

      // Show in-app notification
      const event = new CustomEvent('show-notification', {
        detail: {
          type: 'info',
          message: `New job received: ${job.filename}`
        }
      });
      window.dispatchEvent(event);

    } catch (error) {
      console.error('❌ Job processing error:', error);
    } finally {
      setDownloadingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(job.id);
        return newSet;
      });
    }
  };

  // Clean up old print files
  const cleanupOldFiles = async () => {
    if (!window.electron) return;

    try {
      const result = await window.electron.cleanupPrintFiles();
      if (result.success && result.cleanedCount && result.cleanedCount > 0) {
        console.log(`🧹 Cleaned up ${result.cleanedCount} old print files`);
      }
    } catch (error) {
      console.error('❌ Cleanup error:', error);
    }
  };

  const setupRealTimeAndPolling = () => {
    const shopId = localStorage.getItem('shop-id');

    if (!shopId) {
      console.warn('No shop ID found, cannot set up real-time subscription');
      setIsLoading(false);
      return;
    }

    console.log('🔔 Setting up real-time subscription AND polling for shop:', shopId);

    // 1. Set up real-time subscription
    try {
      // Use any to bypass type mismatch between Supabase and App types
      subscriptionRef.current = subscribeToNewJobs(shopId, (newJobData: any) => {
        if (!mountedRef.current) return;

        // Map to App type
        const newJob: PrintJob = {
          ...newJobData,
          pages_per_sheet: newJobData.nup_pages || newJobData.pages_per_sheet || 1,
          nup_orientation: newJobData.nup_orientation || 'portrait'
        };

        console.log('🔔 NEW ORDER RECEIVED via real-time:', newJob);

        setJobs(prevJobs => {
          // Check if job already exists to avoid duplicates
          const exists = prevJobs.some(job => job.id === newJob.id);
          if (exists) {
            console.log('Job already exists, updating existing job');
            return prevJobs.map(job => job.id === newJob.id ? newJob : job);
          }

          console.log('Adding new job to list via real-time');

          // Process new job but don't auto-print
          processNewJob(newJob);

          return [newJob, ...prevJobs];
        });

        setConnectionStatus('connected');
      });
    } catch (error) {
      console.error('❌ Failed to set up real-time subscription:', error);
      setConnectionStatus('disconnected');
    }

    // 2. Set up polling as fallback (every 10 seconds)
    pollingIntervalRef.current = setInterval(async () => {
      if (!mountedRef.current) return;

      try {
        console.log('🔄 Polling for new jobs...');
        const { data: latestJobs, error } = await getPrintJobs(shopId);

        if (error) {
          console.error('❌ Polling error:', error);
          setConnectionStatus('disconnected');
          return;
        }

        if (latestJobs && latestJobs.length > lastJobCount) {
          console.log('📊 Found new jobs via polling:', latestJobs.length - lastJobCount);

          // Find new jobs that weren't in the previous list
          setJobs(prevJobs => {
            const newJobs = latestJobs.filter(latestJob =>
              !prevJobs.some(prevJob => prevJob.id === latestJob.id)
            );

            if (newJobs.length > 0) {
              console.log('🆕 Adding new jobs found via polling:', newJobs.length);

              // Process new jobs but don't auto-print
              newJobs.forEach(job => {
                processNewJob(job);
              });

              return latestJobs; // Use the complete latest list
            }

            return prevJobs;
          });

          setLastJobCount(latestJobs.length);
          setConnectionStatus('connected');
        }
      } catch (error) {
        console.error('❌ Polling failed:', error);
        setConnectionStatus('disconnected');
      }
    }, 10000); // Poll every 10 seconds
  };

  const showNotification = (job: PrintJob) => {
    // Show desktop notification
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('New Print Order!', {
        body: `${job.shop_order_number ? `ID - ${job.shop_order_number}` : 'New order'} · ${job.copies} copies of ${job.filename}`,
        icon: NOTIFICATION_ICON_URL,
        tag: job.id
      });
    }

    // Play notification sound (optional)
    try {
      const audio = new Audio('/notification.mp3');
      audio.play().catch(e => console.log('Could not play notification sound:', e));
    } catch (e) {
      console.log('Notification sound not available');
    }
  };

  const cleanupSubscriptions = () => {
    console.log('🧹 Cleaning up subscriptions and polling');

    if (subscriptionRef.current && typeof subscriptionRef.current.unsubscribe === 'function') {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }

    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  // 🚀 OPTIMIZATION: Reactive Sequential Background Queue (FCFS)
  // Ensures we process only ONE job at a time, strictly ordered by time, and ONLY when downloaded
  useEffect(() => {
    // 1. Check if queue is already running
    if (processingQueueRef.current) return;

    // 2. Identify candidates: Has edits, Has recipe, Not processed, AND Downloaded
    // Sort by created_at ascending (Oldest first)
    const candidates = jobs
      .filter(job =>
        job.has_edits &&
        job.recipe &&
        !job.processed_file_url &&
        downloadedFilePaths.has(job.id)
      )
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    if (candidates.length === 0) return;

    const nextJob = candidates[0];

    const processNext = async () => {
      processingQueueRef.current = true;
      try {
        console.log(`🔄 [QUEUE] Starting sequential processing for: ${nextJob.filename}`);
        await processJobInBackground(nextJob);
        // Small delay to prevent CPU hogging
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (err) {
        console.error('Queue processing error:', err);
      } finally {
        processingQueueRef.current = false;
        // Trigger next iteration
        setQueueTrigger(prev => prev + 1);
      }
    };

    processNext();
  }, [jobs, downloadedFilePaths, queueTrigger]);

  // 📥 AUTO-DOWNLOAD: Reactive Top 3 Priority queue
  // Prioritizes "Printing" jobs, then "Pending" jobs by creation date (FIFO)
  useEffect(() => {
    if (!window.electron?.downloadStart || jobs.length === 0) return;

    // Filter relevant jobs
    const candidates = jobs.filter(j =>
      j.job_status === 'printing' || j.job_status === 'pending'
    );

    // Sort: Printing first, then by Date (Oldest first for FIFO)
    candidates.sort((a, b) => {
      // 1. Printing comes first
      if (a.job_status === 'printing' && b.job_status !== 'printing') return -1;
      if (b.job_status === 'printing' && a.job_status !== 'printing') return 1;

      // 2. Created Date (Oldest first)
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    // Take top 3
    const topPriorityJobs = candidates.slice(0, 3);

    // 3. SEQUENTIAL DOWNLOAD: Trigger only ONE download at a time
    // Find the first job in our Top 3 that needs downloading
    const nextDownloadCandidate = topPriorityJobs.find(job =>
      !downloadedFilePaths.has(job.id) && !downloadingFiles.has(job.id)
    );

    if (nextDownloadCandidate) {
      // Check if we are currently downloading ANY of the top 3?
      const isAnyDownloading = topPriorityJobs.some(job => downloadingFiles.has(job.id));

      if (!isAnyDownloading) {
        console.log(`📥 [AUTO-DL] Triggering sequential download for: ${nextDownloadCandidate.filename} (${nextDownloadCandidate.job_status})`);

        setDownloadingFiles(prev => new Set(prev).add(nextDownloadCandidate.id));

        window.electron.downloadStart(nextDownloadCandidate.id, nextDownloadCandidate.file_url, nextDownloadCandidate.filename)
          .catch(err => {
            console.error('Failed to start auto-download:', err);
            setDownloadingFiles(prev => {
              const next = new Set(prev);
              next.delete(nextDownloadCandidate.id);
              return next;
            });
          });
      }
    }

    // 🧹 RETENTION POLICY: Keep only files for Top 10 High Priority Jobs
    // User Request: "delete the the last download from as u only keep last 10 download only"

    // 1. Build "Keep List" (Max 10)
    // Priority: Printing > Pending (Oldest) > Completed (Newest)
    const allJobsSorted = [...jobs].sort((a, b) => {
      // Printing always first
      if (a.job_status === 'printing' && b.job_status !== 'printing') return -1;
      if (b.job_status === 'printing' && a.job_status !== 'printing') return 1;

      // Pending jobs (FIFO - Oldest "Created" first)
      if (a.job_status === 'pending' && b.job_status === 'pending') {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }

      // Completed/Cancelled jobs (LIFO - Newest "Completed/Updated" first) independent of pending
      // But we generally want Active > Pending > Completed

      const rank = (status: string) => {
        if (status === 'printing') return 1;
        if (status === 'pending') return 2;
        return 3; // completed, cancelled, failed
      };

      const rankA = rank(a.job_status);
      const rankB = rank(b.job_status);

      if (rankA !== rankB) return rankA - rankB;

      // Within Completed/Other: Newest first (Keep recent history)
      if (rankA === 3) {
        return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime();
      }

      // Within Pending: Oldest first (FIFO)
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    const keepJobIds = new Set(allJobsSorted.slice(0, 10).map(j => j.id));

    // 2. Identify Excess Downloads
    downloadedFilePaths.forEach((_, jobId) => {
      if (!keepJobIds.has(jobId)) {
        // It's downloaded but NOT in our Top 10 Keep List -> Delete it
        console.log(`🗑️ [RETENTION] Deleting excess cached file for job: ${jobId} (Not in Top 10)`);
        if (window.electron?.downloadDelete) {
          window.electron.downloadDelete(jobId).catch(console.error);
          // State update will happen via 'download-update' event listener
        }
      }
    });

  }, [jobs, downloadedFilePaths, downloadingFiles]);

  const loadJobs = async () => {
    if (!isRefreshing) {
      setIsLoading(true);
    }
    setError(null);

    try {
      let shopId = localStorage.getItem('shop-id');

      // Fallback: shop-id missing from localStorage but Supabase session may still be valid
      if (!shopId) {
        console.warn('⚠️ shop-id missing from localStorage — trying to recover from Supabase session...');
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user?.id) {
            const { data: shops } = await supabase
              .from('shops')
              .select('id')
              .eq('owner_id', user.id)
              .eq('is_active', true)
              .limit(1);
            if (shops && shops.length > 0) {
              shopId = shops[0].id;
              localStorage.setItem('shop-id', shopId);
              console.log('✅ Recovered shop-id from Supabase session:', shopId);
            }
          }
        } catch (recoverErr) {
          console.error('❌ Failed to recover shop-id:', recoverErr);
        }
      }

      if (!shopId) {
        console.warn('No shop ID found, cannot load jobs');
        setJobs([]);
        return;
      }

      console.log('🔄 Loading jobs for shop:', shopId);

      const { data: jobsData, error } = await getPrintJobs(shopId);


      if (error) {
        console.error('❌ Error loading jobs:', error);
        setError('Failed to load orders. Please check your connection.');
        setConnectionStatus('disconnected');
        return;
      }

      if (jobsData) {
        // Map Supabase type to App type
        const rawData = jobsData.map((job: any) => {
          let totalPages = job.total_pages;

          // If total_pages is missing, try to parse from recipe
          if (!totalPages && job.recipe) {
            try {
              const recipe = typeof job.recipe === 'string' ? JSON.parse(job.recipe) : job.recipe;
              totalPages = recipe.source?.totalPages || recipe.totalPages;
            } catch (e) {
              console.warn('Failed to parse recipe for total_pages', e);
            }
          }

          return {
            ...job,
            total_pages: totalPages || 1,
            pages_per_sheet: job.nup_pages || job.pages_per_sheet || 1,
            nup_orientation: job.nup_orientation || 'portrait'
          };
        }) as PrintJob[];

        // Use functional update to access the LATEST state and preserve local fields
        setJobs(prevJobs => {
          // Load print history from localStorage
          const printHistory = JSON.parse(localStorage.getItem('printHistory') || '{}');

          return rawData.map(newJob => {
            // Preserve local processing state if it exists
            const existingJob = prevJobs.find(j => j.id === newJob.id);
            if (existingJob) {
              if (existingJob.processed_file_url) newJob.processed_file_url = existingJob.processed_file_url;
              if (existingJob.processed_file_path) newJob.processed_file_path = existingJob.processed_file_path;
            }
            // Merge print history from localStorage (completed_at, processing_time_seconds)
            // Look for the latest history entry for this job
            const historyEntries = Object.values(printHistory).filter((e: any) => e.job_id === newJob.id || e.id === newJob.id);
            if (historyEntries.length > 0) {
              const latest = historyEntries.sort((a: any, b: any) =>
                new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
              )[0] as any;

              if (latest.completed_at) newJob.completed_at = latest.completed_at;
              if (latest.processing_time_seconds) newJob.processing_time_seconds = latest.processing_time_seconds;
            }
            return newJob;
          });
        });
        setLastJobCount(rawData.length);
        setConnectionStatus('connected');

        // NOTE: Auto-download is now handled by the reactive useEffect below

        // NOTE: Background processing is now handled by the reactive useEffect queue above
        // This ensures purely sequential FCFS processing triggered immediately upon download completion
      } else {
        console.log('📭 No jobs found for this shop');
        setJobs([]);
        setLastJobCount(0);
      }
    } catch (error) {
      console.error('❌ Error loading jobs:', error);
      setError('An unexpected error occurred while loading orders.');
      setConnectionStatus('disconnected');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadJobs();
    // Also clean up old files during refresh
    await cleanupOldFiles();
    setIsRefreshing(false);
  };

  // Persist printer mapping to localStorage to survive reloads
  useEffect(() => {
    try {
      const savedMap = localStorage.getItem('jobPrinterMap');
      if (savedMap) {
        const parsed = JSON.parse(savedMap);
        jobPrinterMapRef.current = new Map(parsed);
      }
    } catch (e) {
      console.error('Failed to load printer map', e);
    }
  }, []);

  const updatePrinterMap = (jobId: string, printerName: string, settings?: any) => {
    jobPrinterMapRef.current.set(jobId, { printerName, settings });
    // Save to localStorage
    try {
      localStorage.setItem('jobPrinterMap', JSON.stringify(Array.from(jobPrinterMapRef.current.entries())));
    } catch (e) {
      console.error('Failed to save printer map', e);
    }
  };

  const handleMarkPrinted = async (jobId: string, details?: { processingTime?: number }) => {
    try {
      console.log('🖨️ [Dashboard] Marking job as printed:', jobId, details);

      const completedAt = new Date().toISOString();
      const processingTime = details?.processingTime || 0;

      // Update local state immediately for instant UI feedback
      setJobs(prevJobs =>
        prevJobs.map(job =>
          job.id === jobId
            ? {
              ...job,
              job_status: 'completed' as const,
              updated_at: completedAt,
              completed_at: completedAt,
              processing_time_seconds: processingTime
            }
            : job
        )
      );

      // Persist print history to localStorage so it survives restarts
      try {
        const printHistory = JSON.parse(localStorage.getItem('printHistory') || '{}');

        // Get printer name and settings from our tracking map
        const trackedData = jobPrinterMapRef.current.get(jobId);
        const printerName = typeof trackedData === 'string' ? trackedData : (trackedData?.printerName || 'Unknown Printer');
        const actualSettings = typeof trackedData === 'object' ? trackedData?.settings : undefined;

        console.log('📊 [Dashboard] Stats capture for job:', jobId, 'Printer:', printerName, 'Settings:', actualSettings);

        // Find job details for fallback settings if they aren't in the map
        const job = jobs.find(j => j.id === jobId);

        // Create a unique key for this specific print event
        const historyKey = `${jobId}_${new Date(completedAt).getTime()}`;

        let totalPages = job?.total_pages;
        if (!totalPages && job?.recipe) {
          try {
            const recipe = typeof job.recipe === 'string' ? JSON.parse(job.recipe) : job.recipe;
            totalPages = recipe.source?.totalPages || recipe.totalPages;
          } catch (e) { }
        }

        printHistory[historyKey] = {
          job_id: jobId,
          completed_at: completedAt,
          processing_time_seconds: processingTime,
          printer_name: printerName,
          total_pages: totalPages || 1,
          settings: actualSettings || (job ? {
            paper_size: job.paper_size,
            color_mode: job.color_mode,
            print_type: job.print_type,
            copies: job.copies
          } : undefined)
        };
        localStorage.setItem('printHistory', JSON.stringify(printHistory));

        // Clean up tracking map and sync to localStorage
        jobPrinterMapRef.current.delete(jobId);
        try {
          localStorage.setItem('jobPrinterMap', JSON.stringify(Array.from(jobPrinterMapRef.current.entries())));
        } catch (e) {
          console.warn('⚠️ Could not sync jobPrinterMap to localStorage:', e);
        }

      } catch (e) {
        console.warn('⚠️ Could not save print history to localStorage:', e);
      }

      // Update in database (completed_at not in DB schema, use updated_at as printed time)
      const { error } = await updatePrintJob(jobId, {
        job_status: 'completed',
        updated_at: completedAt
      });

      if (error) {
        console.error('❌ Error updating job status:', error);
        // Revert the local state change
        setJobs(prevJobs =>
          prevJobs.map(job =>
            job.id === jobId
              ? { ...job, job_status: 'pending' as const }
              : job
          )
        );
        alert('Failed to update job status. Please try again.');
        return;
      }

      console.log('✅ Job marked as completed successfully');

      // Also try to mark as printed via Electron if available
      if (window.electron) {
        try {
          await window.electron.markJobPrinted(jobId);
        } catch (electronError) {
          console.warn('Electron markJobPrinted failed:', electronError);
        }
      }
    } catch (error) {
      console.error('❌ Error marking job as printed:', error);
      alert('An unexpected error occurred. Please try again.');
    }
  };

  // Toggle auto-processing
  const toggleAutoProcessing = () => {
    setAutoProcessingDisabled(!autoProcessingDisabled);

    // Show notification about the change
    const event = new CustomEvent('show-notification', {
      detail: {
        type: autoProcessingDisabled ? 'info' : 'warning',
        message: autoProcessingDisabled
          ? 'Auto-printing enabled. New jobs will be printed automatically.'
          : 'Auto-printing disabled. You must manually print new jobs.'
      }
    });
    window.dispatchEvent(event);
  };

  if (isLoading) {
    return (
      <div className="container-max-space">
        <div className="flex justify-center items-center h-96">
          <div className="relative flex items-center">
            <div className="w-12 h-12 border-4 border-blue-200 dark:border-blue-800 rounded-full animate-spin"></div>
            <div className="absolute top-0 left-0 w-12 h-12 border-4 border-transparent border-t-blue-600 rounded-full animate-spin"></div>
            <div className="ml-4">
              <p className="text-lg font-medium text-gray-900 dark:text-white">Loading orders...</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Connecting to database</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container-max-space">
        <div className="flex justify-center items-center h-96">
          <div className="text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Failed to Load Orders</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
            <button
              onClick={loadJobs}
              className="btn-primary"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Handle Print Started (Capture printer name and settings for stats)
  const handlePrintStarted = (jobId: string, printerName: string, settings: any) => {
    // Track which printer and settings are used for this job
    updatePrinterMap(jobId, printerName, settings);
    console.log(`📊 [STATS] Tracking printer for Job ${jobId}: ${printerName} with settings:`, settings);
  };

  return (
    <div className="container-max-space animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center shadow-large mr-4">
              <Activity className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gradient-primary">Dashboard</h1>
              <div className="flex items-center gap-3">
                <p className="text-gray-600 dark:text-gray-400">Monitor your shop's performance and activity</p>

                {/* Connection Status Indicator */}
                <div className="flex items-center">
                  {connectionStatus === 'connected' && (
                    <div className="flex items-center text-green-600 dark:text-green-400">
                      <Wifi className="h-4 w-4 mr-1" />
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></div>
                      <span className="text-xs font-medium">Live Updates</span>
                    </div>
                  )}
                  {connectionStatus === 'disconnected' && (
                    <div className="flex items-center text-red-600 dark:text-red-400">
                      <WifiOff className="h-4 w-4 mr-1" />
                      <span className="text-xs font-medium">Offline Mode</span>
                    </div>
                  )}
                  {connectionStatus === 'connecting' && (
                    <div className="flex items-center text-yellow-600 dark:text-yellow-400">
                      <div className="w-4 h-4 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin mr-1"></div>
                      <span className="text-xs font-medium">Connecting...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            {/* Auto-print toggle */}
            <button
              onClick={toggleAutoProcessing}
              className={`btn-secondary ${autoProcessingDisabled ? 'bg-gray-100 dark:bg-gray-700' : 'bg-green-100 dark:bg-green-700 text-green-800 dark:text-green-300'}`}
            >
              <span className={`inline-block w-4 h-4 rounded-full mr-2 ${autoProcessingDisabled ? 'bg-gray-400' : 'bg-green-500'}`}></span>
              Auto-Print: {autoProcessingDisabled ? 'Off' : 'On'}
            </button>

            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="btn-primary shadow-large hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`h-5 w-5 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Refreshing...' : 'Refresh Orders'}
            </button>
          </div>
        </div>

      </div>

      {/* Main Content */}
      <div className="content-max-space animate-slide-up">
        <div className="space-y-6 h-full">
          {/* Stats Cards - Restored as per user request */}
          <StatsCards jobs={jobs} />

          {/* Job List with Full Height */}
          <div className="flex-1">
            <JobList
              jobs={jobs}
              onMarkPrinted={handleMarkPrinted}
              onPrintStarted={handlePrintStarted}
              onJobUpdated={(jobId, updates) => {
                setJobs((prev) => prev.map((j) => (j.id === jobId ? { ...j, ...updates } : j)));
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;