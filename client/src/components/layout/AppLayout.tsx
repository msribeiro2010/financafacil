import React from 'react';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import { useLocation } from 'wouter';

interface AppLayoutProps {
  children: React.ReactNode;
  user: any;
}

const getPageTitle = (path: string) => {
  switch (path) {
    case '/':
      return 'Dashboard';
    case '/transactions':
      return 'Transações';
    case '/recurring':
      return 'Recorrentes';
    case '/reports':
      return 'Relatórios';
    case '/settings':
      return 'Configurações';
    default:
      return 'Dashboard';
  }
};

export default function AppLayout({ children, user }: AppLayoutProps) {
  const [location] = useLocation();
  const pageTitle = getPageTitle(location);
  
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar - hidden on mobile */}
      <Sidebar currentPath={location} />
      
      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
        {/* Header */}
        <header className="bg-white shadow-sm p-4 flex justify-between items-center">
          <div className="md:hidden">
            <h1 className="text-xl font-bold text-primary">FinançaFácil</h1>
          </div>
          <div className="hidden md:block">
            <h2 className="text-xl font-medium">{pageTitle}</h2>
          </div>
          <div className="flex items-center space-x-4">
            <button className="p-2 rounded-full hover:bg-slate-100">
              <i className="ri-notification-3-line text-slate-600"></i>
            </button>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center">
                <span className="text-sm font-medium">
                  {user?.username?.charAt(0).toUpperCase() || 'U'}
                </span>
              </div>
              <span className="hidden md:inline-block text-sm font-medium">
                {user?.username || 'Usuário'}
              </span>
            </div>
          </div>
        </header>
        
        {/* Page Content */}
        <div className="p-4 md:p-6">
          {children}
        </div>
      </main>
      
      {/* Mobile Bottom Navigation */}
      <MobileNav currentPath={location} />
    </div>
  );
}
