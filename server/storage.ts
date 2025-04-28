import { 
  users, User, InsertUser, 
  transactions, Transaction, InsertTransaction, 
  recurringTransactions, RecurringTransaction, InsertRecurringTransaction,
  categories, Category, InsertCategory, 
  TransactionSummary, CategorySummary
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, desc, count } from "drizzle-orm";

// Define storage interface
export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
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
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    console.log(`Looking for user with username: ${username}`);
    const result = await db.select().from(users).where(eq(users.username, username));
    console.log(`Found users:`, result);
    const [user] = result;
    return user;
  }
  
  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    
    // If this is the first user, initialize the database
    const userCount = await db.select({ count: count() }).from(users);
    if (userCount[0].count === 1) {
      await this.initializeDefaultCategories();
      await this.addDemoTransactions(newUser.id);
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
    const [deleted] = await db
      .delete(transactions)
      .where(eq(transactions.id, id))
      .returning({ id: transactions.id });
    
    return !!deleted;
  }
  
  // Recurring transaction methods
  async getRecurringTransactions(userId: number): Promise<RecurringTransaction[]> {
    return db.select()
      .from(recurringTransactions)
      .where(eq(recurringTransactions.userId, userId))
      .orderBy(recurringTransactions.startDate);
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
    const [deleted] = await db
      .delete(recurringTransactions)
      .where(eq(recurringTransactions.id, id))
      .returning({ id: recurringTransactions.id });
    
    return !!deleted;
  }
  
  // Summary and reporting
  async getTransactionSummary(userId: number): Promise<TransactionSummary> {
    const user = await this.getUser(userId);
    
    if (!user) {
      throw new Error("User not found");
    }
    
    const transactions = await this.getTransactions(userId);
    
    // Parse numeric values
    const initialBalance = parseFloat(user.initialBalance as string);
    
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
    
    const currentBalance = initialBalance + totalIncome - totalExpenses;
    
    // For projected balance, include upcoming recurring transactions
    let projectedBalance = currentBalance;
    
    // Get recurring transactions and calculate projected balance
    const recurringTransactions = await this.getRecurringTransactions(userId);
    const today = new Date();
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    for (const transaction of recurringTransactions) {
      const startDate = new Date(transaction.startDate);
      
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
    const transactionsList = await this.getTransactions(userId);
    const filteredTransactions = transactionsList.filter(t => t.type === type);
    
    const categorySums = new Map<number, number>();
    let total = 0;
    
    // Calculate sum by category
    for (const transaction of filteredTransactions) {
      if (transaction.categoryId) {
        const amount = parseFloat(transaction.amount as string);
        const current = categorySums.get(transaction.categoryId) || 0;
        categorySums.set(transaction.categoryId, current + amount);
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
    
    // Get all transactions for the user
    const allTransactions = await this.getTransactions(userId);
    
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
