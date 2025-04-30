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
    console.log(`[DEBUG] Iniciando exclusão da transação recorrente #${id}`);
    try {
      // Primeiro verificamos se a transação existe
      const checkResult = await pool.query('SELECT id FROM recurring_transactions WHERE id = $1', [id]);
      console.log(`[DEBUG] Verificação prévia: ${checkResult.rows.length} transações encontradas com ID=${id}`);
      
      if (checkResult.rows.length === 0) {
        console.log(`[DEBUG] Transação #${id} não encontrada na verificação prévia`);
        return false;
      }

      // Tenta excluir a transação recorrente com SQL bruto para maior confiabilidade
      console.log(`[DEBUG] Executando DELETE para transação recorrente #${id}`);
      const result = await pool.query('DELETE FROM recurring_transactions WHERE id = $1 RETURNING id', [id]);
      
      // Verificamos se a operação encontrou e excluiu algum registro
      const success = result.rows && result.rows.length > 0;
      console.log(`[DEBUG] Resultado da exclusão: ${success ? 'SUCESSO' : 'FALHA'}, rows afetadas: ${result.rowCount}`);
      if (result.rows) {
        console.log(`[DEBUG] IDs retornados no RETURNING: ${JSON.stringify(result.rows)}`);
      }
      return success;
    } catch (error) {
      console.error(`[ERRO] Falha ao excluir transação recorrente #${id}:`, error);
      return false;
    }
  }
};