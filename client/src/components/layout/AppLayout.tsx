import React from 'react';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import { useLocation } from 'wouter';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Settings, LogOut, User } from 'lucide-react';

interface AppLayoutProps {
  children: React.ReactNode;
  user: any;
  onLogout?: () => void;
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

export default function AppLayout({ children, user, onLogout }: AppLayoutProps) {
  const [location, setLocation] = useLocation();
  const pageTitle = getPageTitle(location);
  
  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    }
  };
  
  const goToSettings = () => {
    setLocation('/settings');
  };
  
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
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center space-x-2 outline-none">
                <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center">
                  <span className="text-sm font-medium">
                    {user?.username?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <span className="hidden md:inline-block text-sm font-medium">
                  {user?.username || 'Usuário'}
                </span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="ml-1 h-4 w-4 text-muted-foreground hidden md:block"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="flex items-center justify-start gap-2 p-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white">
                    <span className="text-md font-medium">
                      {user?.username?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  </div>
                  <div className="flex flex-col space-y-0.5">
                    <p className="text-sm font-medium">{user?.username || 'Usuário'}</p>
                    <p className="text-xs text-muted-foreground">Conta demonstrativa</p>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={goToSettings} className="cursor-pointer">
                  <User className="mr-2 h-4 w-4" />
                  <span>Meu perfil</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={goToSettings} className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Configurações</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-rose-500 focus:text-rose-500">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
