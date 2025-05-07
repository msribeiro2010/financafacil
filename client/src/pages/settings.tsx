import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { AlertCircle, Upload, Download, Trash2, ArrowLeft, Save } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';
import { formatDate } from '@/lib/date';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { apiRequest } from '@/lib/queryClient';
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

export default function Settings({ userId, user: initialUser, onUserUpdate }: SettingsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAccountSettingsForm, setShowAccountSettingsForm] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  
  // Buscar dados do usuário diretamente da API para sempre ter a versão mais atualizada
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: [`/api/user/${userId}`],
    initialData: initialUser, // Usa os dados iniciais enquanto carrega
    refetchOnWindowFocus: false, // Desativamos o recarregamento automático ao receber foco
    staleTime: 30000, // Considera os dados válidos por 30 segundos
  });
  
  const { data: transactions, isLoading: transactionsLoading } = useQuery({
    queryKey: [`/api/transactions/${userId}`],
    staleTime: 30000, // Considera os dados válidos por 30 segundos
  });
  
  const { data: recurringTransactions, isLoading: recurringLoading } = useQuery({
    queryKey: [`/api/recurring/${userId}`],
    staleTime: 30000, // Considera os dados válidos por 30 segundos
  });
  
  const handleEditAccountSettings = () => {
    // Força uma atualização dos dados do usuário antes de mostrar o formulário
    // para garantir que os valores exibidos são os mais recentes
    queryClient.invalidateQueries({queryKey: [`/api/user/${userId}`]});
    queryClient.invalidateQueries({queryKey: [`/api/summary/${userId}`]});
    setShowAccountSettingsForm(true);
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
    console.log('DEBUG: Função handleResetData iniciada');
    setResetConfirmOpen(false);
    
    try {
      console.log(`Iniciando reset de dados para usuário ${userId}`);
      
      // Usa a API request do queryClient para garantir consistência
      console.log('DEBUG: Utilizando apiRequest já importado');
      
      console.log('Chamando API de reset de dados...');
      // Chama a API para redefinir os dados do usuário
      const response = await apiRequest('POST', `/api/user/${userId}/reset`, {
        initialBalance: '0.00', // Redefine o saldo inicial para zero
        overdraftLimit: '0.00'  // Redefine o limite de cheque especial para zero
      });
      
      console.log('Resposta da API:', response.status, response.ok);
      
      if (!response.ok) {
        throw new Error(`Erro ao redefinir dados: ${response.status}`);
      }
      
      const result = await response.json();
      console.log('Dados redefinidos com sucesso:', result);
      
      // Atualiza o cache com os dados do usuário redefinidos
      console.log('Atualizando cache com novos dados');
      queryClient.setQueryData([`/api/user/${userId}`], result.user);
      
      // Invalida todas as consultas para garantir atualização completa dos dados
      console.log('Invalidando consultas para atualizar dados');
      queryClient.invalidateQueries({queryKey: [`/api/transactions/${userId}`]});
      queryClient.invalidateQueries({queryKey: [`/api/recurring/${userId}`]});
      queryClient.invalidateQueries({queryKey: [`/api/summary/${userId}`]});
      queryClient.invalidateQueries({queryKey: [`/api/category-summary/${userId}`]});
      
      // Força uma atualização apenas dos dados necessários
      setTimeout(() => {
        console.log('Forçando atualização dos dados necessários');
        queryClient.invalidateQueries({queryKey: [`/api/summary/${userId}`]});
      }, 500);
      
      console.log('Exibindo toast de sucesso');
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

  // Função para renderizar o formulário de configurações da conta
  const renderAccountSettingsForm = () => {
    return (
      <Card className="mb-6">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Editar Configurações</CardTitle>
              <CardDescription>
                Atualize seus valores iniciais e limites
              </CardDescription>
            </div>
            <Button 
              variant="ghost" 
              onClick={() => setShowAccountSettingsForm(false)}
              className="h-8 w-8 p-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={async (e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const initialBalance = formData.get('initialBalance')?.toString() || '0.00';
            const overdraftLimit = formData.get('overdraftLimit')?.toString() || '0.00';
            
            try {
              console.log('Enviando requisição para atualizar configurações:', { initialBalance, overdraftLimit });
              // Envia requisição para a API
              const response = await apiRequest('PATCH', `/api/user/${userId}/settings`, {
                initialBalance,
                overdraftLimit
              });
              
              console.log('Resposta da API:', response.status, response.ok);
              
              if (response.ok) {
                // Obter a resposta da API para atualizar o cache localmente
                const result = await response.json();
                console.log('Dados recebidos da API:', result);
                
                // Atualizar o cache com os novos dados sem provocar novos pedidos à API
                queryClient.setQueryData([`/api/user/${userId}`], result);
                
                // Apenas notificar outras partes da aplicação que os dados foram alterados
                // sem forçar uma nova busca agora
                setTimeout(() => {
                  queryClient.invalidateQueries({queryKey: [`/api/summary/${userId}`]});
                }, 500);
                
                toast({
                  title: "Dados atualizados",
                  description: "As configurações da conta foram atualizadas com sucesso."
                });
                
                // Volta para a tela principal
                setShowAccountSettingsForm(false);
              } else {
                throw new Error("Falha ao atualizar configurações");
              }
            } catch (error) {
              console.error("Erro ao atualizar configurações:", error);
              toast({
                title: "Erro",
                description: "Ocorreu um erro ao atualizar as configurações.",
                variant: "destructive"
              });
            }
          }}>
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="initialBalance" className="block text-sm font-medium text-gray-700">
                  Saldo Inicial (R$)
                </label>
                <input
                  type="text"
                  id="initialBalance"
                  name="initialBalance"
                  defaultValue={parseFloat(user?.initialBalance || user?.initial_balance || '0').toFixed(2).replace('.', ',')}
                  className="px-3 py-2 border border-gray-300 rounded-md w-full"
                />
                <p className="text-xs text-gray-500">
                  Este valor será considerado como seu ponto de partida para cálculos.
                </p>
              </div>
              
              <div className="space-y-2">
                <label htmlFor="overdraftLimit" className="block text-sm font-medium text-gray-700">
                  Limite de Cheque Especial (R$)
                </label>
                <input
                  type="text"
                  id="overdraftLimit"
                  name="overdraftLimit"
                  defaultValue={parseFloat(user?.overdraftLimit || user?.overdraft_limit || '0').toFixed(2).replace('.', ',')}
                  className="px-3 py-2 border border-gray-300 rounded-md w-full"
                />
                <p className="text-xs text-gray-500">
                  Defina o valor disponível como limite de cheque especial.
                </p>
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <Button 
                  type="button"
                  variant="outline"
                  onClick={() => setShowAccountSettingsForm(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit" className="flex items-center">
                  <Save className="mr-2 h-4 w-4" />
                  Salvar
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  };

  // Função para renderizar a tela principal de configurações
  const renderMainSettings = () => {
    return (
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
                  <p className="text-xl font-medium">
                    {formatCurrency(parseFloat(user?.initialBalance || user?.initial_balance || '0'))}
                  </p>
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
                  <p className="text-xl font-medium">
                    {formatCurrency(parseFloat(user?.overdraftLimit || user?.overdraft_limit || '0'))}
                  </p>
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
                  <p className="text-xl font-medium">{transactions && Array.isArray(transactions) ? transactions.length : 0}</p>
                )}
                <p className="text-xs text-slate-500 mt-1">Total de transações registradas.</p>
              </div>
              
              <div className="p-4 border rounded-lg">
                <h4 className="text-sm font-medium text-slate-500 mb-2">Transações Recorrentes</h4>
                {recurringLoading ? (
                  <Skeleton className="h-7 w-16" />
                ) : (
                  <p className="text-xl font-medium">{recurringTransactions && Array.isArray(recurringTransactions) ? recurringTransactions.length : 0}</p>
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
    );
  };
  
  return (
    <>
      {/* Renderiza o formulário de configurações da conta ou a tela principal de configurações */}
      {showAccountSettingsForm ? renderAccountSettingsForm() : renderMainSettings()}
      
      {/* Dialog de confirmação para redefinir dados */}
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
              onClick={() => {
                console.log('Botão de confirmação clicado, chamando handleResetData...');
                handleResetData();
              }}
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
