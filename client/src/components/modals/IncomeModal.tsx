import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { FileUpload } from '@/components/ui/file-upload';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Loader2 } from 'lucide-react';

interface IncomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: number;
  transaction?: any; // For editing
}

export function IncomeModal({ isOpen, onClose, userId, transaction }: IncomeModalProps) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [showRecurring, setShowRecurring] = useState(false);
  const isEditMode = !!transaction;
  
  // Get categories
  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ['/api/categories?type=income'],
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
      frequency: 'monthly',
      startDate: new Date().toISOString().slice(0, 10),
      endDate: '',
    },
  });
  
  // Update form when transaction changes
  useEffect(() => {
    if (transaction) {
      form.reset({
        description: transaction.description || '',
        amount: transaction.amount || '',
        date: new Date(transaction.date).toISOString().slice(0, 10),
        categoryId: transaction.categoryId?.toString() || '',
        isRecurring: transaction.isRecurring || false,
      });
      
      setShowRecurring(transaction.isRecurring || false);
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
        description: 'Receita registrada com sucesso!',
      });
      queryClient.invalidateQueries({ queryKey: [`/api/transactions/${userId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/summary/${userId}`] });
      form.reset();
      setFile(null);
      onClose();
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Ocorreu um erro ao registrar a receita.',
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
        description: 'Receita atualizada com sucesso!',
      });
      queryClient.invalidateQueries({ queryKey: [`/api/transactions/${userId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/summary/${userId}`] });
      form.reset();
      setFile(null);
      onClose();
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Ocorreu um erro ao atualizar a receita.',
        variant: 'destructive',
      });
    }
  });
  
  // Form submission
  const onSubmit = (values: z.infer<typeof formSchema>) => {
    const formData = new FormData();
    
    // Add user ID
    formData.append('userId', userId.toString());
    formData.append('type', 'income');
    
    // Add other fields
    Object.entries(values).forEach(([key, value]) => {
      if (key === 'isRecurring') {
        formData.append(key, value.toString());
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
        type: 'income',
        description: values.description,
        amount: values.amount,
        categoryId: parseInt(values.categoryId),
        frequency: values.frequency || 'monthly',
        startDate: values.startDate || values.date
      };
      
      if (values.endDate) {
        recurringData.endDate = values.endDate;
      }
      
      // Log what we're sending
      console.log("Submitting recurring income data:", recurringData);
      
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
              type: 'income',
              description: values.description,
              amount: values.amount,
              categoryId: parseInt(values.categoryId),
              date: values.date.toString(), // Ensure date is sent as string
              recurringId: data.id
            };
            
            console.log("Creating first occurrence of recurring income:", transactionData);
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
                  description: 'Receita recorrente registrada com sucesso!',
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
                  description: 'Receita recorrente criada, mas houve um erro ao registrar a primeira ocorrência.',
                  variant: 'destructive',
                });
              });
          }
        })
        .catch((error) => {
          console.error('Recurring transaction error:', error);
          toast({
            title: 'Erro',
            description: 'Ocorreu um erro ao registrar a receita recorrente. Verifique o console para mais detalhes.',
            variant: 'destructive',
          });
        });
    } else {
      // Simple transaction
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
          <DialogTitle>{isEditMode ? 'Editar Receita' : 'Nova Receita'}</DialogTitle>
          <DialogDescription>
            Preencha os detalhes da receita abaixo.
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
                    <Input placeholder="Ex: Salário, Freelance" {...field} />
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
                      onChange={(e) => {
                        // Format as currency
                        const value = e.target.value.replace(/\D/g, '');
                        const formattedValue = (parseInt(value) / 100).toFixed(2);
                        field.onChange(formattedValue === 'NaN' ? '' : formattedValue);
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
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categoriesLoading ? (
                          <SelectItem value="loading" disabled>
                            Carregando...
                          </SelectItem>
                        ) : (
                          categories?.map((category: any) => (
                            <SelectItem key={category.id} value={category.id.toString()}>
                              {category.name}
                            </SelectItem>
                          ))
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
                    <FormLabel>Receita recorrente?</FormLabel>
                    <FormDescription>
                      Marque esta opção para configurar uma receita que se repete regularmente.
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
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
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

export default IncomeModal;
