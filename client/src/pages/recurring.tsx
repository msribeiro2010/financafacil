import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency } from '@/lib/currency';
import { formatDate } from '@/lib/date';
import { Pencil, Trash2, Plus, Calendar, ArrowUpCircle, ArrowDownCircle, FileText, Eye } from 'lucide-react';
import { AttachmentViewerModal } from "@/components/modals/AttachmentViewerModal";
import ExpenseModal from '@/components/modals/ExpenseModal';
import IncomeModal from '@/components/modals/IncomeModal';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
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

interface RecurringProps {
  userId: number;
}

export default function Recurring({ userId }: RecurringProps) {
  const { toast } = useToast();
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [incomeModalOpen, setIncomeModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  const [attachmentViewerOpen, setAttachmentViewerOpen] = useState(false);
  const [selectedAttachmentPath, setSelectedAttachmentPath] = useState('');
  
  // Fetch recurring transactions
  const { data: recurringTransactions, isLoading } = useQuery({
    queryKey: [`/api/recurring/${userId}`],
  });
  
  // Delete recurring transaction mutation
  const deleteRecurring = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/recurring/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/recurring/${userId}`] });
      toast({
        title: "Transação recorrente excluída",
        description: "A transação recorrente foi excluída com sucesso.",
      });
      setDeleteId(null);
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao excluir a transação recorrente.",
        variant: "destructive",
      });
      setDeleteId(null);
    }
  });
  
  const handleAddExpense = () => {
    setSelectedTransaction(null);
    setExpenseModalOpen(true);
  };
  
  const handleAddIncome = () => {
    setSelectedTransaction(null);
    setIncomeModalOpen(true);
  };
  
  // Filter recurring transactions
  const filteredTransactions = React.useMemo(() => {
    if (!recurringTransactions) return [];
    
    return recurringTransactions.filter((transaction: any) => {
      // Filter by type
      return activeTab === 'all' || transaction.type === activeTab;
    });
  }, [recurringTransactions, activeTab]);
  
  // Get frequency label
  const getFrequencyLabel = (frequency: string) => {
    switch (frequency) {
      case 'monthly':
        return 'Mensal';
      case 'bimonthly':
        return 'Bimestral';
      case 'quarterly':
        return 'Trimestral';
      case 'semiannual':
        return 'Semestral';
      case 'annual':
        return 'Anual';
      default:
        return frequency;
    }
  };
  
  // Calculate next occurrence
  const getNextOccurrence = (transaction: any) => {
    const startDate = new Date(transaction.startDate);
    const today = new Date();
    
    if (startDate > today) {
      return startDate;
    }
    
    // Calculate next occurrence based on frequency
    let nextDate = new Date(startDate);
    
    while (nextDate <= today) {
      switch (transaction.frequency) {
        case 'monthly':
          nextDate.setMonth(nextDate.getMonth() + 1);
          break;
        case 'bimonthly':
          nextDate.setMonth(nextDate.getMonth() + 2);
          break;
        case 'quarterly':
          nextDate.setMonth(nextDate.getMonth() + 3);
          break;
        case 'semiannual':
          nextDate.setMonth(nextDate.getMonth() + 6);
          break;
        case 'annual':
          nextDate.setFullYear(nextDate.getFullYear() + 1);
          break;
        default:
          return startDate;
      }
    }
    
    return nextDate;
  };
  
  // Calculate monthly impact
  const getMonthlyImpact = (transaction: any) => {
    const amount = parseFloat(transaction.amount);
    
    switch (transaction.frequency) {
      case 'monthly':
        return amount;
      case 'bimonthly':
        return amount / 2;
      case 'quarterly':
        return amount / 3;
      case 'semiannual':
        return amount / 6;
      case 'annual':
        return amount / 12;
      default:
        return amount;
    }
  };
  
  // Calculate totals
  const totals = React.useMemo(() => {
    if (!filteredTransactions) return { monthlyIncome: 0, monthlyExpense: 0, monthlyBalance: 0 };
    
    return filteredTransactions.reduce(
      (acc: any, transaction: any) => {
        const monthlyImpact = getMonthlyImpact(transaction);
        
        if (transaction.type === 'income') {
          acc.monthlyIncome += monthlyImpact;
        } else {
          acc.monthlyExpense += monthlyImpact;
        }
        
        acc.monthlyBalance = acc.monthlyIncome - acc.monthlyExpense;
        return acc;
      },
      { monthlyIncome: 0, monthlyExpense: 0, monthlyBalance: 0 }
    );
  }, [filteredTransactions]);
  
  return (
    <>
      <Card className="mb-6">
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0 pb-2">
          <CardTitle>Transações Recorrentes</CardTitle>
          <div className="flex space-x-2">
            <Button onClick={handleAddExpense} variant="outline" className="text-destructive border-destructive hover:bg-destructive/10">
              <Plus className="h-4 w-4 mr-2" />
              Despesa Recorrente
            </Button>
            <Button onClick={handleAddIncome} variant="outline" className="text-accent border-accent hover:bg-accent/10">
              <Plus className="h-4 w-4 mr-2" />
              Receita Recorrente
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-slate-500">Receitas Mensais</h3>
                  <ArrowUpCircle className="h-5 w-5 text-accent" />
                </div>
                <p className="text-2xl font-bold text-slate-800">
                  {formatCurrency(totals.monthlyIncome)}
                </p>
                <p className="text-xs text-slate-500 mt-1">Impacto mensal de todas as receitas recorrentes</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-slate-500">Despesas Mensais</h3>
                  <ArrowDownCircle className="h-5 w-5 text-destructive" />
                </div>
                <p className="text-2xl font-bold text-slate-800">
                  {formatCurrency(totals.monthlyExpense)}
                </p>
                <p className="text-xs text-slate-500 mt-1">Impacto mensal de todas as despesas recorrentes</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-slate-500">Saldo Mensal</h3>
                  <Calendar className="h-5 w-5 text-primary" />
                </div>
                <p className={`text-2xl font-bold ${totals.monthlyBalance >= 0 ? 'text-accent' : 'text-destructive'}`}>
                  {formatCurrency(totals.monthlyBalance)}
                </p>
                <p className="text-xs text-slate-500 mt-1">Impacto no saldo mensal</p>
              </CardContent>
            </Card>
          </div>
          
          <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="all">Todas</TabsTrigger>
              <TabsTrigger value="income">Receitas</TabsTrigger>
              <TabsTrigger value="expense">Despesas</TabsTrigger>
            </TabsList>
            
            <div className="text-sm text-muted-foreground mt-4 mb-2">
              {filteredTransactions?.length || 0} transações recorrentes encontradas
            </div>
            
            <TabsContent value="all" className="mt-0">
              <div className="rounded-md border">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-slate-50">
                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Descrição</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Categoria</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Frequência</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Próxima</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">Valor</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">Impacto Mensal</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading ? (
                        Array.from({ length: 5 }).map((_, index) => (
                          <tr key={index} className="border-b">
                            <td className="py-3 px-4"><Skeleton className="h-6 w-40" /></td>
                            <td className="py-3 px-4"><Skeleton className="h-6 w-24" /></td>
                            <td className="py-3 px-4"><Skeleton className="h-6 w-24" /></td>
                            <td className="py-3 px-4"><Skeleton className="h-6 w-24" /></td>
                            <td className="py-3 px-4 text-right"><Skeleton className="h-6 w-20 ml-auto" /></td>
                            <td className="py-3 px-4 text-right"><Skeleton className="h-6 w-20 ml-auto" /></td>
                            <td className="py-3 px-4 text-right"><Skeleton className="h-6 w-16 ml-auto" /></td>
                          </tr>
                        ))
                      ) : filteredTransactions?.length > 0 ? (
                        filteredTransactions.map((transaction: any) => {
                          const nextOccurrence = getNextOccurrence(transaction);
                          const monthlyImpact = getMonthlyImpact(transaction);
                          
                          return (
                            <tr key={transaction.id} className="border-b hover:bg-slate-50">
                              <td className="py-3 px-4">
                                <div className="flex items-center">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-3 ${
                                    transaction.type === 'expense' ? 'bg-red-100' : 'bg-green-100'
                                  }`}>
                                    <i className={`${transaction.category?.icon || 'ri-question-line'} ${
                                      transaction.type === 'expense' ? 'text-destructive' : 'text-accent'
                                    }`}></i>
                                  </div>
                                  <span>{transaction.description}</span>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-slate-600">
                                {transaction.category?.name || 'Sem categoria'}
                              </td>
                              <td className="py-3 px-4">
                                <Badge variant="outline">
                                  {getFrequencyLabel(transaction.frequency)}
                                </Badge>
                              </td>
                              <td className="py-3 px-4">
                                {formatDate(nextOccurrence)}
                              </td>
                              <td className="py-3 px-4 text-right font-medium">
                                <span className={transaction.type === 'expense' ? 'text-destructive' : 'text-accent'}>
                                  {transaction.type === 'expense' ? '- ' : '+ '}
                                  {formatCurrency(parseFloat(transaction.amount))}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right font-medium">
                                <span className={transaction.type === 'expense' ? 'text-destructive' : 'text-accent'}>
                                  {transaction.type === 'expense' ? '- ' : '+ '}
                                  {formatCurrency(monthlyImpact)}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right">
                                {transaction.attachment && (
                                  <a 
                                    href={`/${transaction.attachment}`} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-xs font-medium text-blue-600 hover:bg-blue-50 mr-1"
                                    title="Visualizar anexo/boleto"
                                  >
                                    <FileText className="h-4 w-4" />
                                  </a>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                                  onClick={() => setDeleteId(transaction.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-muted-foreground">
                            Nenhuma transação recorrente encontrada
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="income" className="mt-0">
              <div className="rounded-md border">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-slate-50">
                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Descrição</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Categoria</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Frequência</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Próxima</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">Valor</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">Impacto Mensal</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading ? (
                        Array.from({ length: 3 }).map((_, index) => (
                          <tr key={index} className="border-b">
                            <td className="py-3 px-4"><Skeleton className="h-6 w-40" /></td>
                            <td className="py-3 px-4"><Skeleton className="h-6 w-24" /></td>
                            <td className="py-3 px-4"><Skeleton className="h-6 w-24" /></td>
                            <td className="py-3 px-4"><Skeleton className="h-6 w-24" /></td>
                            <td className="py-3 px-4 text-right"><Skeleton className="h-6 w-20 ml-auto" /></td>
                            <td className="py-3 px-4 text-right"><Skeleton className="h-6 w-20 ml-auto" /></td>
                            <td className="py-3 px-4 text-right"><Skeleton className="h-6 w-16 ml-auto" /></td>
                          </tr>
                        ))
                      ) : filteredTransactions?.filter((t: any) => t.type === 'income').length > 0 ? (
                        filteredTransactions
                          .filter((t: any) => t.type === 'income')
                          .map((transaction: any) => {
                            const nextOccurrence = getNextOccurrence(transaction);
                            const monthlyImpact = getMonthlyImpact(transaction);
                            
                            return (
                              <tr key={transaction.id} className="border-b hover:bg-slate-50">
                                <td className="py-3 px-4">
                                  <div className="flex items-center">
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center mr-3 bg-green-100">
                                      <i className={`${transaction.category?.icon || 'ri-question-line'} text-accent`}></i>
                                    </div>
                                    <span>{transaction.description}</span>
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-slate-600">
                                  {transaction.category?.name || 'Sem categoria'}
                                </td>
                                <td className="py-3 px-4">
                                  <Badge variant="outline">
                                    {getFrequencyLabel(transaction.frequency)}
                                  </Badge>
                                </td>
                                <td className="py-3 px-4">
                                  {formatDate(nextOccurrence)}
                                </td>
                                <td className="py-3 px-4 text-right font-medium text-accent">
                                  + {formatCurrency(parseFloat(transaction.amount))}
                                </td>
                                <td className="py-3 px-4 text-right font-medium text-accent">
                                  + {formatCurrency(monthlyImpact)}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                                    onClick={() => setDeleteId(transaction.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </td>
                              </tr>
                            );
                          })
                      ) : (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-muted-foreground">
                            Nenhuma receita recorrente encontrada
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="expense" className="mt-0">
              <div className="rounded-md border">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-slate-50">
                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Descrição</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Categoria</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Frequência</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Próxima</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">Valor</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">Impacto Mensal</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {isLoading ? (
                        Array.from({ length: 3 }).map((_, index) => (
                          <tr key={index} className="border-b">
                            <td className="py-3 px-4"><Skeleton className="h-6 w-40" /></td>
                            <td className="py-3 px-4"><Skeleton className="h-6 w-24" /></td>
                            <td className="py-3 px-4"><Skeleton className="h-6 w-24" /></td>
                            <td className="py-3 px-4"><Skeleton className="h-6 w-24" /></td>
                            <td className="py-3 px-4 text-right"><Skeleton className="h-6 w-20 ml-auto" /></td>
                            <td className="py-3 px-4 text-right"><Skeleton className="h-6 w-20 ml-auto" /></td>
                            <td className="py-3 px-4 text-right"><Skeleton className="h-6 w-16 ml-auto" /></td>
                          </tr>
                        ))
                      ) : filteredTransactions?.filter((t: any) => t.type === 'expense').length > 0 ? (
                        filteredTransactions
                          .filter((t: any) => t.type === 'expense')
                          .map((transaction: any) => {
                            const nextOccurrence = getNextOccurrence(transaction);
                            const monthlyImpact = getMonthlyImpact(transaction);
                            
                            return (
                              <tr key={transaction.id} className="border-b hover:bg-slate-50">
                                <td className="py-3 px-4">
                                  <div className="flex items-center">
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center mr-3 bg-red-100">
                                      <i className={`${transaction.category?.icon || 'ri-question-line'} text-destructive`}></i>
                                    </div>
                                    <span>{transaction.description}</span>
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-slate-600">
                                  {transaction.category?.name || 'Sem categoria'}
                                </td>
                                <td className="py-3 px-4">
                                  <Badge variant="outline">
                                    {getFrequencyLabel(transaction.frequency)}
                                  </Badge>
                                </td>
                                <td className="py-3 px-4">
                                  {formatDate(nextOccurrence)}
                                </td>
                                <td className="py-3 px-4 text-right font-medium text-destructive">
                                  - {formatCurrency(parseFloat(transaction.amount))}
                                </td>
                                <td className="py-3 px-4 text-right font-medium text-destructive">
                                  - {formatCurrency(monthlyImpact)}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                                    onClick={() => setDeleteId(transaction.id)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </td>
                              </tr>
                            );
                          })
                      ) : (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-muted-foreground">
                            Nenhuma despesa recorrente encontrada
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      
      {/* Modals */}
      <ExpenseModal 
        isOpen={expenseModalOpen} 
        onClose={() => setExpenseModalOpen(false)} 
        userId={userId}
        transaction={null}
      />
      
      <IncomeModal 
        isOpen={incomeModalOpen} 
        onClose={() => setIncomeModalOpen(false)} 
        userId={userId}
        transaction={null}
      />
      
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta transação recorrente? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteRecurring.mutate(deleteId)}
            >
              {deleteRecurring.isPending ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
