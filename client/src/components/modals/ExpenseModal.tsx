import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { FileUpload } from '@/components/ui/file-upload';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient } from "@/lib/queryClient";
import { useQuery, useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Loader2 } from 'lucide-react';

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: number;
  transaction?: any; // For editing
}

export function ExpenseModal({ isOpen, onClose, userId, transaction }: ExpenseModalProps) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [showRecurring, setShowRecurring] = useState(false);
  const isEditMode = !!transaction;

  // Get categories
  const { data: categories, isLoading: categoriesLoading } = useQuery<any>({
    queryKey: ['/api/categories', { type: 'expense' }],
    enabled: isOpen,
    onSuccess: (data) => {
      console.log('Categorias de despesa carregadas:', data);
      // If editing and category exists, ensure form is updated
      if (isEditMode && transaction?.categoryId) {
        form.setValue('categoryId', transaction.categoryId.toString());
      }
    },
    onError: (error) => {
      console.error('Erro ao carregar categorias de despesa:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar as categorias',
        variant: 'destructive',
      });
    }
  });

  // Get user data for overdraft limit check
  const { data: userData } = useQuery<any>({
    queryKey: [`/api/user/${userId}`],
    enabled: isOpen,
  });

  // Get financial summary for current balance
  const { data: financialSummary } = useQuery<any>({
    queryKey: [`/api/summary/${userId}`],
    enabled: isOpen,
  });

  // Form schema
  const formSchema = z.object({
    description: z.string().min(1, { message: 'Descrição é obrigatória' }),
    amount: z.string().min(1, { message: 'Valor é obrigatório' }),
    date: z.string().min(1, { message: 'Data é obrigatória' }),
    categoryId: z.string().min(1, { message: 'Categoria é obrigatória' }),
    isRecurring: z.boolean().default(false),
    frequency: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  });

  // Form initialization
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: transaction?.description || '',
      amount: transaction?.amount || '',
      date: transaction ? new Date(transaction.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      categoryId: transaction?.categoryId?.toString() || '',
      isRecurring: transaction?.isRecurring || false,
      frequency: '',
      startDate: new Date().toISOString().slice(0, 10),
      endDate: '',
    },
  });

  // Update form when transaction changes
  useEffect(() => {
    if (transaction) {
      console.log("Editando transação:", transaction);

      // Garantir que valores estejam no formato correto
      const formattedAmount = typeof transaction.amount === 'number' 
        ? transaction.amount.toFixed(2) 
        : transaction.amount || '';

      const categoryIdStr = transaction.categoryId?.toString() || '';

      form.reset({
        description: transaction.description || '',
        amount: formattedAmount,
        date: new Date(transaction.date).toISOString().slice(0, 10),
        categoryId: categoryIdStr,
        isRecurring: !!transaction.isRecurring,
      });

      setShowRecurring(!!transaction.isRecurring);
    } else {
      form.reset({
        description: '',
        amount: '',
        date: new Date().toISOString().slice(0, 10),
        categoryId: '',
        isRecurring: false,
        frequency: 'monthly',
        startDate: new Date().toISOString().slice(0, 10),
        endDate: '',
      });

      setShowRecurring(false);
    }
  }, [transaction, form]);

  // Handle file change
  const handleFileChange = (selectedFile: File | null) => {
    console.log("Arquivo selecionado:", selectedFile?.name || "Nenhum");
    setFile(selectedFile);
  };

  // Create transaction mutation
  const createTransaction = useMutation({
    mutationFn: async (data: FormData) => {
      return apiRequest('POST', '/api/transactions', data);
    },
    onSuccess: () => {
      toast({
        title: 'Sucesso',
        description: 'Despesa registrada com sucesso!',
      });
      queryClient.invalidateQueries({ queryKey: [`/api/transactions/${userId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/summary/${userId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/upcoming/${userId}`] });
      form.reset();
      setFile(null);
      onClose();
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Ocorreu um erro ao registrar a despesa.',
        variant: 'destructive',
      });
    }
  });

  // Update transaction mutation
  const updateTransaction = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: FormData }) => {
      return apiRequest('PATCH', `/api/transactions/${id}`, data);
    },
    onSuccess: () => {
      toast({
        title: 'Sucesso',
        description: 'Despesa atualizada com sucesso!',
      });
      queryClient.invalidateQueries({ queryKey: [`/api/transactions/${userId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/summary/${userId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/upcoming/${userId}`] });
      form.reset();
      setFile(null);
      onClose();
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Ocorreu um erro ao atualizar a despesa.',
        variant: 'destructive',
      });
    }
  });

  // Form submission
  const onSubmit = (values: z.infer<typeof formSchema>) => {
    // Obter o valor da despesa do formulário
    const expenseAmount = parseFloat(values.amount || '0');

    // Verificar se a despesa não ultrapassa o saldo + limite de cheque especial
      if (userData && financialSummary) {
        const currentBalance = financialSummary.currentBalance;
        const overdraftLimit = parseFloat(userData.overdraftLimit || '0');
        const availableTotal = currentBalance + overdraftLimit;

        // Se for edição de uma despesa existente, considerar o valor anterior
        const previousAmount = isEditMode ? parseFloat(transaction.amount) : 0;
        const netExpense = expenseAmount - previousAmount;

        // Calcular quanto vai sobrar do cheque especial após a despesa
        const remainingBalance = currentBalance - netExpense;
        const overdraftUsed = remainingBalance < 0 ? Math.abs(remainingBalance) : 0;
        const overdraftRemaining = overdraftLimit - overdraftUsed;

        // Se o saldo após a despesa for menor que o limite negativo permitido, mostrar alerta detalhado
        // Exemplo: Se o saldo for -2000 e o limite for 5000, o mínimo permitido é -5000
        if (remainingBalance < -overdraftLimit) {
          const result = window.confirm(
            `⚠️ ALERTA: Esta despesa ultrapassa seu saldo disponível e limite de cheque especial!\n\n` +
            `Saldo atual: R$ ${currentBalance.toFixed(2)}\n` +
            `Limite de cheque especial: R$ ${overdraftLimit.toFixed(2)}\n` +
            `Total disponível: R$ ${availableTotal.toFixed(2)}\n` +
            `Valor da despesa: R$ ${expenseAmount.toFixed(2)}\n\n` +
            `Você excederá seu limite em R$ ${Math.abs(remainingBalance + overdraftLimit).toFixed(2)}\n\n` +
            `Deseja continuar mesmo assim?`
          );

          if (!result) {
            return; // Usuário cancelou a operação
          }
        }
        // Se o saldo vai ficar negativo mas dentro do limite do cheque especial, mostrar alerta informativo
        else if (currentBalance - netExpense < 0) {
          const percentUsed = (overdraftUsed / overdraftLimit) * 100;
          let alertLevel = "moderado";

          if (percentUsed > 80) {
            alertLevel = "crítico";
          } else if (percentUsed > 50) {
            alertLevel = "alto";
          }

          const result = window.confirm(
            `⚠️ Atenção: Esta despesa utilizará seu limite de cheque especial!\n\n` +
            `Saldo atual: R$ ${currentBalance.toFixed(2)}\n` +
            `Despesa: R$ ${expenseAmount.toFixed(2)}\n` +
            `Novo saldo após a despesa: R$ ${remainingBalance.toFixed(2)}\n\n` +
            `Você utilizará R$ ${overdraftUsed.toFixed(2)} do seu cheque especial (${percentUsed.toFixed(0)}%)\n` +
            `Limite restante: R$ ${overdraftRemaining.toFixed(2)}\n\n` +
            `Nível de alerta: ${alertLevel.toUpperCase()}\n\n` +
            `Deseja continuar com esta despesa?`
          );

          if (!result) {
            return; // Usuário cancelou a operação
          }
        }
      }

    const formData = new FormData();

    // Add user ID
    formData.append('userId', userId.toString());
    formData.append('type', 'expense');

    // Add other fields
    Object.entries(values).forEach(([key, value]) => {
      if (key === 'isRecurring') {
        formData.append(key, value.toString());
      } else if (key === 'amount' && value !== undefined && value !== null && value !== '') {
        // Garantir que o valor seja formatado corretamente
        const formattedAmount = typeof value === 'string' 
          ? value.replace(',', '.') 
          : value.toString();
        formData.append(key, formattedAmount);
        console.log(`Valor formatado para envio: ${formattedAmount}`);
      } else if (value !== undefined && value !== null && value !== '') {
        formData.append(key, value.toString());
      }
    });

    // Add file if exists
    if (file) {
      formData.append('attachment', file);
    }

    // Check if it's a recurring transaction
    if (values.isRecurring && !isEditMode) {
      // Prepare recurring transaction data as JSON
      const recurringData: { 
        userId: number;
        type: string;
        description: string;
        amount: string;
        categoryId: number;
        frequency: string;
        startDate: string;
        endDate?: string;
      } = {
        userId: parseInt(userId.toString()),
        type: 'expense',
        description: values.description,
        amount: values.amount,
        categoryId: parseInt(values.categoryId, 10),
        frequency: values.frequency || 'monthly',
        startDate: values.startDate || values.date
      };

      if (values.endDate) {
        recurringData.endDate = values.endDate;
      }

      // Log what we're sending
      console.log("Submitting recurring expense data:", recurringData);

      // For file uploads, we would need a different approach
      // but for now, let's just submit the JSON data

      // Create recurring transaction with JSON data
      apiRequest('POST', '/api/recurring', recurringData)
        .then(async (res) => {
          if (!res.ok) {
            const errorData = await res.json();
            console.error('Error creating recurring transaction:', errorData);
            throw new Error(JSON.stringify(errorData));
          }
          return res.json();
        })
        .then((data) => {
          // Add recurring ID to transaction
          formData.append('recurringId', data.id.toString());

          // Create the first occurrence
          if (isEditMode) {
            updateTransaction.mutate({ id: transaction.id, data: formData });
          } else {
            // Prepare transaction data, making sure to keep date as string
            const transactionData = {
              userId: parseInt(userId.toString()),
              type: 'expense',
              description: values.description,
              amount: values.amount,
              categoryId: parseInt(values.categoryId),
              date: values.date.toString(), // Ensure date is sent as string
              isRecurring: 'true',
              recurringId: data.id
            };

            console.log("Creating first occurrence of recurring expense:", transactionData);
            apiRequest('POST', '/api/transactions', transactionData)
              .then(response => {
                if (!response.ok) {
                  throw new Error('Failed to create first occurrence');
                }
                return response.json();
              })
              .then(() => {
                toast({
                  title: 'Sucesso',
                  description: 'Despesa recorrente registrada com sucesso!',
                });
                queryClient.invalidateQueries({ queryKey: [`/api/transactions/${userId}`] });
                queryClient.invalidateQueries({ queryKey: [`/api/summary/${userId}`] });
                queryClient.invalidateQueries({ queryKey: [`/api/upcoming/${userId}`] });
                form.reset();
                setFile(null);
                onClose();
              })
              .catch(error => {
                console.error('Error creating first occurrence:', error);
                toast({
                  title: 'Atenção',
                  description: 'Despesa recorrente criada, mas houve um erro ao registrar a primeira ocorrência.',
                  variant: 'destructive',
                });
              });
          }
        })
        .catch((error) => {
          console.error('Recurring transaction error:', error);
          toast({
            title: 'Erro',
            description: 'Ocorreu um erro ao registrar a despesa recorrente. Verifique o console para mais detalhes.',
            variant: 'destructive',
          });
        });
    } else {
      // Simple transaction
      // Converter isRecurring de string para booleano para evitar erro de validação
      if (formData.has('isRecurring')) {
        formData.set('isRecurring', formData.get('isRecurring') === 'true' ? 'true' : 'false');
      }

      if (isEditMode) {
        updateTransaction.mutate({ id: transaction.id, data: formData });
      } else {
        createTransaction.mutate(formData);
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Editar Despesa' : 'Nova Despesa'}</DialogTitle>
          <DialogDescription>
            Preencha os detalhes da despesa abaixo.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Supermercado, Aluguel" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor (R$)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="0,00" 
                      {...field} 
                      value={field.value || ''}
                      onChange={(e) => {
                        // Format as currency
                        const value = e.target.value.replace(/\D/g, '');
                        if (value === '') {
                          field.onChange('');
                        } else {
                          const formattedValue = (parseInt(value) / 100).toFixed(2);
                          field.onChange(formattedValue === 'NaN' ? '' : formattedValue);
                        }
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Categoria</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                      value={field.value || ""}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma categoria" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categoriesLoading ? (
                          <SelectItem value="loading" disabled>
                            Carregando...
                          </SelectItem>
                        ) : categories && categories.length > 0 ? (
                          categories.map((category: any) => (
                            <SelectItem key={category.id} value={category.id.toString()}>
                              <span className="flex items-center gap-2">
                                <i className={category.icon}></i>
                                {category.name}
                              </span>
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no-categories" disabled>
                            Nenhuma categoria encontrada
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="isRecurring"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(checked) => {
                        field.onChange(checked);
                        setShowRecurring(!!checked);
                      }}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Despesa recorrente?</FormLabel>
                    <FormDescription>
                      Marque esta opção para configurar uma despesa que se repete regularmente.
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            {showRecurring && !isEditMode && (
              <div className="p-4 bg-slate-50 rounded-md space-y-4">
                <FormField
                  control={form.control}
                  name="frequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Frequência</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value || 'monthly'}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="monthly">Mensal</SelectItem>
                          <SelectItem value="bimonthly">Bimestral</SelectItem>
                          <SelectItem value="quarterly">Trimestral</SelectItem>
                          <SelectItem value="semiannual">Semestral</SelectItem>
                          <SelectItem value="annual">Anual</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data Início</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data Fim (opcional)</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            )}

            <FileUpload
              onFileChange={handleFileChange}
              currentFileName={transaction?.attachment?.split('/').pop()}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={createTransaction.isPending || updateTransaction.isPending}
              >
                {(createTransaction.isPending || updateTransaction.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isEditMode ? 'Atualizar' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default ExpenseModal;