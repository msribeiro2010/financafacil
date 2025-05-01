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
  // Funções de gerenciamento de usuário
  getUser: async (id: number) => {
    console.log(`[DEBUG] Obtendo usuário com ID=${id}`);
    try {
      // Usamos SQL direto para ter mais controle e logging
      const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
      console.log(`[DEBUG] Resultado da busca: ${result.rows.length} usuários encontrados`);
      return result.rows.length > 0 ? result.rows[0] : undefined;
    } catch (error) {
      console.error(`[ERRO] Falha ao buscar usuário com ID=${id}:`, error);
      return undefined;
    }
  },
  
  getUserByUsername: async (username: string) => {
    console.log(`[DEBUG] Obtendo usuário com username=${username}`);
    try {
      const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
      console.log(`[DEBUG] Resultado da busca: ${result.rows.length} usuários encontrados`);
      return result.rows.length > 0 ? result.rows[0] : undefined;
    } catch (error) {
      console.error(`[ERRO] Falha ao buscar usuário com username=${username}:`, error);
      return undefined;
    }
  },
  
  createUser: async (userData: any) => {
    console.log(`[DEBUG] Criando novo usuário:`, userData);
    try {
      const result = await pool.query(
        'INSERT INTO users (username, email, password, initial_balance, overdraft_limit, created_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [userData.username, userData.email, userData.password, userData.initialBalance || '0.00', userData.overdraftLimit || '0.00', new Date()]
      );
      console.log(`[DEBUG] Usuário criado com sucesso:`, result.rows[0]);
      return result.rows[0];
    } catch (error) {
      console.error(`[ERRO] Falha ao criar usuário:`, error);
      throw error;
    }
  },
  
  // Função para exclusão de transações recorrentes
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