import { useState } from 'react';
import { useLocation } from 'wouter';
import { 
  Card, 
  CardContent, 
  CardFooter, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';

interface RegisterFormData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export default function Register() {
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState<RegisterFormData>({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user types
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // Validar os dados do formulário
      if (formData.password !== formData.confirmPassword) {
        throw new Error('As senhas não coincidem');
      }

      if (formData.password.length < 6) {
        throw new Error('A senha deve ter pelo menos 6 caracteres');
      }

      // Chamada real para a API de registro
      const response = await fetch('/api/user/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: formData.username,
          email: formData.email,
          password: formData.password,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Erro ao registrar usuário');
      }

      // Registro bem-sucedido
      toast({
        title: 'Cadastro realizado com sucesso',
        description: 'Você será redirecionado para a página de login',
      });

      // Redirecionar para a página de login após 2 segundos
      setTimeout(() => {
        setLocation('/');
      }, 2000);
    } catch (err: any) {
      setError(err.message);
      toast({
        title: 'Erro no cadastro',
        description: err.message,
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-100 to-slate-200 flex items-center justify-center p-4">
      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-8 items-center">
        {/* Hero section */}
        <div className="hidden md:flex flex-col space-y-6 p-8">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              FinançaFácil
            </h1>
            <p className="text-slate-600 mt-2 text-xl">
              Crie sua conta e comece a controlar suas finanças
            </p>
          </div>
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="bg-indigo-100 p-2 rounded-full text-indigo-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                  <line x1="8" y1="21" x2="16" y2="21"></line>
                  <line x1="12" y1="17" x2="12" y2="21"></line>
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">Multiplataforma</h3>
                <p className="text-slate-600">Acesse de qualquer dispositivo e mantenha tudo sincronizado</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="bg-indigo-100 p-2 rounded-full text-indigo-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">Fácil de usar</h3>
                <p className="text-slate-600">Interface intuitiva que facilita o gerenciamento financeiro</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="bg-indigo-100 p-2 rounded-full text-indigo-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">100% Seguro</h3>
                <p className="text-slate-600">Seus dados financeiros protegidos com a mais alta tecnologia</p>
              </div>
            </div>
          </div>
        </div>

        {/* Registration form */}
        <Card className="w-full shadow-xl border-0">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">Criar uma conta</CardTitle>
            <CardDescription className="text-center">
              Preencha os dados abaixo para se cadastrar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Nome de usuário</Label>
                <Input
                  id="username"
                  name="username"
                  placeholder="Seu nome de usuário"
                  value={formData.username}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="seu.email@exemplo.com"
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Crie uma senha forte"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirme a senha</Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="Digite a senha novamente"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                />
              </div>
              
              {error && (
                <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
                  {error}
                </div>
              )}
              
              <Button 
                type="submit" 
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transition-all duration-200"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Criando conta...
                  </>
                ) : (
                  'Criar conta'
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col">
            <div className="text-center text-sm text-gray-500 mt-4">
              Já tem uma conta?{' '}
              <a 
                href="#" 
                onClick={(e) => {
                  e.preventDefault();
                  setLocation('/');
                }}
                className="text-indigo-600 hover:text-indigo-800"
              >
                Faça login
              </a>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}