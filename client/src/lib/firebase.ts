import { initializeApp, FirebaseApp } from "firebase/app";
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged,
  signOut as firebaseSignOut,
  User as FirebaseUser,
  Auth
} from "firebase/auth";
// Note: Não estamos importando getAnalytics para evitar erros em ambientes de desenvolvimento

// Log das variáveis de ambiente para debug
console.log("Firebase API Key:", import.meta.env.VITE_FIREBASE_API_KEY ? "Definida" : "Não definida");
console.log("Firebase Project ID:", import.meta.env.VITE_FIREBASE_PROJECT_ID ? "Definido" : "Não definido");
console.log("Firebase App ID:", import.meta.env.VITE_FIREBASE_APP_ID ? "Definido" : "Não definido");

// Inicialização segura e resiliente do Firebase
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let googleProvider: GoogleAuthProvider | null = null;

try {
  // Tentar usar as variáveis de ambiente primeiro
  if (import.meta.env.VITE_FIREBASE_API_KEY && 
      import.meta.env.VITE_FIREBASE_PROJECT_ID && 
      import.meta.env.VITE_FIREBASE_APP_ID) {
    
    const envConfig = {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.appspot.com`,
      messagingSenderId: "",
      appId: import.meta.env.VITE_FIREBASE_APP_ID
    };
    
    app = initializeApp(envConfig);
    console.log("Firebase inicializado com variáveis de ambiente");
  } 
  else {
    console.log("Firebase desativado devido à falta de configuração");
  }
  
  if (app) {
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
  }
} catch (error) {
  console.error("Erro ao inicializar Firebase", error);
  // Tratamento gracioso para falha na inicialização
  app = null;
  auth = null;
  googleProvider = null;
}

// Função para fazer login com Google
export const signInWithGoogle = async () => {
  if (!auth || !googleProvider) {
    console.error("Firebase não está configurado. Impossível fazer login com Google.");
    throw new Error("Firebase não está configurado. Entre em contato com o suporte.");
  }

  try {
    // Como já verificamos que googleProvider não é null acima, podemos usar ! para indicar ao TypeScript
    googleProvider!.addScope('email');
    googleProvider!.addScope('profile');
    
    console.log("Iniciando login com Google...");
    // Como já verificamos que auth não é null acima, podemos usar ! para indicar ao TypeScript
    const result = await signInWithPopup(auth!, googleProvider!);
    console.log("Login com Google bem-sucedido:", result.user);
    return result.user;
  } catch (error: any) {
    console.error("Erro ao fazer login com Google:", error);
    console.error("Código do erro:", error.code);
    console.error("Mensagem do erro:", error.message);
    
    // Tratamento específico para erros comuns
    if (error.code === 'auth/popup-blocked') {
      throw new Error('O popup foi bloqueado pelo navegador. Por favor, permita popups para este site.');
    } else if (error.code === 'auth/popup-closed-by-user') {
      throw new Error('O processo de login foi cancelado.');
    } else if (error.code === 'auth/unauthorized-domain') {
      throw new Error('Este domínio não está autorizado para operações de autenticação. Entre em contato com o suporte.');
    } else {
      throw error;
    }
  }
};

// Função para fazer logout
export const signOut = async () => {
  if (!auth) {
    console.warn("Firebase não está configurado. Não é necessário fazer logout.");
    return;
  }

  try {
    // Como já verificamos que auth não é null acima, podemos usar ! para indicar ao TypeScript
    await firebaseSignOut(auth!);
  } catch (error) {
    console.error("Erro ao fazer logout:", error);
    throw error;
  }
};

// Escutar mudanças no estado de autenticação
export const onAuthChanged = (callback: (user: FirebaseUser | null) => void) => {
  if (!auth) {
    console.warn("Firebase não está configurado. Nenhuma mudança de estado de autenticação será detectada.");
    // Retorna uma função noop para manter a interface consistente
    return () => {};
  }
  
  // Como já verificamos que auth não é null acima, podemos usar ! para indicar ao TypeScript
  return onAuthStateChanged(auth!, callback);
};

// Função para verificar se o Firebase está disponível
export const isFirebaseAvailable = () => {
  return !!app && !!auth;
};

export { auth };