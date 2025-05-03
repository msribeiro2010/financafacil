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
import Register from "@/pages/register";
import { useState, useEffect, useCallback } from "react";
import { apiRequest } from "./lib/queryClient";

function App() {
  const [user, setUser] = useState<any>(null);
  const [authState, setAuthState] = useState<'login' | 'register' | 'authenticated'>('login'); // Estados de autenticação
  const [location, setLocation] = useLocation();
  
  // Função para atualizar os dados do usuário
  const updateUserData = useCallback(async (userId: number) => {
    try {
      console.log('Atualizando dados do usuário:', userId);
      const response = await apiRequest('GET', `/api/user/${userId}`);
      const updatedUser = await response.json();
      console.log('Dados do usuário atualizados:', updatedUser);
      
      // Forçar atualizando a versão normalizada para o React
      const normalizedUser = {
        ...updatedUser,
        initialBalance: updatedUser.initial_balance,
        overdraftLimit: updatedUser.overdraft_limit,
      };
      
      console.log('Dados do usuário normalizados para atualização:', normalizedUser);
      
      // Atualizar o estado com os dados normalizados
      setUser(normalizedUser);
      
      // Atualizar o cache do React Query para sincronização com componentes
      queryClient.setQueryData([`/api/user/${userId}`], normalizedUser);
      
      return normalizedUser;
    } catch (error) {
      console.error('Erro ao atualizar dados do usuário:', error);
      return null;
    }
  }, []);
  
  // Função para lidar com o login bem-sucedido
  const handleLogin = (userData: any) => {
    setUser(userData);
    setAuthState('authenticated'); // Usuário autenticado
    setLocation('/');
  };
  
  // Função para lidar com o logout
  const handleLogout = () => {
    setUser(null);
    setAuthState('login'); // Voltar para tela de login
    setLocation('/'); // Volta para a página inicial
  };
  
  // Monitorar mudanças na URL para detectar /register
  useEffect(() => {
    if (location === '/register') {
      setAuthState('register');
    } else if (location === '/login') {
      setAuthState('login');
    }
  }, [location]);
  
  // Exibe um indicador de carregamento enquanto o app inicializa
  if (user === null && authState === 'authenticated') {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-slate-600">Carregando FinançaFácil...</p>
        </div>
      </div>
    );
  }
  
  // Se não estiver autenticado, exibe tela de login ou registro
  if (authState !== 'authenticated') {
    return (
      <QueryClientProvider client={queryClient}>
        <Toaster />
        <Switch>
          <Route path="/register">
            <Register />
          </Route>
          <Route path="/">
            <Login onLogin={handleLogin} />
          </Route>
        </Switch>
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
            <Route path="/settings" component={() => 
              <Settings 
                userId={user.id} 
                user={user} 
                onUserUpdate={updateUserData}
              />
            } />
            <Route component={NotFound} />
          </Switch>
        </AppLayout>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
