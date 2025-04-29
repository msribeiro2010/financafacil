import { Switch, Route, useLocation } from "wouter";
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
import Login from "@/pages/login";
import { useState, useEffect } from "react";

function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    // Check if user is already logged in
    const checkLoginStatus = async () => {
      try {
        // Try to get the current user's session
        const response = await fetch('/api/user/session');
        
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        }
      } catch (error) {
        console.error('Session check failed:', error);
      } finally {
        setLoading(false);
      }
    };
    
    checkLoginStatus();
  }, []);
  
  const handleLogin = (userData: any) => {
    setUser(userData);
  };
  
  const handleLogout = async () => {
    try {
      await fetch('/api/user/logout', { method: 'POST' });
      setUser(null);
      setLocation('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };
  
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
      <QueryClientProvider client={queryClient}>
        <Toaster />
        <Login onLogin={handleLogin} />
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppLayout user={user} onLogout={handleLogout}>
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
