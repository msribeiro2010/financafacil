import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useQuery, useMutation } from '@tanstack/react-query';
import { formatCurrency } from '@/lib/currency';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Pencil, Trash2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { queryClient } from '@/lib/queryClient';
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

interface UpcomingBillsProps {
  userId: number;
  onEditTransaction: (transaction: any) => void;
}

export function UpcomingBills({ userId, onEditTransaction }: UpcomingBillsProps) {
  const { toast } = useToast();
  const [deleteId, setDeleteId] = React.useState<number | null>(null);
  
  const { data: upcomingBills, isLoading } = useQuery({
    queryKey: [`/api/upcoming/${userId}`],
  });
  
  const deleteTransaction = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/transactions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/upcoming/${userId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/transactions/${userId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/summary/${userId}`] });
      toast({
        title: "Transação excluída",
        description: "A transação foi excluída com sucesso.",
      });
      setDeleteId(null);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao excluir a transação.",
        variant: "destructive",
      });
      setDeleteId(null);
    }
  });
  
  const getDueDateLabel = (date: string, status: string) => {
    // Se já está paga, mostramos essa informação independente da data
    if (status === 'paga') {
      return {
        label: "Paga",
        className: "bg-green-100 text-green-800"
      };
    }
    
    const dueDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    // Verifica se está atrasada
    if (status === 'atrasada') {
      return {
        label: "Atrasada",
        className: "bg-red-500 text-white"
      };
    }
    
    if (diffDays === 0) {
      return {
        label: "Vence hoje",
        className: "bg-red-100 text-red-800 font-bold"
      };
    } else if (diffDays === 1) {
      return {
        label: "Vence amanhã",
        className: "bg-amber-100 text-amber-800 font-bold"
      };
    } else if (diffDays > 1 && diffDays <= 3) {
      return {
        label: `Em ${diffDays} dias`,
        className: "bg-amber-100 text-amber-800"
      };
    } else if (diffDays < 0) {
      // Para contas com data passada mas que não foram marcadas como atrasadas no banco
      return {
        label: `Atrasada ${Math.abs(diffDays)} dias`,
        className: "bg-red-500 text-white"
      };
    } else {
      return {
        label: `Em ${diffDays} dias`,
        className: "bg-slate-100 text-slate-800"
      };
    }
  };
  
  return (
    <>
      <Card className="mt-6">
        <CardContent className="p-5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium">Contas a Vencer</h2>
            <Link href="/transactions" className="text-sm text-primary hover:underline">
              Ver todas
            </Link>
          </div>
          
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="py-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto"></div>
                <p className="mt-2 text-slate-500">Carregando...</p>
              </div>
            ) : upcomingBills && upcomingBills.length > 0 ? (
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Descrição</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Categoria</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Vencimento</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Status</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">Valor</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingBills.map((bill: any) => {
                    const dueDate = getDueDateLabel(bill.date, bill.status);
                    
                    return (
                      <tr key={bill.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-3 px-4">
                          <div className="flex items-center">
                            <i className={`${bill.category?.icon || 'ri-question-line'} text-primary mr-2`}></i>
                            <span>{bill.description}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {bill.category?.name || 'Sem categoria'}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-0.5 ${dueDate.className} rounded-full text-xs`}>
                            {dueDate.label}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <Button
                            variant={bill.status === 'paga' ? 'outline' : 'default'}
                            size="sm"
                            className={`text-xs ${
                              bill.status === 'paga' 
                                ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200' 
                                : bill.status === 'atrasada'
                                  ? 'bg-red-500 text-white hover:bg-red-600'
                                  : 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200'
                            }`}
                            onClick={() => {
                              console.log(`Alterando status da conta ID ${bill.id} de "${bill.status}" para "${bill.status === 'paga' ? 'a_pagar' : 'paga'}"`);
                              const newStatus = bill.status === 'paga' ? 'a_pagar' : 'paga';
                              
                              // Mostrar alerta de confirmação se estiver desmarcando como paga
                              if (bill.status === 'paga' && !window.confirm('Tem certeza que deseja desmarcar esta conta como não paga?')) {
                                return;
                              }
                              
                              // Create FormData object for compatibility with the API
                              const formData = new FormData();
                              formData.append('status', newStatus);
                              
                              apiRequest('PATCH', `/api/transactions/${bill.id}`, formData)
                                .then(() => {
                                  console.log('Status atualizado com sucesso');
                                  queryClient.invalidateQueries({ queryKey: [`/api/upcoming/${userId}`] });
                                  queryClient.invalidateQueries({ queryKey: [`/api/transactions/${userId}`] });
                                  queryClient.invalidateQueries({ queryKey: [`/api/summary/${userId}`] });
                                  toast({
                                    title: `Conta ${newStatus === 'paga' ? 'paga' : 'a pagar'}`,
                                    description: `${bill.description} foi ${newStatus === 'paga' ? 'marcada como paga' : 'desmarcada'}`,
                                    variant: newStatus === 'paga' ? 'default' : 'destructive',
                                  });
                                })
                                .catch((error) => {
                                  console.error('Erro ao atualizar status:', error);
                                  toast({
                                    title: "Erro",
                                    description: "Não foi possível atualizar o status.",
                                    variant: "destructive",
                                  });
                                });
                            }}
                          >
                            {bill.status === 'paga' ? '✓ Paga' : bill.status === 'atrasada' ? '⚠️ Atrasada' : '💰 Pagar'}
                          </Button>
                        </td>
                        <td className="py-3 px-4 text-right font-medium">
                          <span className={bill.status === 'paga' ? 'text-slate-400 line-through' : 'text-destructive font-bold'}>
                            {formatCurrency(parseFloat(bill.amount))}
                          </span>
                          {bill.status === 'paga' && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              Pago
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-primary hover:text-secondary hover:bg-primary/10 mr-1"
                            onClick={() => onEditTransaction(bill)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                            onClick={() => setDeleteId(bill.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="py-8 text-center">
                <AlertCircle className="h-10 w-10 text-slate-400 mx-auto mb-2" />
                <p className="text-slate-600">Nenhuma conta a vencer nos próximos dias.</p>
                <p className="text-sm text-slate-500 mt-1">Você está em dia com seus pagamentos!</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta transação? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteTransaction.mutate(deleteId)}
            >
              {deleteTransaction.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default UpcomingBills;
