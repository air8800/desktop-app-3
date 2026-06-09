import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppRouter as Router, resetAppRoute } from './utils/appRouter';
import AppShell from './layouts/AppShell';
import Dashboard from './pages/Dashboard';
import Printers from './pages/Printers';
import Settings from './pages/Settings';
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';

import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';
import CookiePolicyPage from './pages/CookiePolicyPage';
import PrivacyPage from './pages/PrivacyPage';
import RefundPolicyPage from './pages/RefundPolicyPage';
import TermsPage from './pages/TermsPage';

import { ThemeProvider } from './context/ThemeContext';
import { validateSession, initializeAuth, logout, completeOAuthFromTokens } from './utils/auth';
import { parseOAuthCallbackUrl } from './utils/partnerAuthApi';
import { getCachedPrinters } from './utils/printerCache';
import { supabase, getPrintJobs, subscribeToNewJobs } from './utils/supabase';
import { setShopDesktopLive } from './utils/shopLiveStatus';
import ShopCloseModal from './components/ShopCloseModal';
import { PrintJob } from './types';

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [printers, setPrinters] = useState<any[]>([]);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [isClosingApp, setIsClosingApp] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isOAuthLoading, setIsOAuthLoading] = useState(false);

  const markShopLive = async (isLive: boolean) => {
    const shopId = localStorage.getItem('shop-id');
    if (!shopId) return;
    await setShopDesktopLive(shopId, isLive);
  };

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  useEffect(() => {
    let unsubscribeJobs: { unsubscribe?: () => void } | undefined;

    const loadData = async () => {
      if (isAuthenticated && !needsOnboarding) {
        try {
          let shopId = localStorage.getItem('shop-id');

          // Recover shop-id from Supabase session if missing from localStorage
          if (!shopId) {
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
                  console.log('✅ [App] Recovered shop-id:', shopId);
                }
              }
            } catch (e) { console.warn('Could not recover shop-id', e); }
          }

          if (shopId) {
            const result = await getPrintJobs(shopId);
            if (result.data) {
              const printHistory = JSON.parse(localStorage.getItem('printHistory') || '{}');
              const enriched = result.data.map((job: any) => {
                const history = printHistory[job.id];
                return history ? { ...job, ...history } : job;
              });
              setJobs(enriched);
            }

            unsubscribeJobs = subscribeToNewJobs(shopId, () => {
              getPrintJobs(shopId!).then((res) => {
                if (res.data) {
                  const printHistory = JSON.parse(localStorage.getItem('printHistory') || '{}');
                  const enriched = res.data.map((job: any) => {
                    const history = printHistory[job.id];
                    return history ? { ...job, ...history } : job;
                  });
                  setJobs(enriched);
                }
              });
            });
          }

          const cachedPrinters = await getCachedPrinters();
          if (cachedPrinters) setPrinters(cachedPrinters);
        } catch (error) {
          console.error('Error loading data:', error);
        }
      }
    };

    loadData();
    const interval = setInterval(loadData, 30000);
    return () => {
      clearInterval(interval);
      if (unsubscribeJobs?.unsubscribe) unsubscribeJobs.unsubscribe();
    };
  }, [isAuthenticated, needsOnboarding]);

  // Mark shop live while the app is open — don't block UI
  useEffect(() => {
    if (isAuthenticated && !needsOnboarding) {
      markShopLive(true).catch(() => {});
    }
  }, [isAuthenticated, needsOnboarding]);

  // Electron: intercept window close and show in-app confirmation
  useEffect(() => {
    if (!window.electron?.onAppCloseRequested) return undefined;

    const unsubscribe = window.electron.onAppCloseRequested(() => {
      if (isAuthenticated && !needsOnboarding) {
        setShowCloseModal(true);
      } else if (window.electron?.confirmAppQuit) {
        window.electron.confirmAppQuit();
      }
    });

    return unsubscribe;
  }, [isAuthenticated, needsOnboarding]);

  const handleConfirmAppClose = async () => {
    setIsClosingApp(true);
    try {
      await markShopLive(false);
      if (window.electron?.confirmAppQuit) {
        await window.electron.confirmAppQuit();
      }
    } finally {
      setIsClosingApp(false);
      setShowCloseModal(false);
    }
  };

  useEffect(() => {
    const boot = async () => {
      try {
        const session = await validateSession();
        if (session.isValid && session.user) {
          setIsAuthenticated(true);
          setCurrentUser(session.user);
          setNeedsOnboarding(!!session.needsOnboarding);
        }
      } catch (error) {
        console.error('Auth check error:', error);
      }
      setIsLoading(false);
    };
    boot();
    const { unsubscribe } = initializeAuth();
    return () => unsubscribe();
  }, []);

  const handleLogin = (userData: any) => {
    setAuthError('');
    setIsAuthenticated(true);
    setCurrentUser(userData);
    setNeedsOnboarding(!!userData.needsOnboarding && !userData.shopId);
    setShowCloseModal(false);
    if (!userData.needsOnboarding || userData.shopId) {
      resetAppRoute('/');
    }
  };

  const oauthInFlightRef = React.useRef(false);

  const handleOAuthCallback = React.useCallback(async (url: string) => {
    if (oauthInFlightRef.current) return;
    oauthInFlightRef.current = true;

    try {
      const { accessToken, refreshToken, error: oauthError } = parseOAuthCallbackUrl(url);

      if (oauthError) {
        setAuthError(oauthError);
        window.electron?.stopOAuthRedirect?.();
        return;
      }
      if (!accessToken) {
        setAuthError('Google sign-in failed. Please try again.');
        window.electron?.stopOAuthRedirect?.();
        return;
      }

      const result = await completeOAuthFromTokens(accessToken, refreshToken);
      window.electron?.stopOAuthRedirect?.();

      if (!result.success || !result.user) {
        setAuthError(result.error || 'Google sign-in failed');
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 350));

      setAuthError('');
      if (result.needsOnboarding) {
        setIsAuthenticated(true);
        setCurrentUser(result.user);
        setNeedsOnboarding(true);
      } else {
        handleLogin({
          ...result.user,
          token: result.token,
          needsOnboarding: false,
        });
      }
    } finally {
      oauthInFlightRef.current = false;
      setIsOAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!window.electron?.onOAuthCallback) return undefined;
    return window.electron.onOAuthCallback(handleOAuthCallback);
  }, [handleOAuthCallback]);

  const handleLogout = async () => {
    try {
      setShowCloseModal(false);
      await markShopLive(false);
      await logout();
      setJobs([]);
      setPrinters([]);
      setIsAuthenticated(false);
      setCurrentUser(null);
      setNeedsOnboarding(false);
      resetAppRoute('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      resetAppRoute('/');
    }
  }, [isAuthenticated, isLoading]);

  if (isLoading) {
    return (
      <ThemeProvider>
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-200 dark:border-blue-800 rounded-full animate-spin mb-4 mx-auto border-t-blue-600" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">PrintGet</h2>
            <p className="text-gray-600 dark:text-gray-400">Initializing...</p>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <ShopCloseModal
        isOpen={showCloseModal}
        onStayOpen={() => setShowCloseModal(false)}
        onConfirmClose={handleConfirmAppClose}
        isProcessing={isClosingApp}
      />
      <Router>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallback onLogin={handleLogin} />} />

          {isAuthenticated && !needsOnboarding ? (
            <Route
              element={
                <AppShell
                  isSidebarOpen={isSidebarOpen}
                  toggleSidebar={toggleSidebar}
                  currentUser={currentUser}
                  onLogout={handleLogout}
                  jobs={jobs}
                  printers={printers}
                />
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="printers" element={<Printers />} />
              <Route path="settings" element={<Settings currentUser={currentUser} />} />
              <Route path="about" element={<AboutPage />} />
              <Route path="contact" element={<ContactPage />} />
              <Route path="cookie-policy" element={<CookiePolicyPage />} />
              <Route path="privacy" element={<PrivacyPage />} />
              <Route path="refund-policy" element={<RefundPolicyPage />} />
              <Route path="terms" element={<TermsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          ) : (
            <Route
              path="*"
              element={
                <Login
                  onLogin={handleLogin}
                  forceOnboarding={isAuthenticated && needsOnboarding}
                  authError={authError}
                  onClearAuthError={() => setAuthError('')}
                  isOAuthLoading={isOAuthLoading}
                  onOAuthStart={() => setIsOAuthLoading(true)}
                />
              }
            />
          )}
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
