import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { formatCurrency } from '@/lib/currency';
import { formatDate } from '@/lib/date';
import { Skeleton } from '@/components/ui/skeleton';

interface RecentTransactionsProps {
  userId: number;
}

export function RecentTransactions({ userId }: RecentTransactionsProps) {
  const { data: transactions, isLoading } = useQuery({
    queryKey: [`/api/transactions/${userId}?limit=4`],
  });
  
  const renderSkeleton = () => (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="flex items-center justify-between p-3">
          <div className="flex items-center">
            <Skeleton className="w-10 h-10 rounded-full mr-3" />
            <div>
              <Skeleton className="h-5 w-32 mb-1" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
          <Skeleton className="h-5 w-24" />
        </div>
      ))}
    </div>
  );
  
  return (
    <Card className="lg:col-span-2">
      <CardContent className="p-5">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium">Transações Recentes</h2>
          <Link href="/transactions" className="text-sm text-primary hover:underline">
            Ver todas
          </Link>
        </div>
        
        {isLoading ? (
          renderSkeleton()
        ) : (
          <div className="space-y-3">
            {transactions && transactions.length > 0 ? (
              transactions.map((transaction: any) => (
                <div key={transaction.id} className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-lg transition-colors">
                  <div className="flex items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 ${
                      transaction.type === 'expense' ? 'bg-red-100' : 'bg-green-100'
                    }`}>
                      <i className={`${transaction.category?.icon || 'ri-question-line'} ${
                        transaction.type === 'expense' ? 'text-destructive' : 'text-accent'
                      }`}></i>
                    </div>
                    <div>
                      <h3 className="font-medium">{transaction.description}</h3>
                      <p className="text-xs text-slate-500">
                        {formatDate(transaction.date)} • {transaction.category?.name || 'Sem categoria'}
                      </p>
                    </div>
                  </div>
                  <span className={`font-medium ${
                    transaction.type === 'expense' ? 'text-destructive' : 'text-accent'
                  }`}>
                    {transaction.type === 'expense' ? '- ' : '+ '}
                    {formatCurrency(parseFloat(transaction.amount))}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-slate-500">
                <p>Nenhuma transação registrada</p>
                <p className="text-sm mt-1">Adicione suas primeiras receitas e despesas!</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default RecentTransactions;
