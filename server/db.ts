import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { eq } from 'drizzle-orm';
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

// Exportamos o db original com as funções extras
export const dbWithExtensions = {
  ...db,
  deleteRecurringTransaction: async (id: number): Promise<boolean> => {
    try {
      // Tenta excluir a transação recorrente
      const result = await pool.query('DELETE FROM recurring_transactions WHERE id = $1', [id]);
      
      // Se pelo menos uma linha foi afetada, consideramos sucesso
      return result.rowCount ? result.rowCount > 0 : false;
    } catch (error) {
      console.error(`Erro ao excluir transação recorrente ${id}:`, error);
      return false;
    }
  }
};