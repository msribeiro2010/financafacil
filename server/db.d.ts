// Arquivo de declaração de tipos para o DB

// Definição de interface para as extensões do banco de dados
export interface DbWithExtensions {
  // Funções de gerenciamento de usuário
  getUser(id: number): Promise<any | undefined>;
  getUserByUsername(username: string): Promise<any | undefined>;
  createUser(userData: any): Promise<any>;
  
  // Funções de transações recorrentes
  deleteRecurringTransaction(id: number): Promise<boolean>;
}

// Garantir que a variável dbWithExtensions está disponível como um objeto com qualquer propriedade
declare global {
  interface DbWithAny extends DbWithExtensions, Record<string, any> {}
}

// Declaração de tipo para o banco de dados com extensões
export declare const dbWithExtensions: DbWithAny;