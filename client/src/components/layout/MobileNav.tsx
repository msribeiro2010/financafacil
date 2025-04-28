import React from 'react';
import { Link } from 'wouter';
import { cn } from '@/lib/utils';
import { Plus } from 'lucide-react';
import { useModal } from '@/hooks/use-modal';

interface MobileNavProps {
  currentPath: string;
}

export default function MobileNav({ currentPath }: MobileNavProps) {
  const { openModal } = useModal();
  
  const navItems = [
    { path: '/', label: 'Dashboard', icon: 'ri-dashboard-line' },
    { path: '/transactions', label: 'Transações', icon: 'ri-money-dollar-circle-line' },
    { path: '/recurring', label: 'Recorrentes', icon: 'ri-repeat-line' },
    { path: '/reports', label: 'Relatórios', icon: 'ri-pie-chart-line' },
  ];
  
  const handleAddClick = () => {
    openModal('expense');
  };

  return (
    <nav className="md:hidden fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 shadow-lg z-20">
      <div className="flex justify-around">
        {navItems.map((item, index) => (
          <Link key={index} href={item.path}>
            <a className={cn(
              "flex flex-col items-center p-3",
              currentPath === item.path ? "text-primary" : "text-slate-500"
            )}>
              <i className={`${item.icon} text-xl`}></i>
              <span className="text-xs mt-1">{item.label}</span>
            </a>
          </Link>
        ))}
        
        <button 
          onClick={handleAddClick}
          className="flex flex-col items-center p-3 text-white bg-primary rounded-full -mt-5 shadow-lg"
        >
          <Plus className="h-5 w-5" />
          <span className="text-xs mt-1">Adicionar</span>
        </button>
      </div>
    </nav>
  );
}
