import React, { useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Loader2 } from 'lucide-react';
import { accountSettingsSchema } from '@shared/schema';
import { z } from 'zod';

interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: number;
  user: any;
}

// Função auxiliar para formatar valores monetários com tratamento mais rigoroso
const formatMonetaryValue = (value: string | number | null | undefined): string => {
  // Garante que temos uma string para trabalhar
  if (value === null || value === undefined) {
    return '0.00';
  }
  
  // Converte para string se for número
  const strValue = typeof value === 'number' ? value.toString() : value;
  
  // Substitui vírgula por ponto
  let formatted = strValue.replace(',', '.');
  
  // Remove caracteres não numéricos exceto o ponto decimal
  formatted = formatted.replace(/[^\d.]/g, '');
  
  // Verificar se é um número válido
  const numValue = parseFloat(formatted);
  if (isNaN(numValue)) {
    return '0.00';
  }
  
  // Garante que o valor tenha duas casas decimais
  return numValue.toFixed(2);
};

// Componente de configurações da conta que permite ajustar saldo inicial e limite de cheque especial
export function AccountSettingsModal({ isOpen, onClose, userId, user }: AccountSettingsModalProps) {
  const { toast } = useToast();
  
  // Obtém valores atuais do usuário considerando possíveis formatos (snake_case ou camelCase)
  const getCurrentInitialBalance = () => {
    const value = user?.initialBalance || user?.initial_balance || '0';
    return formatMonetaryValue(value);
  };
  
  const getCurrentOverdraftLimit = () => {
    const value = user?.overdraftLimit || user?.overdraft_limit || '0';
    return formatMonetaryValue(value);
  };
  
  // Form initialization
  const form = useForm<z.infer<typeof accountSettingsSchema>>({
    resolver: zodResolver(accountSettingsSchema),
    defaultValues: {
      initialBalance: getCurrentInitialBalance(),
      overdraftLimit: getCurrentOverdraftLimit(),
    },
  });
  
  // Update form when user changes or modal opens
  useEffect(() => {
    if (user && isOpen) {
      console.log('Atualizando formulário com valores do usuário:', {
        initialBalance: getCurrentInitialBalance(),
        overdraftLimit: getCurrentOverdraftLimit(),
      });
      
      form.reset({
        initialBalance: getCurrentInitialBalance(),
        overdraftLimit: getCurrentOverdraftLimit(),
      });
    }
  }, [user, isOpen]); // Adicionando isOpen como dependência para garantir atualização quando o modal abrir
  
  // Update account settings mutation
  const updateSettings = useMutation({
    mutationFn: async (data: z.infer<typeof accountSettingsSchema>) => {
      console.log('Enviando dados para atualização:', data);
      return apiRequest('PATCH', `/api/user/${userId}/settings`, data);
    },
    onSuccess: async (response) => {
      try {
        // Tenta obter os dados do usuário da resposta
        const updatedUser = await response.json();
        console.log('Usuário atualizado:', updatedUser);
        
        // Verifica informações de debug se disponíveis
        if (updatedUser.debug) {
          console.log('Informações de debug recebidas:', updatedUser.debug);
        }
        
        // Extrai o valor do saldo inicial do campo correto (compatibilidade entre snake_case e camelCase)
        const initialBalance = updatedUser.initial_balance || updatedUser.initialBalance || '0';
        const overdraftLimit = updatedUser.overdraft_limit || updatedUser.overdraftLimit || '0';
        
        // Adapta o objeto do usuário para garantir a consistência de nomenclatura
        const normalizedUser = {
          ...updatedUser,
          initialBalance,
          overdraftLimit,
          // Adiciona os campos snake_case também para garantir compatibilidade
          initial_balance: initialBalance,
          overdraft_limit: overdraftLimit,
        };
        
        console.log('Usuário normalizado para atualização de cache:', normalizedUser);
        
        // Força a atualização do cache do usuário
        queryClient.setQueryData([`/api/user/${userId}`], normalizedUser);
        
        // Atualiza imediatamente o resumo financeiro
        const summary = queryClient.getQueryData([`/api/summary/${userId}`]);
        if (summary) {
          // Atualiza o saldo atual baseado nas novas configurações
          const updatedSummary = {
            ...summary,
            currentBalance: parseFloat(initialBalance),
          };
          console.log('Resumo atualizado:', updatedSummary);
          queryClient.setQueryData([`/api/summary/${userId}`], updatedSummary);
        }
        
        // Invalida todas as queries relacionadas para garantir atualização completa
        queryClient.invalidateQueries({queryKey: [`/api/user/${userId}`]});
        queryClient.invalidateQueries({queryKey: [`/api/summary/${userId}`]});
        
        // Força uma atualização global após um pequeno delay para garantir que todas as atualizações foram aplicadas
        setTimeout(() => {
          queryClient.invalidateQueries();
          console.log('Cache completamente invalidado');
        }, 500);
        
        toast({
          title: 'Sucesso',
          description: 'Configurações da conta atualizadas com sucesso!',
        });
        
        onClose();
      } catch (error) {
        console.error('Erro ao processar resposta:', error);
        toast({
          title: 'Erro no processamento',
          description: 'Ocorreu um erro ao processar a resposta do servidor.',
          variant: 'destructive',
        });
      }
    },
    onError: (error) => {
      console.error('Erro na atualização:', error);
      toast({
        title: 'Erro',
        description: 'Ocorreu um erro ao atualizar as configurações da conta.',
        variant: 'destructive',
      });
    }
  });
  
  // Form submission - importante invalidar o cache imediatamente 
  const onSubmit = (data: z.infer<typeof accountSettingsSchema>) => {
    console.log('Submetendo novos valores:', {
      initialBalance: data.initialBalance,
      overdraftLimit: data.overdraftLimit
    });
    
    // Cria uma cópia local do usuário com os novos valores para atualização otimista da UI
    const updatedUserPreview = {
      ...user,
      initialBalance: data.initialBalance,
      overdraftLimit: data.overdraftLimit,
      initial_balance: data.initialBalance,
      overdraft_limit: data.overdraftLimit
    };
    
    // Atualiza o cache imediatamente com os valores novos (otimista)
    queryClient.setQueryData([`/api/user/${userId}`], updatedUserPreview);
    
    // Pré-invalida o cache para forçar uma atualização completa após a resposta do servidor
    queryClient.invalidateQueries({queryKey: [`/api/user/${userId}`]});
    queryClient.invalidateQueries({queryKey: [`/api/summary/${userId}`]});
    
    // Submete a atualização para o servidor
    updateSettings.mutate(data);
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configurações da Conta</DialogTitle>
          <DialogDescription>
            Ajuste as configurações financeiras da sua conta.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="initialBalance"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Saldo Inicial (R$)</FormLabel>
                  <FormControl>
                    <Input 
                      type="text"
                      placeholder="0,00" 
                      {...field} 
                      // Exibe o valor formatado para o usuário
                      value={field.value ? field.value.replace('.', ',') : ''}
                      onChange={(e) => {
                        // Aceita tanto vírgula quanto ponto como separador decimal
                        let input = e.target.value.replace(',', '.');
                        
                        // Filtra para permitir apenas um ponto decimal
                        const parts = input.split('.');
                        if (parts.length > 2) {
                          input = parts[0] + '.' + parts.slice(1).join('');
                        }
                        
                        // Remove caracteres não numéricos exceto o ponto decimal
                        input = input.replace(/[^\d.]/g, '');
                        
                        // Verifica se é um número válido e converte para formato com 2 casas decimais
                        if (input === '' || input === '.') {
                          field.onChange('0.00');
                        } else {
                          const numericValue = parseFloat(input);
                          if (!isNaN(numericValue)) {
                            field.onChange(numericValue.toFixed(2));
                          }
                        }
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    Este valor será considerado como seu ponto de partida para cálculos.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="overdraftLimit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Limite de Cheque Especial (R$)</FormLabel>
                  <FormControl>
                    <Input 
                      type="text"
                      placeholder="0,00" 
                      {...field} 
                      // Exibe o valor formatado para o usuário
                      value={field.value ? field.value.replace('.', ',') : ''}
                      onChange={(e) => {
                        // Aceita tanto vírgula quanto ponto como separador decimal
                        let input = e.target.value.replace(',', '.');
                        
                        // Filtra para permitir apenas um ponto decimal
                        const parts = input.split('.');
                        if (parts.length > 2) {
                          input = parts[0] + '.' + parts.slice(1).join('');
                        }
                        
                        // Remove caracteres não numéricos exceto o ponto decimal
                        input = input.replace(/[^\d.]/g, '');
                        
                        // Verifica se é um número válido e converte para formato com 2 casas decimais
                        if (input === '' || input === '.') {
                          field.onChange('0.00');
                        } else {
                          const numericValue = parseFloat(input);
                          if (!isNaN(numericValue)) {
                            field.onChange(numericValue.toFixed(2));
                          }
                        }
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    Defina o valor disponível como limite de cheque especial.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={updateSettings.isPending}
              >
                {updateSettings.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default AccountSettingsModal;
