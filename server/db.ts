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
      // Tenta excluir a transação recorrente com SQL bruto para maior confiabilidade
      const result = await pool.query('DELETE FROM recurring_transactions WHERE id = $1 RETURNING id', [id]);
      
      // Verificamos se a operação encontrou e excluiu algum registro
      const success = result.rows && result.rows.length > 0;
      console.log(`Exclusão da transação recorrente ${id}: ${success ? 'sucesso' : 'não encontrada'}`);
      return success;
    } catch (error) {
      console.error(`Erro ao excluir transação recorrente ${id}:`, error);
      return false;
    }
  }
};