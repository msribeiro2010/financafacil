import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Edit, WalletCards, Landmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/currency';
import { formatDate } from '@/lib/date';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';

interface AccountSetupProps {
  userId: number;
  onEdit: () => void;
}

export function AccountSetup({ userId, onEdit }: AccountSetupProps) {
  const { data: user, isLoading } = useQuery({
    queryKey: [`/api/user/${userId}`],
  });
  
  if (isLoading) {
    return (
      <Card className="mb-6">
        <CardContent className="p-5">
          <div className="flex justify-between items-center mb-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-10 w-24" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-4 w-36 mt-1" />
            </div>
            <div>
              <Skeleton className="h-4 w-44 mb-2" />
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-4 w-24 mt-1" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="mb-6">
      <CardContent className="p-5">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium">Configurações da Conta</h2>
          <Button 
            onClick={onEdit} 
            variant="ghost" 
            className="text-primary hover:text-secondary hover:bg-primary/10"
          >
            <Edit className="mr-2 h-4 w-4" /> Editar
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-medium text-slate-500 mb-2">Saldo Inicial</h3>
            <div className="flex items-center">
              <WalletCards className="text-primary mr-2 h-5 w-5" />
              <span className="text-xl font-medium">
                {formatCurrency(parseFloat(user?.initialBalance || '0'))}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Configurado em {formatDate(user?.createdAt || new Date())}
            </p>
          </div>
          <div>
            <h3 className="text-sm font-medium text-slate-500 mb-2">Limite de Cheque Especial</h3>
            <div className="flex items-center">
              <Landmark className="text-secondary mr-2 h-5 w-5" />
              <span className="text-xl font-medium">
                {formatCurrency(parseFloat(user?.overdraftLimit || '0'))}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {parseFloat(user?.overdraftLimit || '0') > 0 ? 'Disponível' : 'Não configurado'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default AccountSetup;
