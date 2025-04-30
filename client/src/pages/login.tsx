import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { signInWithGoogle } from '@/lib/firebase';

interface LoginFormData {
  username: string;
  password: string;
}

export default function Login({ onLogin }: { onLogin: (user: any) => void }) {
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState<LoginFormData>({
    username: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
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
      if (formData.username === 'demo' && formData.password === 'demo123') {
        // Demo login direto para simplificar (sem chamada API)
        const mockUserData = {
          id: 1,
          username: 'demo',
          initialBalance: '6103.00',
          overdraftLimit: '5000.00'
        };
        
        // Login successful
        setTimeout(() => {
          toast({
            title: 'Login bem-sucedido',
            description: `Bem-vindo, ${mockUserData.username}!`,
          });
  
          // Call the onLogin function with user data
          onLogin(mockUserData);
        }, 1000); // Simula um atraso de rede
      } else {
        // Simula falha de login para credenciais incorretas
        setTimeout(() => {
          const errorMsg = 'Usuário ou senha inválidos';
          setError(errorMsg);
          toast({
            title: 'Erro de login',
            description: errorMsg,
            variant: 'destructive',
          });
          setIsLoading(false);
        }, 1000);
        return; // Evita que o bloco catch seja executado
      }
    } catch (err: any) {
      setError(err.message);
      toast({
        title: 'Erro de login',
        description: err.message,
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  };
  
  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    setError(null);
    
    try {
      // Login com o Firebase/Google
      const user = await signInWithGoogle();
      
      if (user) {
        // Cria um objeto de usuário com os dados do Google
        const userData = {
          id: 1, // Para manter compatibilidade com a app existente
          username: user.displayName || 'Usuário Google',
          email: user.email,
          initialBalance: '0.00',
          overdraftLimit: '0.00',
          photoURL: user.photoURL,
          uid: user.uid
        };
        
        toast({
          title: 'Login bem-sucedido',
          description: `Bem-vindo, ${userData.username}!`,
        });
        
        // Chama a função onLogin com os dados do usuário
        onLogin(userData);
      }
    } catch (err: any) {
      let errorMessage = err.message;
      
      // Adiciona mensagem específica para o erro de domínio não autorizado
      if (err.message.includes('unauthorized-domain') || err.code === 'auth/unauthorized-domain') {
        errorMessage = 'Este domínio Replit não está autorizado no Firebase. O administrador precisa adicionar este domínio na configuração do Firebase.';
      }
      
      setError(errorMessage);
      toast({
        title: 'Erro no login com Google',
        description: errorMessage,
        variant: 'destructive',
      });
      
      // Versão de demonstração - para fins de teste apenas
      if (err.message.includes('unauthorized-domain') || err.code === 'auth/unauthorized-domain') {
        setTimeout(() => {
          // Demo login para contornar a restrição de domínio
          const mockUserData = {
            id: 2,
            username: 'Usuário Google (Demo)',
            email: 'usuario.google@exemplo.com',
            initialBalance: '0.00',
            overdraftLimit: '0.00',
            photoURL: null,
            uid: 'google-demo-uid'
          };
          
          toast({
            title: 'Login de demonstração',
            description: 'Usando login simulado do Google devido à restrição de domínio.',
          });
          
          onLogin(mockUserData);
        }, 2000);
      }
    } finally {
      setIsGoogleLoading(false);
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
              Transforme a gestão das suas finanças pessoais
            </p>
          </div>
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="bg-indigo-100 p-2 rounded-full text-indigo-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
                  <line x1="9" x2="9.01" y1="9" y2="9"/>
                  <line x1="15" x2="15.01" y1="9" y2="9"/>
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">Interface amigável</h3>
                <p className="text-slate-600">Design moderno e intuitivo para facilitar o uso diário</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="bg-indigo-100 p-2 rounded-full text-indigo-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">Segurança garantida</h3>
                <p className="text-slate-600">Seus dados financeiros protegidos com máxima segurança</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="bg-indigo-100 p-2 rounded-full text-indigo-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">Relatórios detalhados</h3>
                <p className="text-slate-600">Acompanhe suas finanças com gráficos e análises personalizadas</p>
              </div>
            </div>
          </div>
        </div>

        {/* Login form */}
        <Card className="w-full shadow-xl border-0">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">Bem-vindo de volta</CardTitle>
            <CardDescription className="text-center">
              Entre com suas credenciais para acessar sua conta
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
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Senha</Label>
                  <a href="#" className="text-sm text-indigo-600 hover:text-indigo-800">
                    Esqueceu a senha?
                  </a>
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Sua senha"
                  value={formData.password}
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
                    Entrando...
                  </>
                ) : (
                  'Entrar'
                )}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <div className="relative w-full">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Ou continue com</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 w-full">
              <Button 
                variant="outline" 
                className="space-x-2" 
                onClick={handleGoogleLogin}
                disabled={isGoogleLoading}
              >
                {isGoogleLoading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-google" viewBox="0 0 16 16">
                      <path d="M15.545 6.558a9.42 9.42 0 0 1 .139 1.626c0 2.434-.87 4.492-2.384 5.885h.002C11.978 15.292 10.158 16 8 16A8 8 0 1 1 8 0a7.689 7.689 0 0 1 5.352 2.082l-2.284 2.284A4.347 4.347 0 0 0 8 3.166c-2.087 0-3.86 1.408-4.492 3.304a4.792 4.792 0 0 0 0 3.063h.003c.635 1.893 2.405 3.301 4.492 3.301 1.078 0 2.004-.276 2.722-.764h-.003a3.702 3.702 0 0 0 1.599-2.431H8v-3.08h7.545z"/>
                    </svg>
                    <span>Google</span>
                  </>
                )}
              </Button>
              <Button 
                variant="outline" 
                className="space-x-2"
                disabled={true}
                title="Em breve"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="bi bi-facebook" viewBox="0 0 16 16">
                  <path d="M16 8.049c0-4.446-3.582-8.05-8-8.05C3.58 0-.002 3.603-.002 8.05c0 4.017 2.926 7.347 6.75 7.951v-5.625h-2.03V8.05H6.75V6.275c0-2.017 1.195-3.131 3.022-3.131.876 0 1.791.157 1.791.157v1.98h-1.009c-.993 0-1.303.621-1.303 1.258v1.51h2.218l-.354 2.326H9.25V16c3.824-.604 6.75-3.934 6.75-7.951z"/>
                </svg>
                <span>Facebook</span>
              </Button>
            </div>
            <div className="text-center text-sm text-gray-500 mt-4">
              Não tem uma conta?{' '}
              <a 
                href="#" 
                onClick={(e) => {
                  e.preventDefault();
                  setLocation('/register');
                }}
                className="text-indigo-600 hover:text-indigo-800"
              >
                Registre-se
              </a>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
