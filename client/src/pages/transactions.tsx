import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency } from '@/lib/currency';
import { formatDate } from '@/lib/date';
import { Pencil, Trash2, Plus, Search, ArrowUpDown, Filter, CalendarIcon, FileText, ExternalLink, Eye } from 'lucide-react';
import { AttachmentViewerModal } from '@/components/modals/AttachmentViewerModal';
import ExpenseModal from '@/components/modals/ExpenseModal';
import IncomeModal from '@/components/modals/IncomeModal';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TransactionsProps {
  userId: number;
}

export default function Transactions({ userId }: TransactionsProps) {
  const { toast } = useToast();
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [incomeModalOpen, setIncomeModalOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [dateFilter, setDateFilter] = useState<{start?: Date, end?: Date}>({
    start: startOfMonth(new Date()),
    end: endOfMonth(new Date())
  });
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [attachmentViewerOpen, setAttachmentViewerOpen] = useState(false);
  const [selectedAttachmentPath, setSelectedAttachmentPath] = useState('');

  // Fetch transactions
  const { data: transactions, isLoading, isError, error, refetch } = useQuery({
    queryKey: [`/api/transactions/${userId}`],
    onSuccess: (data) => {
      console.log(`[APP] Transações carregadas com sucesso:`, data?.length || 0, 'transações encontradas');
    },
    onError: (err) => {
      console.error(`[APP] Erro ao carregar transações:`, err);
      toast({
        title: "Erro ao carregar transações",
        description: String(err?.message || "Verifique sua conexão com o servidor"),
        variant: "destructive",
      });
    },
    // Recarregar transações a cada 30 segundos
    refetchInterval: 30000,
    retry: 3,
    retryDelay: 1000
  });

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ['/api/categories'],
    onSuccess: (data) => {
      console.log(`[APP] Categorias carregadas com sucesso:`, data);
    }
  });

  // Se há erro, mostrar na UI
  React.useEffect(() => {
    if (isError) {
      toast({
        title: "Erro ao carregar transações",
        description: String(error || "Verifique sua conexão com o servidor"),
        variant: "destructive",
      });
    }
  }, [isError, error, toast]);

  // Delete transaction mutation
  const deleteTransaction = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/transactions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/transactions/${userId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/summary/${userId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/upcoming/${userId}`] });
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

  const handleEditTransaction = (transaction: any) => {
    // Criar uma cópia do objeto transaction para evitar mutação
    const transactionCopy = {...transaction};

    // Garantir que o amount seja uma string para o formulário
    if (typeof transactionCopy.amount === 'number') {
      transactionCopy.amount = transactionCopy.amount.toString();
    }

    // Converter categoryId para string
    if (transactionCopy.categoryId && typeof transactionCopy.categoryId === 'number') {
      transactionCopy.categoryId = transactionCopy.categoryId.toString();
    }

    setSelectedTransaction(transactionCopy);

    if (transaction.type === 'expense') {
      setExpenseModalOpen(true);
    } else {
      setIncomeModalOpen(true);
    }
  };

  const handleAddExpense = () => {
    setSelectedTransaction(null);
    setExpenseModalOpen(true);
  };

  const handleAddIncome = () => {
    setSelectedTransaction(null);
    setIncomeModalOpen(true);
  };

  // Filter and sort transactions
  const filteredTransactions = React.useMemo(() => {
    if (!transactions) return [];

    return transactions
      .filter((transaction: any) => {
        // Filter by search term
        const matchesSearch = searchTerm === '' || 
          transaction.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (transaction.category?.name || '').toLowerCase().includes(searchTerm.toLowerCase());

        // Filter by type
        const matchesType = activeTab === 'all' || transaction.type === activeTab;

        // Filter by date
        const transactionDate = parseISO(transaction.date);
        const matchesDate = (!dateFilter.start || transactionDate >= dateFilter.start) && 
                           (!dateFilter.end || transactionDate <= dateFilter.end);

        // Filter by category
        const matchesCategory = categoryFilter === 'all' || 
                              (transaction.categoryId?.toString() === categoryFilter);

        return matchesSearch && matchesType && matchesDate && matchesCategory;
      })
      .sort((a: any, b: any) => {
        // Sort by date
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();

        return sortDirection === 'desc' ? dateB - dateA : dateA - dateB;
      });
  }, [transactions, searchTerm, activeTab, sortDirection, dateFilter, categoryFilter]);

  // Calculate totals
  const totals = React.useMemo(() => {
    if (!filteredTransactions) return { income: 0, expense: 0, balance: 0 };

    return filteredTransactions.reduce(
      (acc: any, transaction: any) => {
        const amount = parseFloat(transaction.amount);
        if (transaction.type === 'income') {
          acc.income += amount;
        } else {
          acc.expense += amount;
        }
        acc.balance = acc.income - acc.expense;
        return acc;
      },
      { income: 0, expense: 0, balance: 0 }
    );
  }, [filteredTransactions]);

  return (
    <>
      <Card className="mb-6">
        <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0 pb-2">
          <CardTitle>Transações</CardTitle>
          <div className="flex space-x-2">
            <Button 
              onClick={() => {
                console.log("[APP] Recarregando dados de transações...");
                queryClient.invalidateQueries({ queryKey: [`/api/transactions/${userId}`] });
                toast({
                  title: "Dados recarregados",
                  description: "As transações foram atualizadas.",
                });
              }} 
              variant="outline"
              className="mr-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 mr-2"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
              Atualizar
            </Button>
            <Button onClick={handleAddExpense} variant="outline" className="text-destructive border-destructive hover:bg-destructive/10">
              <Plus className="h-4 w-4 mr-2" />
              Despesa
            </Button>
            <Button onClick={handleAddIncome} variant="outline" className="text-accent border-accent hover:bg-accent/10">
              <Plus className="h-4 w-4 mr-2" />
              Receita
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex-1 min-w-[260px]">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar transações..."
                  className="pl-8"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="flex space-x-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="flex items-center">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    <span>
                      {dateFilter.start ? format(dateFilter.start, 'dd/MM/yyyy') : 'Início'} - 
                      {dateFilter.end ? format(dateFilter.end, 'dd/MM/yyyy') : 'Fim'}
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={{
                      from: dateFilter.start,
                      to: dateFilter.end
                    }}
                    onSelect={(range) => setDateFilter({
                      start: range?.from,
                      end: range?.to
                    })}
                    locale={ptBR}
                    className="rounded-md border"
                    initialFocus
                  />
                  <div className="p-3 border-t flex justify-between">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setDateFilter({
                        start: startOfMonth(new Date()),
                        end: endOfMonth(new Date())
                      })}
                    >
                      Mês Atual
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setDateFilter({})}
                    >
                      Limpar
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as categorias</SelectItem>
                  {categories?.map((category: any) => (
                    <SelectItem key={category.id} value={category.id.toString()}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="icon"
                onClick={() => setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc')}
                title="Ordenar por data"
              >
                <ArrowUpDown className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="all">Todas</TabsTrigger>
              <TabsTrigger value="income">Receitas</TabsTrigger>
              <TabsTrigger value="expense">Despesas</TabsTrigger>
            </TabsList>

            <div className="flex justify-between mt-4 mb-2">
              <div className="text-sm text-muted-foreground">
                {filteredTransactions.length} transações encontradas
              </div>
              <div className="flex space-x-4 text-sm">
                <div>Receitas: <span className="font-medium text-accent">{formatCurrency(totals.income)}</span></div>
                <div>Despesas: <span className="font-medium text-destructive">{formatCurrency(totals.expense)}</span></div>
                <div>Saldo: <span className={`font-medium ${totals.balance >= 0 ? 'text-accent' : 'text-destructive'}`}>
                  {formatCurrency(totals.balance)}
                </span></div>
              </div>
            </div>

            <TabsContent value="all" className="mt-0">
              <div className="rounded-md border">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-slate-50">
                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Descrição</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Categoria</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Data</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Status</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">Valor</th>
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
                            <td className="py-3 px-4 text-right"><Skeleton className="h-6 w-20 ml-auto" /></td>
                            <td className="py-3 px-4 text-right"><Skeleton className="h-6 w-16 ml-auto" /></td>
                          </tr>
                        ))
                      ) : filteredTransactions.length > 0 ? (
                        filteredTransactions.map((transaction: any) => (
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
                              {formatDate(transaction.date)}
                            </td>
                            <td className="py-3 px-4">
                              {transaction.type === 'expense' && (
                                <Button
                                  variant={transaction.status === 'paga' ? 'outline' : 'default'}
                                  size="sm"
                                  className={`text-xs ${
                                    transaction.status === 'paga' 
                                      ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200' 
                                      : transaction.status === 'atrasada'
                                        ? 'bg-red-500 text-white hover:bg-red-600'
                                        : 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200'
                                  }`}
                                  onClick={() => {
                                    const newStatus = transaction.status === 'paga' ? 'a_pagar' : 'paga';

                                    // Mostrar alerta de confirmação se estiver desmarcando como paga
                                    if (transaction.status === 'paga') {
                                      if (!window.confirm(`Tem certeza que deseja desmarcar "${transaction.description}" como não paga?`)) {
                                        return;
                                      }
                                    }

                                    console.log(`Atualizando status da transação ${transaction.id} para ${newStatus}`);

                                    // Create FormData object for compatibility with the API
                                    const formData = new FormData();
                                    formData.append('status', newStatus);
                                    console.log("FormData criado com status:", newStatus);

                                    console.log(`Enviando requisição para atualizar status da transação ${transaction.id} para ${newStatus}`);
                                    
                                    // Verificar se o FormData está correto
                                    for (const pair of formData.entries()) {
                                      console.log(`FormData contém: ${pair[0]}: ${pair[1]}`);
                                    }
                                    
                                    // Alternativa: usar JSON em vez de FormData
                                    const jsonData = { status: newStatus };
                                    
                                    apiRequest('PATCH', `/api/transactions/${transaction.id}`, jsonData)
                                      .then(async (response) => {
                                        let responseData;
                                        try {
                                          // Usar diretamente o json() da resposta original
                                          responseData = await response.json();
                                          console.log(`Resposta do servidor (${response.status}):`, responseData);
                                        } catch (e) {
                                          // Fallback para text quando não é JSON válido
                                          const responseText = await response.text();
                                          console.log(`Resposta do servidor como texto (${response.status}): ${responseText}`);
                                          
                                          if (!response.ok) {
                                            throw new Error(`Falha na resposta da API: ${response.status} - ${responseText}`);
                                          }
                                          
                                          // Tentar fazer parse manual se necessário
                                          try {
                                            responseData = JSON.parse(responseText);
                                          } catch (jsonError) {
                                            responseData = { success: true, message: responseText };
                                          }
                                        }
                                        
                                        if (!response.ok) {
                                          throw new Error(`Falha na resposta da API: ${response.status}`);
                                        }
                                        
                                        return responseData;
                                      })
                                      .then((data) => {
                                        console.log('Status atualizado com sucesso:', data);
                                        
                                        // Recarregar os dados
                                        queryClient.invalidateQueries({ queryKey: [`/api/transactions/${userId}`] });
                                        queryClient.invalidateQueries({ queryKey: [`/api/upcoming-bills/${userId}`] });
                                        queryClient.invalidateQueries({ queryKey: [`/api/summary/${userId}`] });
                                        
                                        toast({
                                          title: `${transaction.description}`,
                                          description: `${newStatus === 'paga' ? '✅ Marcada como paga' : '⚠️ Desmarcada como paga'}`,
                                          variant: newStatus === 'paga' ? 'default' : 'destructive',
                                        });
                                      })
                                      .catch((error) => {
                                        console.error('Erro ao atualizar status:', error);
                                        toast({
                                          title: "Erro",
                                          description: "Não foi possível atualizar o status da transação. Tente novamente.",
                                          variant: "destructive",
                                        });
                                      });
                                  }}
                                >
                                  {transaction.status === 'paga' ? '✓ Paga' : transaction.status === 'atrasada' ? '⚠️ Atrasada' : '💰 Pagar'}
                                </Button>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right font-medium">
                              <span className={`${transaction.type === 'expense' 
                                ? (transaction.status === 'paga' ? 'text-slate-400 line-through' : 'text-destructive') 
                                : 'text-accent'}`}>
                                {transaction.type === 'expense' ? '- ' : '+ '}
                                {formatCurrency(parseFloat(transaction.amount))}
                              </span>
                              {transaction.type === 'expense' && transaction.status === 'paga' && (
                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                  Pago
                                </span>
                              )}
                              {transaction.type === 'expense' && transaction.status === 'atrasada' && (
                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                  Atrasado
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              {(transaction.attachment || transaction.attachment_path) && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-blue-600 hover:text-blue-800 hover:bg-blue-50 mr-1"
                                    onClick={() => {
                                      // Garantir que o caminho do anexo comece com / se não for um caminho completo
                                      const attachmentPath = transaction.attachment_path || transaction.attachment;
                                      const fullPath = attachmentPath.startsWith('/') ? attachmentPath : `/${attachmentPath}`;
                                      console.log('Abrindo anexo:', fullPath);
                                      setSelectedAttachmentPath(fullPath);
                                      setAttachmentViewerOpen(true);
                                    }}
                                    title="Visualizar anexo/boleto"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-primary hover:text-secondary hover:bg-primary/10 mr-1"
                                onClick={() => handleEditTransaction(transaction)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
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
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-muted-foreground">
                            Nenhuma transação encontrada
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
                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Data</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Status</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">Valor</th>
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
                            <td className="py-3 px-4 text-right"><Skeleton className="h-6 w-20 ml-auto" /></td>
                            <td className="py-3 px-4 text-right"><Skeleton className="h-6 w-16 ml-auto" /></td>
                          </tr>
                        ))
                      ) : filteredTransactions.filter((t: any) => t.type === 'income').length > 0 ? (
                        filteredTransactions
                          .filter((t: any) => t.type === 'income')
                          .map((transaction: any) => (
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
                                {formatDate(transaction.date)}
                              </td>
                              <td className="py-3 px-4 text-right font-medium text-accent">
                                + {formatCurrency(parseFloat(transaction.amount))}
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
                                  className="h-8 w-8 text-primary hover:text-secondary hover:bg-primary/10 mr-1"
                                  onClick={() => handleEditTransaction(transaction)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
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
                          ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-muted-foreground">
                            Nenhuma receita encontrada
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
                        <th className="text-left py-3 px-4 text-sm font-medium text-slate-500">Data</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-slate-500">Valor</th>
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
                            <td className="py-3 px-4 text-right"><Skeleton className="h-6 w-20 ml-auto" /></td>
                            <td className="py-3 px-4 text-right"><Skeleton className="h-6 w-16 ml-auto" /></td>
                          </tr>
                        ))
                      ) : filteredTransactions.filter((t: any) => t.type === 'expense').length > 0 ? (
                        filteredTransactions
                          .filter((t: any) => t.type === 'expense')
                          .map((transaction: any) => (
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
                                {formatDate(transaction.date)}
                              </td>
                              <td className="py-3 px-4 text-right font-medium text-destructive">
                                - {formatCurrency(parseFloat(transaction.amount))}
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
                                  className="h-8 w-8 text-primary hover:text-secondary hover:bg-primary/10 mr-1"
                                  onClick={() => handleEditTransaction(transaction)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
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
                          ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-muted-foreground">
                            Nenhuma despesa encontrada
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
        transaction={selectedTransaction?.type === 'expense' ? selectedTransaction : undefined}
      />

      <IncomeModal 
        isOpen={incomeModalOpen} 
        onClose={() => setIncomeModalOpen(false)} 
        userId={userId}
        transaction={selectedTransaction?.type === 'income' ? selectedTransaction : undefined}
      />

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

      <AttachmentViewerModal        isOpen={attachmentViewerOpen}
        onClose={() => setAttachmentViewerOpen(false)}
        attachmentPath={selectedAttachmentPath}
        title="Visualizar Anexo"
      />
    </>
  );
}