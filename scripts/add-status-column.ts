
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../shared/schema';
import * as readline from 'readline';

const main = async () => {
  console.log('Conectando ao banco de dados...');
  
  // Criar conexão com o banco de dados
  const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/postgres';
  const client = postgres(connectionString);
  const db = drizzle(client, { schema });

  try {
    console.log('Verificando se a coluna status já existe...');
    
    // Verificar se a coluna já existe
    const columnsResult = await client`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'transactions' 
      AND column_name = 'status'
    `;

    if (columnsResult.length === 0) {
      console.log('Adicionando coluna status à tabela transactions...');
      
      // Adicionar a coluna status
      await client`
        ALTER TABLE transactions 
        ADD COLUMN status TEXT NOT NULL DEFAULT 'a_pagar'
      `;
      
      console.log('Coluna status adicionada com sucesso!');
    } else {
      console.log('A coluna status já existe na tabela transactions.');
    }

    // Atualizar status das transações vencidas
    console.log('Atualizando status de transações vencidas...');
    const today = new Date().toISOString().split('T')[0];
    
    const updateResult = await client`
      UPDATE transactions
      SET status = 'atrasada'
      WHERE type = 'expense'
      AND date < ${today}
      AND status = 'a_pagar'
    `;
    
    console.log(`${updateResult.count} transações atualizadas para 'atrasada'.`);
    
    console.log('Migração concluída com sucesso!');
  } catch (error) {
    console.error('Erro durante a migração:', error);
  } finally {
    await client.end();
  }
};

main().catch(console.error);
