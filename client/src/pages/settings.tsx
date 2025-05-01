import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, Save, Upload, Download, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';
import { formatDate } from '@/lib/date';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import AccountSettingsModal from '@/components/modals/AccountSettingsModal';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';

interface SettingsProps {
  userId: number;
  user: any;
  onUserUpdate: (userId: number) => Promise<any>;
}

export default function Settings({ userId, user, onUserUpdate }: SettingsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [accountSettingsModalOpen, setAccountSettingsModalOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  
  const { data: transactions, isLoading: transactionsLoading } = useQuery({
    queryKey: [`/api/transactions/${userId}`],
  });
  
  const { data: recurringTransactions, isLoading: recurringLoading } = useQuery({
    queryKey: [`/api/recurring/${userId}`],
  });
  
  const handleEditAccountSettings = () => {
    // Força uma atualização dos dados do usuário antes de abrir o modal
    // para garantir que os valores exibidos são os mais recentes
    queryClient.invalidateQueries({queryKey: [`/api/user/${userId}`]});
    queryClient.invalidateQueries({queryKey: [`/api/summary/${userId}`]});
    setAccountSettingsModalOpen(true);
  };
  
  const handleExportData = () => {
    if (!transactions || !recurringTransactions || !user) {
      toast({
        title: "Erro",
        description: "Não foi possível exportar os dados.",
        variant: "destructive",
      });
      return;
    }
    
    const exportData = {
      user: {
        username: user.username,
        initialBalance: user.initialBalance,
        overdraftLimit: user.overdraftLimit,
      },
      transactions,
      recurringTransactions,
    };
    
    // Create file and download
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
    
    const exportFileDefaultName = `financafacil_export_${formatDate(new Date(), 'yyyyMMdd')}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    toast({
      title: "Sucesso",
      description: "Dados exportados com sucesso.",
    });
  };
  
  const handleImportData = () => {
    const inputElement = document.createElement('input');
    inputElement.type = 'file';
    inputElement.accept = '.json';
    
    inputElement.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      
      reader.onload = (event) => {
        try {
          const importedData = JSON.parse(event.target?.result as string);
          
          if (!importedData.transactions || !importedData.recurringTransactions) {
            throw new Error("Formato de arquivo inválido");
          }
          
          // In a real app, we would process the imported data here
          toast({
            title: "Importação simulada",
            description: `Importados: ${importedData.transactions.length} transações e ${importedData.recurringTransactions.length} recorrentes`,
          });
        } catch (error) {
          toast({
            title: "Erro",
            description: "Não foi possível importar os dados. Verifique o formato do arquivo.",
            variant: "destructive",
          });
        }
      };
      
      reader.readAsText(file);
    });
    
    inputElement.click();
  };
  
  const handleResetData = async () => {
    setResetConfirmOpen(false);
    
    try {
      // Chama a API para redefinir os dados do usuário
      const response = await fetch(`/api/user/${userId}/reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          initialBalance: '0.00', // Redefine o saldo inicial para zero
          overdraftLimit: '0.00'  // Redefine o limite de cheque especial para zero
        })
      });
      
      if (!response.ok) {
        throw new Error(`Erro ao redefinir dados: ${response.status}`);
      }
      
      const result = await response.json();
      
      // Atualiza o cache com os dados do usuário redefinidos
      queryClient.setQueryData([`/api/user/${userId}`], result.user);
      
      // Invalida todas as consultas para garantir atualização completa dos dados
      queryClient.invalidateQueries({queryKey: [`/api/transactions/${userId}`]});
      queryClient.invalidateQueries({queryKey: [`/api/recurring/${userId}`]});
      queryClient.invalidateQueries({queryKey: [`/api/summary/${userId}`]});
      queryClient.invalidateQueries({queryKey: [`/api/category-summary/${userId}`]});
      
      // Atualiza os dados do usuário no contexto principal
      await onUserUpdate(userId);
      
      toast({
        title: "Dados redefinidos",
        description: "Todas as transações foram excluídas e os saldos foram zerados com sucesso.",
      });
    } catch (error) {
      console.error('Erro ao redefinir dados:', error);
      toast({
        title: "Erro",
        description: "Não foi possível redefinir os dados. Tente novamente mais tarde.",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Configurações</CardTitle>
          <CardDescription>
            Gerencie suas configurações financeiras e dados.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Account Settings */}
          <div>
            <h3 className="text-lg font-medium mb-4">Configurações da Conta</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
              <div className="p-4 border rounded-lg">
                <h4 className="text-sm font-medium text-slate-500 mb-2">Saldo Inicial</h4>
                {!user ? (
                  <Skeleton className="h-7 w-32" />
                ) : (
                  <p className="text-xl font-medium">{formatCurrency(parseFloat(user.initialBalance))}</p>
                )}
                <p className="text-xs text-slate-500 mt-1">
                  Ponto de partida para os cálculos financeiros.
                </p>
              </div>
              
              <div className="p-4 border rounded-lg">
                <h4 className="text-sm font-medium text-slate-500 mb-2">Limite de Cheque Especial</h4>
                {!user ? (
                  <Skeleton className="h-7 w-32" />
                ) : (
                  <p className="text-xl font-medium">{formatCurrency(parseFloat(user.overdraftLimit))}</p>
                )}
                <p className="text-xs text-slate-500 mt-1">
                  Valor disponível como limite de cheque especial.
                </p>
              </div>
            </div>
            
            <Button onClick={handleEditAccountSettings}>
              Editar Configurações da Conta
            </Button>
          </div>
          
          <Separator />
          
          {/* Data Stats */}
          <div>
            <h3 className="text-lg font-medium mb-4">Estatísticas de Dados</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg">
                <h4 className="text-sm font-medium text-slate-500 mb-2">Transações</h4>
                {transactionsLoading ? (
                  <Skeleton className="h-7 w-16" />
                ) : (
                  <p className="text-xl font-medium">{transactions?.length || 0}</p>
                )}
                <p className="text-xs text-slate-500 mt-1">Total de transações registradas.</p>
              </div>
              
              <div className="p-4 border rounded-lg">
                <h4 className="text-sm font-medium text-slate-500 mb-2">Transações Recorrentes</h4>
                {recurringLoading ? (
                  <Skeleton className="h-7 w-16" />
                ) : (
                  <p className="text-xl font-medium">{recurringTransactions?.length || 0}</p>
                )}
                <p className="text-xs text-slate-500 mt-1">Total de transações recorrentes.</p>
              </div>
              
              <div className="p-4 border rounded-lg">
                <h4 className="text-sm font-medium text-slate-500 mb-2">Conta criada em</h4>
                {!user ? (
                  <Skeleton className="h-7 w-32" />
                ) : (
                  <p className="text-xl font-medium">{formatDate(user.createdAt)}</p>
                )}
                <p className="text-xs text-slate-500 mt-1">Data de criação da sua conta.</p>
              </div>
            </div>
          </div>
          
          <Separator />
          
          {/* Import/Export */}
          <div>
            <h3 className="text-lg font-medium mb-4">Importar/Exportar Dados</h3>
            <div className="flex flex-wrap gap-4">
              <Button 
                variant="outline"
                onClick={handleExportData}
                className="flex items-center"
              >
                <Download className="mr-2 h-4 w-4" />
                Exportar Dados
              </Button>
              
              <Button 
                variant="outline"
                onClick={handleImportData}
                className="flex items-center"
              >
                <Upload className="mr-2 h-4 w-4" />
                Importar Dados
              </Button>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Exporte seus dados para backup ou importe-os de um arquivo JSON.
            </p>
          </div>
          
          <Separator />
          
          {/* Danger Zone */}
          <div>
            <h3 className="text-lg font-medium text-destructive mb-4">Zona de Perigo</h3>
            <div className="p-4 border border-destructive/20 rounded-lg bg-destructive/5">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-destructive mr-2 mt-0.5" />
                <div>
                  <h4 className="font-medium text-destructive">Redefinir Todos os Dados</h4>
                  <p className="text-sm text-slate-600 mb-4">
                    Esta ação excluirá permanentemente todas as suas transações e configurações.
                    Esta ação não pode ser desfeita.
                  </p>
                  
                  <Button 
                    variant="destructive"
                    onClick={() => setResetConfirmOpen(true)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Redefinir Dados
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Modals */}
      <AccountSettingsModal 
        isOpen={accountSettingsModalOpen} 
        onClose={() => {
          setAccountSettingsModalOpen(false);
          // Atualiza os dados do usuário quando o modal é fechado
          onUserUpdate(userId).then(() => {
            // Atualiza as queries relacionadas após a atualização do usuário
            queryClient.invalidateQueries({queryKey: [`/api/user/${userId}`]});
            queryClient.invalidateQueries({queryKey: [`/api/summary/${userId}`]});
            
            toast({
              title: "Dados atualizados",
              description: "As configurações da conta foram atualizadas com sucesso."
            });
          });
        }} 
        userId={userId}
        user={user}
      />
      
      <AlertDialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá excluir permanentemente todos os seus dados financeiros, incluindo transações,
              transações recorrentes e configurações. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleResetData}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sim, redefinir tudo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
