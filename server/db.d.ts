// Arquivo de declaração de tipos para o DB

// Definição de interface para as extensões do banco de dados
export interface DbWithExtensions {
  deleteRecurringTransaction(id: number): Promise<boolean>;
}

// Garantir que a variável dbWithExtensions está disponível como um objeto com qualquer propriedade
declare global {
  interface DbWithAny extends DbWithExtensions, Record<string, any> {}
}

// Declaração de tipo para o banco de dados com extensões
export declare const dbWithExtensions: DbWithAny;