import React from 'react';
import { NavLink } from 'react-router-dom';
import { Printer, Home, Settings as SettingsIcon, ChevronLeft, ChevronRight, LogOut, User, Shield } from 'lucide-react';
import PrintGetLogo from './PrintGetLogo';
import SidebarStats from './SidebarStats';

interface SidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
  currentUser?: any;
  onLogout?: () => void;
  jobs?: any[];
  printers?: any[];
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, toggleSidebar, currentUser, onLogout, jobs = [] }) => {
  const handleNavClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const handleEmptyAreaClick = (e: React.MouseEvent) => {
    if (!isOpen && (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('sidebar-empty-area'))) {
      e.preventDefault();
      e.stopPropagation();
      toggleSidebar();
    }
  };

  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleSidebar();
  };

  const handleLogout = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onLogout) {
      onLogout();
    }
  };



  return (
    <div
      className={`${isOpen ? 'w-64' : 'w-16'
        } h-screen backdrop-blur-glass bg-white/90 dark:bg-gray-900/90 text-gray-800 dark:text-white shadow-2xl transition-all duration-300 ease-in-out flex flex-col relative flex-shrink-0 border-r border-gray-200/30 dark:border-gray-700/30 sidebar-container`}
      onClick={handleEmptyAreaClick}
    >
      {/* Header */}
      <div className="p-4 flex justify-between items-center border-b border-gray-200/30">
        <div className={`flex items-center min-w-0 ${!isOpen && 'justify-center w-full'}`}>
          {isOpen ? (
            <div className="min-w-0">
              <PrintGetLogo size="md" />
              <div className="flex items-center gap-2 mt-1.5 ml-0.5">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <p className="text-xs text-gray-500 font-medium">Shop Manager</p>
              </div>
            </div>
          ) : (
            <PrintGetLogo size="sm" showText={false} />
          )}
        </div>
        {isOpen && (
          <button
            onClick={handleToggleClick}
            className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 shadow-soft hover:shadow-medium"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Expand button when collapsed - OUTSIDE sidebar on the right edge */}
      {!isOpen && (
        <button
          onClick={handleToggleClick}
          className="absolute bg-gradient-primary/80 backdrop-blur-sm rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 z-50 group hover:scale-110 hover:bg-gradient-primary border border-white/50 dark:border-gray-700/50"
          style={{
            right: '-1.5rem',
            top: '3.5rem',
            padding: '0.5rem',
            width: '2.5rem',
            height: '2.5rem'
          }}
        >
          <ChevronRight className="h-4 w-4 text-white group-hover:translate-x-0.5 transition-transform" />
        </button>
      )}

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-6 sidebar-empty-area">
        <nav className={`space-y-2 ${isOpen ? 'px-3' : 'px-2'}`}>
          <NavLink
            to="/"
            onClick={handleNavClick}
            className={({ isActive }) =>
              `flex items-center rounded-lg transition-all duration-200 group ${isActive
                ? 'bg-gradient-primary text-white shadow-large'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              } ${isOpen ? 'px-3 py-2.5' : 'p-3 justify-center'}`
            }
            title={!isOpen ? "Dashboard" : ""}
          >
            <Home className="h-5 w-5 flex-shrink-0" />
            {isOpen && <span className="ml-3 font-medium">Dashboard</span>}
          </NavLink>

          <NavLink
            to="/printers"
            onClick={handleNavClick}
            className={({ isActive }) =>
              `flex items-center rounded-lg transition-all duration-200 group ${isActive
                ? 'bg-gradient-primary text-white shadow-large'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              } ${isOpen ? 'px-3 py-2.5' : 'p-3 justify-center'}`
            }
            title={!isOpen ? "Printers" : ""}
          >
            <Printer className="h-5 w-5 flex-shrink-0" />
            {isOpen && <span className="ml-3 font-medium">Printers</span>}
          </NavLink>

          <NavLink
            to="/settings"
            onClick={handleNavClick}
            className={({ isActive }) =>
              `flex items-center rounded-lg transition-all duration-200 group ${isActive
                ? 'bg-gradient-primary text-white shadow-large'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              } ${isOpen ? 'px-3 py-2.5' : 'p-3 justify-center'}`
            }
            title={!isOpen ? "Settings" : ""}
          >
            <SettingsIcon className="h-5 w-5 flex-shrink-0" />
            {isOpen && <span className="ml-3 font-medium">Settings</span>}
          </NavLink>
        </nav>

        {/* User Info - Only show when expanded */}
        {isOpen && currentUser && (
          <div className="mt-8 mx-3 p-4 bg-gradient-to-br from-blue-50/80 to-indigo-50/80 dark:from-gray-800/80 dark:to-gray-700/80 rounded-xl border border-blue-100/50 dark:border-gray-600/50 backdrop-blur-sm shadow-large sidebar-empty-area">
            <div className="flex items-center mb-3">
              <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center shadow-soft mr-2">
                <User className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-gray-700 dark:text-gray-300 truncate">
                  {currentUser.name}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {currentUser.email}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-3">
              <div className="flex items-center">
                <Shield className="h-3 w-3 mr-1" />
                <span>{currentUser.role || 'Owner'}</span>
              </div>
              <div className="flex items-center">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></div>
                <span>Active</span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all duration-200"
            >
              <LogOut className="h-3 w-3 mr-2" />
              Sign Out
            </button>
          </div>
        )}

        {/* Average Print Time Stats - Replaces "Quick Stats" */}
        <SidebarStats jobs={jobs} isOpen={isOpen} />
      </div>
    </div>
  );
};

export default Sidebar;
