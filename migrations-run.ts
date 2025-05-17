
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import { Pool } from "@neondatabase/serverless";

// Verificação da variável de ambiente
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL deve ser definido");
}

async function runMigrations() {
  console.log("Iniciando migração do banco de dados...");
  
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);
  
  console.log("Conectado ao banco de dados, aplicando migrações...");
  
  try {
    // Criando as tabelas diretamente
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        email TEXT DEFAULT '',
        password TEXT NOT NULL,
        initial_balance NUMERIC(10, 2) DEFAULT 0 NOT NULL,
        overdraft_limit NUMERIC(10, 2) DEFAULT 0 NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS categories (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        icon TEXT NOT NULL DEFAULT 'ri-question-line'
      );

      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        description TEXT NOT NULL,
        amount NUMERIC(10, 2) NOT NULL,
        date DATE NOT NULL,
        type TEXT NOT NULL,
        category_id INTEGER REFERENCES categories(id),
        attachment TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        is_recurring BOOLEAN DEFAULT false NOT NULL,
        recurring_id INTEGER REFERENCES recurring_transactions(id)
      );

      CREATE TABLE IF NOT EXISTS recurring_transactions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        description TEXT NOT NULL,
        amount NUMERIC(10, 2) NOT NULL,
        type TEXT NOT NULL,
        category_id INTEGER REFERENCES categories(id),
        frequency TEXT NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE,
        last_processed DATE,
        attachment TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);

    // Executar script de seed para categorias padrão
    await pool.query(`
      INSERT INTO categories (name, type, icon) VALUES 
      ('Salário', 'income', 'ri-money-dollar-circle-line'),
      ('Freelance', 'income', 'ri-briefcase-line'),
      ('Investimentos', 'income', 'ri-line-chart-line'),
      ('Vendas', 'income', 'ri-store-line'),
      ('Outras', 'income', 'ri-wallet-line'),
      ('Moradia', 'expense', 'ri-home-line'),
      ('Alimentação', 'expense', 'ri-shopping-cart-line'),
      ('Transporte', 'expense', 'ri-car-line'),
      ('Saúde', 'expense', 'ri-heart-pulse-line'),
      ('Educação', 'expense', 'ri-book-open-line'),
      ('Lazer', 'expense', 'ri-gamepad-line'),
      ('Serviços', 'expense', 'ri-file-list-line'),
      ('Utilidades', 'expense', 'ri-lightbulb-line'),
      ('Outras', 'expense', 'ri-question-line')
      ON CONFLICT DO NOTHING;
    `);
    
    console.log("Migração concluída com sucesso!");
  } catch (error) {
    console.error("Erro durante a migração:", error);
    throw error;
  } finally {
    await pool.end();
  }
}

runMigrations().catch(err => {
  console.error("Falha na migração:", err);
  process.exit(1);
});
