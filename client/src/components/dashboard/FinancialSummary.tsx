import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowUp, ArrowDown, Wallet, LineChart, ArrowUpCircle, ArrowDownCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';
import { Skeleton } from '@/components/ui/skeleton';

interface FinancialSummaryProps {
  userId: number;
}

export function FinancialSummary({ userId }: FinancialSummaryProps) {
  const { data: summary, isLoading } = useQuery<any>({
    queryKey: [`/api/summary/${userId}`],
    refetchInterval: 2000, // Atualiza a cada 2 segundos para garantir dados atualizados
    // Força a reexecução quando o componente é montado, importante para atualizações
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
  
  const renderSkeleton = () => (
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
  
  if (isLoading) {
    return renderSkeleton();
  }
  
  return (
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
          <div className="mt-2 flex items-center text-xs">
            <span className="text-accent flex items-center">
              <ArrowUp className="mr-1 h-3 w-3" />
              12%
            </span>
            <span className="text-slate-500 ml-2">desde o mês passado</span>
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
  );
}

export default FinancialSummary;
