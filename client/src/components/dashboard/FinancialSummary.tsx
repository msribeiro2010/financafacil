import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowUp, ArrowDown, Wallet, LineChart, ArrowUpCircle, ArrowDownCircle, RefreshCw, Settings } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface FinancialSummaryProps {
  userId: number;
}

export default function FinancialSummary({ userId }: FinancialSummaryProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: summary, isLoading } = useQuery<any>({
    queryKey: [`/api/summary/${userId}`],
    // Configurações ajustadas para atualização mais rápida
    refetchInterval: 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 0, // Considera os dados sempre obsoletos para garantir atualizações
  });
  
  const { data: user } = useQuery<any>({
    queryKey: [`/api/user/${userId}`],
    // Configurações ajustadas para atualização mais rápida
    refetchInterval: 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 0, // Considera os dados sempre obsoletos para garantir atualizações
  });
  
  // Atualizar configurações do usuário
  const updateUserSettings = useMutation({
    mutationFn: async (data: { initialBalance: string, overdraftLimit: string }) => {
      return apiRequest('PATCH', `/api/user/${userId}/settings`, data);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      toast({
        title: 'Saldo atualizado',
        description: 'As configurações foram atualizadas com sucesso.',
      });
    },
    onError: (error) => {
      console.error('Erro ao atualizar:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar as configurações.',
        variant: 'destructive',
      });
    }
  });
  
  // Redefinir todas as transações e zerar a conta
  const resetAllTransactions = useMutation({
    mutationFn: async () => {
      return apiRequest('DELETE', `/api/account/reset/${userId}`);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries();
      toast({
        title: 'Conta redefinida',
        description: 'Todas as transações foram apagadas e saldo zerado.',
      });
    },
    onError: (error) => {
      console.error('Erro ao redefinir conta:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível redefinir a conta.',
        variant: 'destructive',
      });
    }
  });
  
  // Limpar apenas as transações recorrentes
  const clearRecurringTransactions = useMutation({
    mutationFn: async () => {
      return apiRequest('DELETE', `/api/recurring/clear/${userId}`);
    },
    onSuccess: async () => {
      queryClient.invalidateQueries();
      toast({
        title: 'Transações recorrentes removidas',
        description: 'Todas as transações recorrentes foram removidas com sucesso.',
      });
    },
    onError: (error) => {
      console.error('Erro ao limpar transações recorrentes:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível remover as transações recorrentes.',
        variant: 'destructive',
      });
    }
  });
  
  // Função para validar e formatar valores monetários com tratamento mais rigoroso
  const formatMonetaryValue = (value: string | number | null | undefined): string => {
    // Garante que temos uma string para trabalhar
    if (value === null || value === undefined) {
      return '0.00';
    }
    
    // Converte para string se for número
    const strValue = typeof value === 'number' ? value.toString() : value;
    
    // Substitui vírgula por ponto
    let formatted = strValue.replace(',', '.');
    
    // Remove caracteres não numéricos exceto o ponto decimal
    formatted = formatted.replace(/[^\d.]/g, '');
    
    // Verificar se é um número válido
    const numValue = parseFloat(formatted);
    if (isNaN(numValue)) {
      return '0.00';
    }
    
    // Garante que o valor tenha duas casas decimais
    return numValue.toFixed(2);
  };
  
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-5 rounded-full" />
              </div>
              <Skeleton className="h-8 w-32 mb-2" />
              <Skeleton className="h-3 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }
  
  return (
    <React.Fragment>
      <div className="flex justify-end mb-4">
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            size="sm"
            title="Limpar transações recorrentes"
            onClick={() => {
              if (window.confirm('Tem certeza que deseja excluir todas as transações recorrentes? Esta ação não pode ser desfeita.')) {
                clearRecurringTransactions.mutate();
              }
            }}
            disabled={clearRecurringTransactions.isPending}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Limpar Recorrentes
          </Button>
          <Button 
            variant="destructive" 
            size="sm"
            title="Redefinir conta completamente"
            onClick={() => {
              if (window.confirm('Atenção! Essa ação vai excluir TODAS as transações e zerar seu saldo. Esta ação não pode ser desfeita. Continuar?')) {
                resetAllTransactions.mutate();
              }
            }}
            disabled={resetAllTransactions.isPending}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Redefinir Conta
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-slate-500">Saldo Atual</h3>
              <Wallet className="h-5 w-5 text-primary" />
            </div>
            <p className="text-2xl font-bold text-slate-800">
              {formatCurrency(summary?.currentBalance || 0)}
            </p>
            <div className="mt-2 flex justify-between items-center">
              <div className="flex items-center text-xs">
                <span className="text-accent flex items-center">
                  <ArrowUp className="mr-1 h-3 w-3" />
                  12%
                </span>
                <span className="text-slate-500 ml-2">desde o mês passado</span>
              </div>
              <div className="flex space-x-1">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-7 px-2" 
                  title="Editar configurações da conta"
                  onClick={() => {
                    // Obter o valor atual para exibir como padrão no prompt
                    const currentInitialBalance = user?.initialBalance || user?.initial_balance || '0';
                    const currentOverdraftLimit = user?.overdraftLimit || user?.overdraft_limit || '0';
                    
                    // Prompt para o usuário inserir o saldo inicial (mostrando o valor atual)
                    const initialBalance = prompt(`Informe o saldo inicial (atual: R$ ${currentInitialBalance}):`);
                    if (initialBalance !== null) {
                      // Prompt para o usuário inserir o limite de cheque especial (mostrando o valor atual)
                      const overdraftLimit = prompt(`Informe o limite de cheque especial (atual: R$ ${currentOverdraftLimit}):`);
                      if (overdraftLimit !== null) {
                        // Preparar os dados de atualização - usa os valores existentes se o usuário deixou em branco
                        const updateData = {
                          initialBalance: initialBalance.trim() === '' ? currentInitialBalance : formatMonetaryValue(initialBalance),
                          overdraftLimit: overdraftLimit.trim() === '' ? currentOverdraftLimit : formatMonetaryValue(overdraftLimit)
                        };
                        
                        console.log('Enviando atualização de configurações:', updateData);
                        
                        // Atualiza as configurações com os valores informados pelo usuário
                        updateUserSettings.mutate(updateData, {
                          onSuccess: (response) => {
                            // Força a releitura dos dados do usuário e do resumo
                            setTimeout(async () => {
                              try {
                                // Fornece informações mais detalhadas para debug
                                const updatedUserData = await response.json();
                                console.log('Dados atualizados do usuário:', updatedUserData);
                                
                                // Atualiza imediatamente o cache com os novos valores
                                const initialBalance = updatedUserData.initial_balance || updatedUserData.initialBalance;
                                const overdraftLimit = updatedUserData.overdraft_limit || updatedUserData.overdraftLimit;
                                
                                // Normaliza os dados para garantir compatibilidade
                                const normalizedUser = {
                                  ...updatedUserData,
                                  initialBalance,
                                  overdraftLimit,
                                  initial_balance: initialBalance,
                                  overdraft_limit: overdraftLimit,
                                };
                                
                                // Atualiza o cache do usuário
                                queryClient.setQueryData([`/api/user/${userId}`], normalizedUser);
                                
                                // Atualiza o resumo financeiro
                                const summary = queryClient.getQueryData([`/api/summary/${userId}`]);
                                if (summary) {
                                  const updatedSummary = {
                                    ...summary,
                                    currentBalance: parseFloat(initialBalance),
                                  };
                                  queryClient.setQueryData([`/api/summary/${userId}`], updatedSummary);
                                }
                                
                                // Força uma completa revalidação
                                queryClient.invalidateQueries();
                              } catch (error) {
                                console.error('Erro ao processar resposta de atualização:', error);
                                // Força uma completa revalidação em caso de erro
                                queryClient.invalidateQueries();
                              }
                            }, 200);
                          }
                        });
                      }
                    }
                  }}
                  disabled={updateUserSettings.isPending}
                >
                  <Settings className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-slate-500">Receitas do Mês</h3>
              <ArrowUpCircle className="h-5 w-5 text-accent" />
            </div>
            <p className="text-2xl font-bold text-slate-800">
              {formatCurrency(summary?.totalIncome || 0)}
            </p>
            <div className="flex justify-between mt-2 text-xs text-slate-500">
              <span>Meta: R$ 4.000,00</span>
              <span>
                {Math.min(Math.round((summary?.totalIncome || 0) / 4000 * 100), 100)}%
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-1 mt-1">
              <div 
                className="bg-accent h-1 rounded-full" 
                style={{ width: `${Math.min(Math.round((summary?.totalIncome || 0) / 4000 * 100), 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-slate-500">Despesas do Mês</h3>
              <ArrowDownCircle className="h-5 w-5 text-destructive" />
            </div>
            <p className="text-2xl font-bold text-slate-800">
              {formatCurrency(summary?.totalExpenses || 0)}
            </p>
            <div className="flex justify-between mt-2 text-xs text-slate-500">
              <span>Limite: R$ 2.000,00</span>
              <span>
                {Math.min(Math.round((summary?.totalExpenses || 0) / 2000 * 100), 100)}%
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-1 mt-1">
              <div 
                className="bg-destructive h-1 rounded-full" 
                style={{ width: `${Math.min(Math.round((summary?.totalExpenses || 0) / 2000 * 100), 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-slate-500">Previsão Final do Mês</h3>
              <LineChart className="h-5 w-5 text-secondary" />
            </div>
            <p className="text-2xl font-bold text-slate-800">
              {formatCurrency(summary?.projectedBalance || 0)}
            </p>
            <div className="mt-2 flex items-center text-xs">
              {summary?.projectedBalance > summary?.currentBalance ? (
                <span className="text-accent flex items-center">
                  <ArrowUp className="mr-1 h-3 w-3" />
                  {formatCurrency(summary?.projectedBalance - summary?.currentBalance)}
                </span>
              ) : (
                <span className="text-destructive flex items-center">
                  <ArrowDown className="mr-1 h-3 w-3" />
                  {formatCurrency(summary?.currentBalance - summary?.projectedBalance)}
                </span>
              )}
              <span className="text-slate-500 ml-2">em relação ao atual</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </React.Fragment>
  );
}
