import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';

interface AppShellProps {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  currentUser: unknown;
  onLogout: () => void;
  jobs: unknown[];
  printers: unknown[];
  padded?: boolean;
}

const AppShell: React.FC<AppShellProps> = ({
  isSidebarOpen,
  toggleSidebar,
  currentUser,
  onLogout,
  jobs,
  printers,
  padded = true,
}) => (
  <div className="flex h-screen app-background text-gray-900 dark:text-gray-100 overflow-hidden">
    <Sidebar
      isOpen={isSidebarOpen}
      toggleSidebar={toggleSidebar}
      currentUser={currentUser}
      onLogout={onLogout}
      jobs={jobs}
      printers={printers}
    />
    <div className="flex-1 flex flex-col overflow-hidden min-w-0">
      <main className="flex-1 overflow-y-auto container-max-space bg-gray-50 dark:bg-gray-900">
        {padded ? (
          <div className="p-4 lg:p-6 xl:p-8 min-h-full">
            <div className="content-max-space">
              <Outlet />
            </div>
          </div>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  </div>
);

export default AppShell;
