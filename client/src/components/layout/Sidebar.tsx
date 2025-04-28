import React from 'react';
import { Link } from 'wouter';
import { cn } from '@/lib/utils';

interface SidebarProps {
  currentPath: string;
}

export default function Sidebar({ currentPath }: SidebarProps) {
  const navItems = [
    { path: '/', label: 'Dashboard', icon: 'ri-dashboard-line' },
    { path: '/transactions', label: 'Transações', icon: 'ri-money-dollar-circle-line' },
    { path: '/recurring', label: 'Recorrentes', icon: 'ri-repeat-line' },
    { path: '/reports', label: 'Relatórios', icon: 'ri-pie-chart-line' },
    { path: '/settings', label: 'Configurações', icon: 'ri-settings-line' },
  ];

  return (
    <aside className="hidden md:block w-64 bg-white shadow-md">
      <div className="p-4 border-b">
        <h1 className="text-2xl font-bold text-primary">FinançaFácil</h1>
        <p className="text-sm text-slate-500">Seu Gerenciador Financeiro</p>
      </div>
      <nav className="p-4">
        <ul className="space-y-2">
          {navItems.map((item) => (
            <li key={item.path}>
              <Link href={item.path}>
                <a className={cn(
                  "flex items-center p-2 rounded-lg",
                  currentPath === item.path
                    ? "text-primary bg-cyan-50"
                    : "text-slate-700 hover:bg-slate-100"
                )}>
                  <i className={`${item.icon} mr-2`}></i>
                  <span>{item.label}</span>
                </a>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
