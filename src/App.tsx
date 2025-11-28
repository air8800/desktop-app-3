import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Components
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Printers from './pages/Printers';
import Settings from './pages/Settings';
import Login from './pages/Login';

// Context
import { ThemeProvider } from './context/ThemeContext';

// Auth utilities
import { validateSession, initializeAuth } from './utils/auth';

// Mock data
import { mockJobs } from './data/mockData';
import { getPrintJobs } from './utils/supabase';
import { PrintJob } from './types';

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [printers, setPrinters] = useState<any[]>([]);

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  // Load jobs and printers data
  useEffect(() => {
    const loadData = async () => {
      if (isAuthenticated) {
        try {
          const shopId = localStorage.getItem('shop-id');
          if (shopId) {
            const result = await getPrintJobs(shopId);
            if (result.data) setJobs(result.data);
          }

          if (window.electron?.getPrinters) {
            const printersResult = await window.electron.getPrinters();
            if (printersResult?.printers) setPrinters(printersResult.printers);
          }
        } catch (error) {
          console.error('Error loading data:', error);
        }
      }
    };

    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Initialize auth system and check authentication status
  useEffect(() => {
    try {
      console.log('Checking authentication status...');

      // Validate current session
      const sessionValidation = validateSession();

      if (sessionValidation.isValid && sessionValidation.user) {
        console.log('Valid session found:', sessionValidation.user);
        setIsAuthenticated(true);
        setCurrentUser(sessionValidation.user);
      } else {
        console.log('No valid session found');
        setIsAuthenticated(false);
        setCurrentUser(null);
      }
    } catch (error) {
      console.error('Auth check error:', error);
      setIsAuthenticated(false);
      setCurrentUser(null);
    }

    setIsLoading(false);

    // Initialize the authentication system and return cleanup function
    const { unsubscribe } = initializeAuth();
    
    return () => {
      unsubscribe();
    };
  }, []);

  // Secure login handler
  const handleLogin = (userData: any) => {
    console.log('handleLogin called with:', userData);
    
    try {
      // Store user session data
      localStorage.setItem('user-session', JSON.stringify(userData));
      localStorage.setItem('isAuthenticated', 'true');
      
      console.log('Authentication data stored successfully');
      
      // Update state immediately
      setIsAuthenticated(true);
      setCurrentUser(userData);
      
      console.log('Authentication state updated');
    } catch (error) {
      console.error('Login handler error:', error);
    }
  };

  // Logout handler
  const handleLogout = () => {
    try {
      // Clear all authentication data
      localStorage.removeItem('isAuthenticated');
      localStorage.removeItem('user-session');
      localStorage.removeItem('auth-token');
      
      // Update state
      setIsAuthenticated(false);
      setCurrentUser(null);
      
      console.log('User logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Loading screen
  if (isLoading) {
    return (
      <ThemeProvider>
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
          <div className="text-center">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-blue-200 dark:border-blue-800 rounded-full animate-spin mb-4 mx-auto"></div>
              <div className="absolute top-0 left-0 w-16 h-16 border-4 border-transparent border-t-blue-600 rounded-full animate-spin"></div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Xerox Manager</h2>
            <p className="text-gray-600 dark:text-gray-400">Initializing secure workspace...</p>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  console.log('Rendering app with isAuthenticated:', isAuthenticated);

  // Show login if not authenticated
  if (!isAuthenticated) {
    return (
      <ThemeProvider>
        <Login onLogin={handleLogin} />
      </ThemeProvider>
    );
  }

  // Show main app if authenticated with enhanced background
  return (
    <ThemeProvider>
      <Router>
        <div className="flex h-screen app-background text-gray-900 dark:text-gray-100 transition-all duration-300 overflow-hidden">
          <Sidebar
            isOpen={isSidebarOpen}
            toggleSidebar={toggleSidebar}
            currentUser={currentUser}
            onLogout={handleLogout}
            jobs={jobs}
            printers={printers}
          />
          
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            <main className="flex-1 overflow-y-auto p-4 lg:p-6 xl:p-8 container-max-space">
              <div className="content-max-space">
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/printers" element={<Printers />} />
                  <Route path="/settings" element={<Settings currentUser={currentUser} />} />
                  <Route path="*" element={<Navigate to="/\" replace />} />
                </Routes>
              </div>
            </main>
          </div>
        </div>
      </Router>
    </ThemeProvider>
  );
}

export default App;