import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });

// Adicionar funções especiais para SQLite que precisamos
const dbExtensions = {
  // Função especial para excluir transações recorrentes, garantindo compatibilidade
  deleteRecurringTransaction: async (id: number): Promise<boolean> => {
    try {
      // Primeiro verificamos se a transação existe
      const result = await db.query.recurringTransactions.findFirst({
        where: (transaction, { eq }) => eq(transaction.id, id)
      });
      
      if (!result) {
        return false; // Não existe esta transação
      }
      
      // Se existir, excluímos
      await db.delete(schema.recurringTransactions)
        .where((transaction, { eq }) => eq(transaction.id, id));
      
      return true;
    } catch (error) {
      console.error(`Erro ao excluir transação recorrente ${id}:`, error);
      return false;
    }
  }
};

// Exportamos o db original com as funções extras
export const dbWithExtensions = {
  ...db,
  deleteRecurringTransaction: async (id: number): Promise<boolean> => {
    try {
      await db.delete(schema.recurringTransactions)
        .where(eq(schema.recurringTransactions.id, id));
      return true;
    } catch (error) {
      console.error(`Erro ao excluir transação recorrente ${id}:`, error);
      return false;
    }
  }
};