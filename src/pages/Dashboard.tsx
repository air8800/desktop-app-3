import React, { useState, useEffect, useRef } from 'react';
import JobList from '../components/JobList';
import StatsCards from '../components/StatsCards';
import { PrintJob } from '../types';
import { getPrintJobs, subscribeToNewJobs, updatePrintJob, requestNotificationPermission, testConnection } from '../utils/supabase';
import { Activity, FileText, RefreshCw, Wifi, WifiOff } from 'lucide-react';

const Dashboard: React.FC = () => {
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeSection] = useState<'overview'>('overview');
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');
  const [lastJobCount, setLastJobCount] = useState(0);
  const [downloadingFiles, setDownloadingFiles] = useState<Set<string>>(new Set());
  
  // Refs for cleanup
  const subscriptionRef = useRef<any>(null);
  const pollingIntervalRef = useRef<any>(null);
  const mountedRef = useRef(true);

  // Auto-print disabled flag - DEFAULT TO TRUE (disabled)
  const [autoProcessingDisabled, setAutoProcessingDisabled] = useState(true);

  useEffect(() => {
    mountedRef.current = true;
    loadJobs();
    requestNotificationPermission();
    testDatabaseConnection();
    
    // Set up both real-time and polling
    setupRealTimeAndPolling();
    
    // Clean up old print files on startup
    cleanupOldFiles();
    
    // Cleanup on unmount
    return () => {
      mountedRef.current = false;
      cleanupSubscriptions();
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
      console.log('🔄 Processing new job:', job.filename);

      // Show notification for new job
      showNotification(job);

      // Only auto-download and print if auto-processing is enabled
      if (!autoProcessingDisabled && job.payment_status === 'paid') {
        console.log('⚠️ Auto-processing is disabled. Job will not be automatically printed.');
        
        // Just download the file for manual printing
        const result = await window.electron.openFileForPrinting(job.file_url, job.filename);
        
        if (result.success) {
          console.log('✅ File downloaded for manual printing:', result.message);
          
          // Show info notification
          const event = new CustomEvent('show-notification', {
            detail: {
              type: 'info',
              message: `New job received: ${job.filename}. Click "Print Now" to print.`
            }
          });
          window.dispatchEvent(event);
        }
      } else {
        console.log('ℹ️ New job received but auto-printing is disabled');
        
        // Show notification
        const event = new CustomEvent('show-notification', {
          detail: {
            type: 'info',
            message: `New job received: ${job.filename}. Use the Print Now button to print.`
          }
        });
        window.dispatchEvent(event);
      }
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
      subscriptionRef.current = subscribeToNewJobs(shopId, (newJob: PrintJob) => {
        if (!mountedRef.current) return;
        
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
        body: `${job.customer_name} ordered ${job.copies} copies of ${job.filename}`,
        icon: '/icon.png',
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

  const loadJobs = async () => {
    if (!isRefreshing) {
      setIsLoading(true);
    }
    setError(null);
    
    try {
      const shopId = localStorage.getItem('shop-id');
      
      if (!shopId) {
        console.warn('No shop ID found, cannot load jobs');
        setJobs([]);
        return;
      }

      console.log('🔄 Loading jobs for shop:', shopId);
      
      const { data, error } = await getPrintJobs(shopId);
      
      if (error) {
        console.error('❌ Error loading jobs:', error);
        setError('Failed to load orders. Please check your connection.');
        setConnectionStatus('disconnected');
        return;
      }

      if (data) {
        console.log('✅ Jobs loaded successfully:', data.length, 'jobs');
        setJobs(data);
        setLastJobCount(data.length);
        setConnectionStatus('connected');
        
        // 🚀 OPTIMIZATION: Preload PDFs in background for instant preview
        if (data.length > 0) {
          import('../utils/pdfUtils').then(({ preloadPdf }) => {
            data.forEach(job => {
              if (job.file_url) {
                preloadPdf(job.file_url);
              }
            });
          });
        }
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

  const handleMarkPrinted = async (jobId: string) => {
    try {
      console.log('🖨️ Marking job as printed:', jobId);
      
      // Update local state immediately for instant UI feedback
      setJobs(prevJobs => 
        prevJobs.map(job => 
          job.id === jobId 
            ? { ...job, job_status: 'completed' as const, updated_at: new Date().toISOString() }
            : job
        )
      );
      
      // Update in database
      const { error } = await updatePrintJob(jobId, { 
        job_status: 'completed',
        updated_at: new Date().toISOString()
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
          {/* Stats Cards */}
          <StatsCards jobs={jobs} />

          {/* Job List with Full Height */}
          <div className="flex-1">
            <JobList jobs={jobs} onMarkPrinted={handleMarkPrinted} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;