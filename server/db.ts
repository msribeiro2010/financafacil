import { join } from 'path';
import * as schema from "@shared/schema";
import Database from 'better-sqlite3';

// Declaração do tipo para SQLite
declare module 'better-sqlite3' {}

// Caminho para o arquivo SQLite local
const dbPath = join(process.cwd(), 'local_database.db');
console.log(`Usando banco de dados SQLite local em: ${dbPath}`);

// Conectar ao SQLite
const sqlite = new Database(dbPath);

// Criar instância do DB driver
export const db = {
  // Transações simples
  getTransactions: (userId: number, limit?: number) => {
    const sql = `SELECT * FROM transactions WHERE userId = ? ORDER BY date DESC ${limit ? 'LIMIT ' + limit : ''}`;
    return sqlite.prepare(sql).all(userId) as any[];
  },
  getTransactionById: (id: number) => {
    return sqlite.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as any;
  },
  createTransaction: (transaction: any) => {
    const stmt = sqlite.prepare(`
      INSERT INTO transactions 
      (userId, type, description, amount, date, categoryId, isRecurring, recurringId, attachment) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const info = stmt.run(
      transaction.userId,
      transaction.type,
      transaction.description,
      transaction.amount,
      transaction.date,
      transaction.categoryId,
      transaction.isRecurring ? 1 : 0,
      transaction.recurringId,
      transaction.attachment
    );
    
    return { ...transaction, id: info.lastInsertRowid };
  },
  updateTransaction: (id: number, data: any) => {
    // Construir consulta dinamicamente com base nas propriedades presentes
    let setClause = Object.keys(data).map(key => `${key} = ?`).join(', ');
    let values = Object.values(data);
    
    // Adicionar ID no final dos valores
    values.push(id);
    
    const sql = `UPDATE transactions SET ${setClause} WHERE id = ?`;
    sqlite.prepare(sql).run(...values);
    
    // Buscar transação atualizada
    return sqlite.prepare('SELECT * FROM transactions WHERE id = ?').get(id) as any;
  },
  deleteTransaction: (id: number) => {
    const result = sqlite.prepare('DELETE FROM transactions WHERE id = ?').run(id);
    return result.changes > 0;
  },
  
  // Transações recorrentes
  getRecurringTransactions: (userId: number) => {
    return sqlite.prepare('SELECT * FROM recurring_transactions WHERE userId = ?').all(userId) as any[];
  },
  getRecurringTransactionById: (id: number) => {
    return sqlite.prepare('SELECT * FROM recurring_transactions WHERE id = ?').get(id) as any;
  },
  createRecurringTransaction: (transaction: any) => {
    const stmt = sqlite.prepare(`
      INSERT INTO recurring_transactions 
      (userId, type, description, amount, frequency, startDate, endDate, categoryId, attachment) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const info = stmt.run(
      transaction.userId,
      transaction.type,
      transaction.description,
      transaction.amount,
      transaction.frequency,
      transaction.startDate,
      transaction.endDate,
      transaction.categoryId,
      transaction.attachment
    );
    
    return { ...transaction, id: info.lastInsertRowid };
  },
  updateRecurringTransaction: (id: number, data: any) => {
    // Construir consulta dinamicamente com base nas propriedades presentes
    let setClause = Object.keys(data).map(key => `${key} = ?`).join(', ');
    let values = Object.values(data);
    
    // Adicionar ID no final dos valores
    values.push(id);
    
    const sql = `UPDATE recurring_transactions SET ${setClause} WHERE id = ?`;
    sqlite.prepare(sql).run(...values);
    
    // Buscar transação atualizada
    return sqlite.prepare('SELECT * FROM recurring_transactions WHERE id = ?').get(id) as any;
  },
  deleteRecurringTransaction: (id: number) => {
    const result = sqlite.prepare('DELETE FROM recurring_transactions WHERE id = ?').run(id);
    return result.changes > 0;
  },
  
  // Usuários
  getUser: (id: number) => {
    return sqlite.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
  },
  getUserByUsername: (username: string) => {
    return sqlite.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
  },
  createUser: (user: any) => {
    const stmt = sqlite.prepare(`
      INSERT INTO users (username, password, email, initialBalance, overdraftLimit) 
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const info = stmt.run(
      user.username,
      user.password,
      user.email,
      user.initialBalance || '0',
      user.overdraftLimit || '0'
    );
    
    return { ...user, id: info.lastInsertRowid };
  },
  updateUserSettings: (userId: number, initialBalance: string, overdraftLimit: string) => {
    sqlite.prepare('UPDATE users SET initialBalance = ?, overdraftLimit = ? WHERE id = ?')
      .run(initialBalance, overdraftLimit, userId);
    
    return sqlite.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
  },
  
  // Categorias
  getCategories: (type?: string) => {
    if (type) {
      return sqlite.prepare('SELECT * FROM categories WHERE type = ?').all(type) as any[];
    }
    return sqlite.prepare('SELECT * FROM categories').all() as any[];
  },
  getCategoryById: (id: number) => {
    return sqlite.prepare('SELECT * FROM categories WHERE id = ?').get(id) as any;
  },
  createCategory: (category: any) => {
    const stmt = sqlite.prepare(`
      INSERT INTO categories (name, type, icon) 
      VALUES (?, ?, ?)
    `);
    
    const info = stmt.run(category.name, category.type, category.icon);
    return { ...category, id: info.lastInsertRowid };
  },
  
  // Helpers
  execute: (sql: string) => {
    return sqlite.exec(sql);
  },
  run: (sql: string, ...params: any[]) => {
    return sqlite.prepare(sql).run(...params);
  },
  select: (sql: string, ...params: any[]) => {
    return sqlite.prepare(sql).all(...params);
  }
};

// Initialize database tables
try {
  db.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      password TEXT NOT NULL,
      email TEXT,
      initialBalance TEXT DEFAULT '0',
      overdraftLimit TEXT DEFAULT '0'
    );
    
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      icon TEXT NOT NULL
    );
    
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      amount TEXT NOT NULL,
      date TEXT NOT NULL,
      categoryId INTEGER,
      isRecurring BOOLEAN DEFAULT FALSE,
      recurringId INTEGER,
      attachment TEXT
    );
    
    CREATE TABLE IF NOT EXISTS recurring_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      amount TEXT NOT NULL,
      frequency TEXT NOT NULL,
      startDate TEXT NOT NULL,
      endDate TEXT,
      categoryId INTEGER,
      attachment TEXT
    );
  `);
  
  // Check if demo user exists
  const userCount = sqlite.prepare('SELECT COUNT(*) as count FROM users').get() as any;
  if (!userCount || userCount.count === 0) {
    console.log('Criando usuário de demonstração...');
    db.createUser({
      username: 'demo',
      password: 'demo123',
      initialBalance: '6103.45',
      overdraftLimit: '1000.00'
    });
  }
  
  console.log('Banco de dados SQLite inicializado com sucesso!');
} catch (error) {
  console.error('Erro ao inicializar banco de dados SQLite:', error);
}