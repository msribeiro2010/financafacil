import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import AppLayout from "@/components/layout/AppLayout";
import Dashboard from "@/pages/dashboard";
import Transactions from "@/pages/transactions";
import Recurring from "@/pages/recurring";
import Reports from "@/pages/reports";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";
import { useState, useEffect } from "react";

function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Auto-login with demo user for this prototype
    const autoLogin = async () => {
      try {
        const response = await fetch('/api/user/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ username: 'demo', password: 'demo123' }),
        });
        
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        }
      } catch (error) {
        console.error('Auto login failed:', error);
      } finally {
        setLoading(false);
      }
    };
    
    autoLogin();
  }, []);
  
  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-slate-600">Carregando FinançaFácil...</p>
        </div>
      </div>
    );
  }
  
  if (!user) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-100">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-primary mb-4">FinançaFácil</h1>
          <p className="text-slate-600 mb-4">Erro ao carregar. Tente novamente mais tarde.</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary text-white rounded-md hover:bg-secondary transition-colors"
          >
            Recarregar
          </button>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppLayout user={user}>
          <Toaster />
          <Switch>
            <Route path="/" component={() => <Dashboard userId={user.id} />} />
            <Route path="/transactions" component={() => <Transactions userId={user.id} />} />
            <Route path="/recurring" component={() => <Recurring userId={user.id} />} />
            <Route path="/reports" component={() => <Reports userId={user.id} />} />
            <Route path="/settings" component={() => <Settings userId={user.id} user={user} />} />
            <Route component={NotFound} />
          </Switch>
        </AppLayout>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
