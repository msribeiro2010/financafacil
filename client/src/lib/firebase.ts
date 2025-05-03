import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged,
  signOut as firebaseSignOut,
  User as FirebaseUser
} from "firebase/auth";

// Log das variáveis de ambiente para debug
console.log("Firebase API Key:", import.meta.env.VITE_FIREBASE_API_KEY ? "Definida" : "Não definida");
console.log("Firebase Project ID:", import.meta.env.VITE_FIREBASE_PROJECT_ID ? "Definido" : "Não definido");
console.log("Firebase App ID:", import.meta.env.VITE_FIREBASE_APP_ID ? "Definido" : "Não definido");

// Configuração do Firebase com valores das variáveis de ambiente
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.appspot.com`,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Função para fazer login com Google
export const signInWithGoogle = async () => {
  try {
    // Adiciona escopo ao provedor do Google
    googleProvider.addScope('email');
    googleProvider.addScope('profile');
    
    console.log("Iniciando login com Google...");
    const result = await signInWithPopup(auth, googleProvider);
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
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error("Erro ao fazer logout:", error);
    throw error;
  }
};

// Escutar mudanças no estado de autenticação
export const onAuthChanged = (callback: (user: FirebaseUser | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

export { auth };