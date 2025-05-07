import { 
  users, User, InsertUser, 
  transactions, Transaction, InsertTransaction, 
  recurringTransactions, RecurringTransaction, InsertRecurringTransaction,
  categories, Category, InsertCategory, 
  TransactionSummary, CategorySummary
} from "@shared/schema";
import { dbWithExtensions as db } from "./db";
import { eq, and, gte, lte, desc, count } from "drizzle-orm";

// Define storage interface
export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserSettings(userId: number, initialBalance: string, overdraftLimit: string): Promise<User>;
  
  // Category methods
  getCategories(type?: string): Promise<Category[]>;
  getCategoryById(id: number): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  
  // Transaction methods
  getTransactions(userId: number, limit?: number): Promise<Transaction[]>;
  getTransactionById(id: number): Promise<Transaction | undefined>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  updateTransaction(id: number, transaction: Partial<InsertTransaction>): Promise<Transaction>;
  deleteTransaction(id: number): Promise<boolean>;
  
  // Recurring transaction methods
  getRecurringTransactions(userId: number): Promise<RecurringTransaction[]>;
  getRecurringTransactionById(id: number): Promise<RecurringTransaction | undefined>;
  createRecurringTransaction(transaction: InsertRecurringTransaction): Promise<RecurringTransaction>;
  updateRecurringTransaction(id: number, transaction: Partial<InsertRecurringTransaction>): Promise<RecurringTransaction>;
  deleteRecurringTransaction(id: number): Promise<boolean>;
  
  // Summary and reporting
  getTransactionSummary(userId: number): Promise<TransactionSummary>;
  getCategorySummary(userId: number, type: string): Promise<CategorySummary[]>;
  getUpcomingBills(userId: number): Promise<Transaction[]>;
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    console.log(`[DEBUG] Buscando usuário com ID: ${id}`);
    // Importante: usar await aqui também para garantir que a Promise seja resolvida
    const user = await db.getUser(id);
    console.log(`[DEBUG] Usuário encontrado:`, user ? 'Sim' : 'Não');
    return user;
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    console.log(`[DEBUG] Buscando usuário com username: ${username}`);
    // Importante: await é necessário aqui porque getUserByUsername retorna uma Promise
    const user = await db.getUserByUsername(username);
    console.log(`[DEBUG] Usuário encontrado:`, user ? 'Sim' : 'Não');
    return user;
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    if (!email) return undefined;
    
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email));
      
    return user;
  }
  
  async createUser(user: InsertUser): Promise<User> {
    console.log(`[DEBUG] Criando novo usuário:`, user.username);
    // Importante: adicionar await aqui também
    const newUser = await db.createUser(user);
    console.log(`[DEBUG] Novo usuário criado com ID:`, newUser.id);
    
    // Se for o primeiro usuário, inicialize o banco de dados
    try {
      const userCount = await db.select('SELECT COUNT(*) as count FROM users') as any[];
      console.log(`[DEBUG] Contagem de usuários:`, userCount);
      if (userCount && userCount.length > 0 && userCount[0].count === 1) {
        console.log(`[DEBUG] Inicializando banco de dados para o primeiro usuário`);
        await this.initializeDefaultCategories();
        await this.addDemoTransactions(newUser.id);
      }
    } catch (error) {
      console.error('[ERRO] Erro ao verificar quantidade de usuários:', error);
    }
    
    return newUser;
  }
  
  async updateUserSettings(userId: number, initialBalance: string, overdraftLimit: string): Promise<User> {
    const [updatedUser] = await db
      .update(users)
      .set({ initialBalance, overdraftLimit })
      .where(eq(users.id, userId))
      .returning();
    
    if (!updatedUser) {
      throw new Error("User not found");
    }
    
    return updatedUser;
  }
  
  // Category methods
  async getCategories(type?: string): Promise<Category[]> {
    if (type) {
      return db.select().from(categories).where(eq(categories.type, type));
    }
    return db.select().from(categories);
  }
  
  async getCategoryById(id: number): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.id, id));
    return category;
  }
  
  async createCategory(category: InsertCategory): Promise<Category> {
    const [newCategory] = await db.insert(categories).values(category).returning();
    return newCategory;
  }
  
  // Transaction methods
  async getTransactions(userId: number, limit?: number): Promise<Transaction[]> {
    let queryResult = await db.select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.date));
    
    if (limit) {
      return queryResult.slice(0, limit);
    }
    
    return queryResult;
  }
  
  async getTransactionById(id: number): Promise<Transaction | undefined> {
    const [transaction] = await db.select().from(transactions).where(eq(transactions.id, id));
    return transaction;
  }
  
  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const [newTransaction] = await db.insert(transactions).values(transaction).returning();
    return newTransaction;
  }
  
  async updateTransaction(id: number, transaction: Partial<InsertTransaction>): Promise<Transaction> {
    const [updatedTransaction] = await db
      .update(transactions)
      .set(transaction)
      .where(eq(transactions.id, id))
      .returning();
    
    if (!updatedTransaction) {
      throw new Error("Transaction not found");
    }
    
    return updatedTransaction;
  }
  
  async deleteTransaction(id: number): Promise<boolean> {
    try {
      // Para SQLite, precisamos modificar a abordagem
      // Primeiro buscamos a transação para verificar se existe
      const transaction = await this.getTransactionById(id);
      
      if (!transaction) {
        return false;
      }
      
      // Executamos a exclusão sem tentar retornar dados
      db.delete(transactions)
        .where(eq(transactions.id, id))
        .run();
      
      // Em SQLite, assumimos que a exclusão foi bem-sucedida se o registro existia
      return true;
    } catch (error) {
      console.error(`Erro ao excluir transação ${id}:`, error);
      throw error;
    }
  }
  
  // Recurring transaction methods
  async getRecurringTransactions(userId: number): Promise<RecurringTransaction[]> {
    return db.getRecurringTransactions(userId);
  }
  
  async getRecurringTransactionById(id: number): Promise<RecurringTransaction | undefined> {
    const [transaction] = await db
      .select()
      .from(recurringTransactions)
      .where(eq(recurringTransactions.id, id));
    
    return transaction;
  }
  
  async createRecurringTransaction(transaction: InsertRecurringTransaction): Promise<RecurringTransaction> {
    const [newTransaction] = await db
      .insert(recurringTransactions)
      .values(transaction)
      .returning();
    
    return newTransaction;
  }
  
  async updateRecurringTransaction(id: number, transaction: Partial<InsertRecurringTransaction>): Promise<RecurringTransaction> {
    const [updatedTransaction] = await db
      .update(recurringTransactions)
      .set(transaction)
      .where(eq(recurringTransactions.id, id))
      .returning();
    
    if (!updatedTransaction) {
      throw new Error("Recurring transaction not found");
    }
    
    return updatedTransaction;
  }
  
  async deleteRecurringTransaction(id: number): Promise<boolean> {
    try {
      console.log(`[Storage] Solicitada exclusão da transação recorrente ${id}`);
      
      // Primeiro verificamos se a transação existe
      const transaction = await this.getRecurringTransactionById(id);
      if (!transaction) {
        console.log(`[Storage] Transação ${id} não encontrada na pré-verificação`);
        return false;
      }
      
      console.log(`[Storage] Transação ${id} encontrada, chamando dbWithExtensions.deleteRecurringTransaction`);
      const { dbWithExtensions } = await import('./db');
      return await dbWithExtensions.deleteRecurringTransaction(id);
    } catch (error) {
      console.error(`[Storage] Erro ao excluir transação recorrente ${id}:`, error);
      return false; // Retornamos false em vez de lançar erro para maior robustez
    }
  }
  
  // Summary and reporting
  async getTransactionSummary(userId: number): Promise<TransactionSummary> {
    const user = await this.getUser(userId);
    
    if (!user) {
      throw new Error("User not found");
    }
    
    // Usar a função do dbWithExtensions em vez do método da classe
    const { dbWithExtensions } = await import('./db');
    const transactions = await dbWithExtensions.getTransactions(userId);
    
    // Buscando dados do usuário diretamente do banco para garantir valores atualizados
    const { pool } = await import('./db');
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    
    if (userResult.rows.length === 0) {
      throw new Error("Usuário não encontrado no banco de dados");
    }
    
    // Usando dados diretamente do banco
    const userFromDb = userResult.rows[0];
    
    // Parse numeric values - extraindo valores do banco de dados
    const initialBalanceStr = userFromDb.initial_balance || '0';
    const overdraftLimitStr = userFromDb.overdraft_limit || '0';
    
    console.log('DEBUG [getTransactionSummary] Valores encontrados direto do banco:', {
      userId,
      initialBalanceFromDb: userFromDb.initial_balance,
      overdraftLimitFromDb: userFromDb.overdraft_limit,
      allUserProps: Object.keys(userFromDb)
    });
    
    // Convertendo para números
    const initialBalance = parseFloat(initialBalanceStr);
    const overdraftLimit = parseFloat(overdraftLimitStr);
    
    console.log('DEBUG [getTransactionSummary] Valores convertidos:', {
      initialBalance,
      overdraftLimit
    });
    
    let totalIncome = 0;
    let totalExpenses = 0;
    
    transactions.forEach(transaction => {
      const amount = parseFloat(transaction.amount as string);
      if (transaction.type === "income") {
        totalIncome += amount;
      } else {
        totalExpenses += amount;
      }
    });
    
    // Calcula o saldo atual considerando o saldo inicial + receitas - despesas
    const currentBalance = initialBalance + totalIncome - totalExpenses;
    
    console.log('DEBUG [getTransactionSummary] Cálculo do saldo atual:', {
      initialBalance,
      totalIncome,
      totalExpenses,
      currentBalance
    });
    // Se o saldo for negativo mas estiver dentro do limite do cheque especial,
    // o sistema ainda permite o gasto, usando o cheque especial como um buffer
    
    // For projected balance, include upcoming recurring transactions
    let projectedBalance = currentBalance;
    
    // Get recurring transactions and calculate projected balance
    const recurringTransactions = await dbWithExtensions.getRecurringTransactions(userId);
    const today = new Date();
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    for (const transaction of recurringTransactions) {
      const startDate = new Date(transaction.startDate || transaction.start_date);
      
      if (transaction.frequency === "monthly" && startDate.getDate() > today.getDate() && startDate.getDate() <= endOfMonth.getDate()) {
        const amount = parseFloat(transaction.amount as string);
        if (transaction.type === "income") {
          projectedBalance += amount;
        } else {
          projectedBalance -= amount;
        }
      }
    }
    
    return {
      totalIncome,
      totalExpenses,
      currentBalance,
      projectedBalance
    };
  }
  
  async getCategorySummary(userId: number, type: string): Promise<CategorySummary[]> {
    // Usar a função do dbWithExtensions em vez do método da classe
    const { dbWithExtensions } = await import('./db');
    const transactionsList = await dbWithExtensions.getTransactions(userId);
    const filteredTransactions = transactionsList.filter(t => t.type === type);
    
    const categorySums = new Map<number, number>();
    let total = 0;
    
    // Calculate sum by category
    for (const transaction of filteredTransactions) {
      // Verifica se temos category_id (banco) ou categoryId (app)
      const catId = transaction.categoryId || transaction.category_id;
      if (catId) {
        const amount = parseFloat(transaction.amount as string);
        const current = categorySums.get(catId) || 0;
        categorySums.set(catId, current + amount);
        total += amount;
      }
    }
    
    // Convert to CategorySummary objects
    const result: CategorySummary[] = [];
    for (const [categoryId, sum] of categorySums.entries()) {
      const category = await this.getCategoryById(categoryId);
      if (category) {
        result.push({
          categoryId,
          name: category.name,
          total: sum,
          percentage: total > 0 ? (sum / total) * 100 : 0,
          icon: category.icon
        });
      }
    }
    
    // Sort by total in descending order
    return result.sort((a, b) => b.total - a.total);
  }
  
  async getUpcomingBills(userId: number): Promise<Transaction[]> {
    const today = new Date();
    const thirtyDaysLater = new Date();
    thirtyDaysLater.setDate(today.getDate() + 30);
    
    // Usar a função do dbWithExtensions em vez do método da classe
    const { dbWithExtensions } = await import('./db');
    const allTransactions = await dbWithExtensions.getTransactions(userId);
    
    // Filter for upcoming expense transactions
    return allTransactions
      .filter(transaction => 
        transaction.type === "expense" &&
        new Date(transaction.date) >= today &&
        new Date(transaction.date) <= thirtyDaysLater
      )
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }
  
  // Helper methods for initial setup
  private async initializeDefaultCategories() {
    const incomeCategories = [
      { name: "Salário", type: "income", icon: "ri-money-dollar-circle-line" },
      { name: "Freelance", type: "income", icon: "ri-briefcase-line" },
      { name: "Investimentos", type: "income", icon: "ri-line-chart-line" },
      { name: "Vendas", type: "income", icon: "ri-store-line" },
      { name: "Outras", type: "income", icon: "ri-wallet-line" }
    ];
    
    const expenseCategories = [
      { name: "Moradia", type: "expense", icon: "ri-home-line" },
      { name: "Alimentação", type: "expense", icon: "ri-shopping-cart-line" },
      { name: "Transporte", type: "expense", icon: "ri-car-line" },
      { name: "Saúde", type: "expense", icon: "ri-heart-pulse-line" },
      { name: "Educação", type: "expense", icon: "ri-book-open-line" },
      { name: "Lazer", type: "expense", icon: "ri-gamepad-line" },
      { name: "Serviços", type: "expense", icon: "ri-file-list-line" },
      { name: "Utilidades", type: "expense", icon: "ri-lightbulb-line" },
      { name: "Outras", type: "expense", icon: "ri-question-line" }
    ];
    
    for (const category of [...incomeCategories, ...expenseCategories]) {
      await this.createCategory(category);
    }
  }
  
  private async addDemoTransactions(userId: number) {
    // Get all categories
    const allCategories = await this.getCategories();
    
    // Find category IDs by name
    const findCategoryId = (name: string, type: string) => {
      const found = allCategories.find(c => c.name === name && c.type === type);
      return found ? found.id : null;
    };
    
    const salaryCategory = findCategoryId("Salário", "income") || 1;
    const housingCategory = findCategoryId("Moradia", "expense") || 6;
    const foodCategory = findCategoryId("Alimentação", "expense") || 7;
    const transportCategory = findCategoryId("Transporte", "expense") || 8;
    const utilitiesCategory = findCategoryId("Utilidades", "expense") || 13;
    
    const today = new Date();
    const thisMonth = today.getMonth();
    const thisYear = today.getFullYear();
    
    // Create some transactions
    const transactions: InsertTransaction[] = [
      {
        userId,
        description: "Salário",
        amount: "3800.00",
        date: new Date(thisYear, thisMonth, 10).toISOString(),
        type: "income",
        categoryId: salaryCategory,
        isRecurring: true
      },
      {
        userId,
        description: "Aluguel",
        amount: "850.00",
        date: new Date(thisYear, thisMonth, 5).toISOString(),
        type: "expense",
        categoryId: housingCategory,
        isRecurring: true
      },
      {
        userId,
        description: "Supermercado",
        amount: "245.90",
        date: new Date(thisYear, thisMonth, 15).toISOString(),
        type: "expense",
        categoryId: foodCategory,
        isRecurring: false
      },
      {
        userId,
        description: "Combustível",
        amount: "120.00",
        date: new Date(thisYear, thisMonth, 3).toISOString(),
        type: "expense",
        categoryId: transportCategory,
        isRecurring: false
      },
      {
        userId,
        description: "Internet",
        amount: "120.00",
        date: new Date(thisYear, thisMonth + 1, today.getDate() + 2).toISOString(),
        type: "expense",
        categoryId: utilitiesCategory,
        isRecurring: true
      },
      {
        userId,
        description: "Energia Elétrica",
        amount: "189.75",
        date: new Date().toISOString(),
        type: "expense",
        categoryId: utilitiesCategory,
        isRecurring: true
      }
    ];
    
    // Add recurring transactions
    const recurringTransactions: InsertRecurringTransaction[] = [
      {
        userId,
        description: "Salário",
        amount: "3800.00",
        type: "income",
        categoryId: salaryCategory,
        frequency: "monthly",
        startDate: new Date(thisYear, thisMonth, 10).toISOString()
      },
      {
        userId,
        description: "Aluguel",
        amount: "850.00",
        type: "expense",
        categoryId: housingCategory,
        frequency: "monthly",
        startDate: new Date(thisYear, thisMonth, 5).toISOString()
      },
      {
        userId,
        description: "Internet",
        amount: "120.00",
        type: "expense",
        categoryId: utilitiesCategory,
        frequency: "monthly",
        startDate: new Date(thisYear, thisMonth, 25).toISOString()
      },
      {
        userId,
        description: "Energia Elétrica",
        amount: "189.75",
        type: "expense",
        categoryId: utilitiesCategory,
        frequency: "monthly",
        startDate: new Date().toISOString()
      }
    ];
    
    // Create transactions
    for (const transaction of transactions) {
      await this.createTransaction(transaction);
    }
    
    // Create recurring transactions
    for (const transaction of recurringTransactions) {
      await this.createRecurringTransaction(transaction);
    }
  }
}

export const storage = new DatabaseStorage();
