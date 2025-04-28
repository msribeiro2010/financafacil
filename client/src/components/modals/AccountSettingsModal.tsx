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

export function AccountSettingsModal({ isOpen, onClose, userId, user }: AccountSettingsModalProps) {
  const { toast } = useToast();
  
  // Form initialization
  const form = useForm<z.infer<typeof accountSettingsSchema>>({
    resolver: zodResolver(accountSettingsSchema),
    defaultValues: {
      initialBalance: user?.initialBalance || '0',
      overdraftLimit: user?.overdraftLimit || '0',
    },
  });
  
  // Update form when user changes
  useEffect(() => {
    if (user) {
      form.reset({
        initialBalance: user.initialBalance || '0',
        overdraftLimit: user.overdraftLimit || '0',
      });
    }
  }, [user, form]);
  
  // Update account settings mutation
  const updateSettings = useMutation({
    mutationFn: async (data: z.infer<typeof accountSettingsSchema>) => {
      return apiRequest('PATCH', `/api/user/${userId}/settings`, data);
    },
    onSuccess: () => {
      toast({
        title: 'Sucesso',
        description: 'Configurações atualizadas com sucesso!',
      });
      queryClient.invalidateQueries({ queryKey: [`/api/user/${userId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/summary/${userId}`] });
      onClose();
    },
    onError: () => {
      toast({
        title: 'Erro',
        description: 'Ocorreu um erro ao atualizar as configurações.',
        variant: 'destructive',
      });
    }
  });
  
  // Form submission
  const onSubmit = (data: z.infer<typeof accountSettingsSchema>) => {
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
                      placeholder="0,00" 
                      {...field} 
                      onChange={(e) => {
                        // Format as currency
                        const value = e.target.value.replace(/\D/g, '');
                        const formattedValue = (parseInt(value) / 100).toFixed(2);
                        field.onChange(formattedValue === 'NaN' ? '0.00' : formattedValue);
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
                      placeholder="0,00" 
                      {...field} 
                      onChange={(e) => {
                        // Format as currency
                        const value = e.target.value.replace(/\D/g, '');
                        const formattedValue = (parseInt(value) / 100).toFixed(2);
                        field.onChange(formattedValue === 'NaN' ? '0.00' : formattedValue);
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
