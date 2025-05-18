
// Script para adicionar a coluna status à tabela transactions
import { pool, db } from '../server/db';

console.log('[SCRIPT] Verificando e adicionando coluna status à tabela transactions...');

async function addStatusColumn() {
  try {
    // Verificar estrutura atual da tabela transactions
    const tableInfoQuery = "PRAGMA table_info(transactions)";
    const tableInfo = await db.run(tableInfoQuery);
    console.log('[SCRIPT] Estrutura atual da tabela:', tableInfo);
    
    // Verificar se a coluna status já existe
    const hasStatusColumn = tableInfo.some((column: any) => column.name === 'status');
    
    if (!hasStatusColumn) {
      console.log('[SCRIPT] Coluna status não encontrada. Adicionando...');
      
      // SQLite não tem "add column if not exists"
      await db.run(`ALTER TABLE transactions ADD COLUMN status TEXT DEFAULT 'a_pagar'`);
      console.log('[SCRIPT] Coluna status adicionada com sucesso!');
      
      // Atualizar valores iniciais
      // Marcar receitas como pagas por padrão
      await db.run(`UPDATE transactions SET status = 'paga' WHERE type = 'income'`);
      console.log('[SCRIPT] Receitas marcadas como pagas');
      
      // Marcar despesas vencidas como atrasadas
      const today = new Date().toISOString().split('T')[0];
      await db.run(
        `UPDATE transactions SET status = 'atrasada' 
         WHERE type = 'expense' AND date < ? AND (status = 'a_pagar' OR status IS NULL)`,
        [today]
      );
      console.log('[SCRIPT] Despesas vencidas marcadas como atrasadas');
    } else {
      console.log('[SCRIPT] A coluna status já existe.');
    }
    
    // Verificar a estrutura atualizada
    const updatedTableInfo = await db.run(tableInfoQuery);
    console.log('[SCRIPT] Estrutura final da tabela:', updatedTableInfo);
    
    return true;
  } catch (error) {
    console.error('[SCRIPT] Erro ao adicionar coluna status:', error);
    return false;
  }
}

addStatusColumn()
  .then((success) => {
    if (success) {
      console.log('[SCRIPT] Script de adição de coluna status finalizado com sucesso!');
    } else {
      console.log('[SCRIPT] Script finalizado com erros. Verifique os logs acima.');
    }
    process.exit(0);
  })
  .catch((err) => {
    console.error('[SCRIPT] Erro crítico ao executar script:', err);
    process.exit(1);
  });
