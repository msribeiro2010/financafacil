// Arquivo de declaração de tipos para o DB

declare module './db' {
  export interface DbWithExtensions {
    deleteRecurringTransaction(id: number): Promise<boolean>;
    // Adicione aqui outras funções necessárias
  }
  
  // Definimos que dbWithExtensions inclui as extensões e o db original
  export const dbWithExtensions: DbWithExtensions & Record<string, any>;
}