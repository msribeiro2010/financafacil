import { 
  User, InsertUser, Transaction, InsertTransaction, 
  RecurringTransaction, InsertRecurringTransaction,
  Category, InsertCategory, TransactionSummary, CategorySummary
} from "@shared/schema";
import path from "path";
import fs from "fs";

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

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private categories: Map<number, Category>;
  private transactions: Map<number, Transaction>;
  private recurringTransactions: Map<number, RecurringTransaction>;
  private userIdCounter: number;
  private categoryIdCounter: number;
  private transactionIdCounter: number;
  private recurringTransactionIdCounter: number;
  
  constructor() {
    this.users = new Map();
    this.categories = new Map();
    this.transactions = new Map();
    this.recurringTransactions = new Map();
    this.userIdCounter = 1;
    this.categoryIdCounter = 1;
    this.transactionIdCounter = 1;
    this.recurringTransactionIdCounter = 1;
    
    // Initialize with default categories
    this.initializeDefaultCategories();
    
    // Create a demo user for testing
    this.createUser({
      username: "demo",
      password: "demo123",
      initialBalance: "1800.00",
      overdraftLimit: "1000.00"
    });
  }
  
  // Initialize default categories
  private initializeDefaultCategories() {
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
    
    [...incomeCategories, ...expenseCategories].forEach(cat => {
      this.createCategory(cat);
    });
  }
  
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    for (const user of this.users.values()) {
      if (user.username === username) {
        return user;
      }
    }
    return undefined;
  }
  
  async createUser(user: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const newUser: User = {
      id,
      ...user,
      createdAt: new Date()
    };
    this.users.set(id, newUser);
    
    // Add some default transactions for demo
    if (user.username === "demo") {
      this.addDemoTransactions(id);
    }
    
    return newUser;
  }
  
  async updateUserSettings(userId: number, initialBalance: string, overdraftLimit: string): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) throw new Error("User not found");
    
    const updatedUser: User = {
      ...user,
      initialBalance,
      overdraftLimit
    };
    
    this.users.set(userId, updatedUser);
    return updatedUser;
  }
  
  // Category methods
  async getCategories(type?: string): Promise<Category[]> {
    const categories = Array.from(this.categories.values());
    if (type) {
      return categories.filter(cat => cat.type === type);
    }
    return categories;
  }
  
  async getCategoryById(id: number): Promise<Category | undefined> {
    return this.categories.get(id);
  }
  
  async createCategory(category: InsertCategory): Promise<Category> {
    const id = this.categoryIdCounter++;
    const newCategory: Category = {
      id,
      ...category
    };
    this.categories.set(id, newCategory);
    return newCategory;
  }
  
  // Transaction methods
  async getTransactions(userId: number, limit?: number): Promise<Transaction[]> {
    const userTransactions = Array.from(this.transactions.values())
      .filter(transaction => transaction.userId === userId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    return limit ? userTransactions.slice(0, limit) : userTransactions;
  }
  
  async getTransactionById(id: number): Promise<Transaction | undefined> {
    return this.transactions.get(id);
  }
  
  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const id = this.transactionIdCounter++;
    const newTransaction: Transaction = {
      id,
      ...transaction,
      createdAt: new Date()
    };
    this.transactions.set(id, newTransaction);
    return newTransaction;
  }
  
  async updateTransaction(id: number, transaction: Partial<InsertTransaction>): Promise<Transaction> {
    const existingTransaction = await this.getTransactionById(id);
    if (!existingTransaction) throw new Error("Transaction not found");
    
    const updatedTransaction: Transaction = {
      ...existingTransaction,
      ...transaction,
    };
    
    this.transactions.set(id, updatedTransaction);
    return updatedTransaction;
  }
  
  async deleteTransaction(id: number): Promise<boolean> {
    return this.transactions.delete(id);
  }
  
  // Recurring transaction methods
  async getRecurringTransactions(userId: number): Promise<RecurringTransaction[]> {
    return Array.from(this.recurringTransactions.values())
      .filter(transaction => transaction.userId === userId)
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }
  
  async getRecurringTransactionById(id: number): Promise<RecurringTransaction | undefined> {
    return this.recurringTransactions.get(id);
  }
  
  async createRecurringTransaction(transaction: InsertRecurringTransaction): Promise<RecurringTransaction> {
    const id = this.recurringTransactionIdCounter++;
    const newTransaction: RecurringTransaction = {
      id,
      ...transaction,
      createdAt: new Date()
    };
    this.recurringTransactions.set(id, newTransaction);
    return newTransaction;
  }
  
  async updateRecurringTransaction(id: number, transaction: Partial<InsertRecurringTransaction>): Promise<RecurringTransaction> {
    const existingTransaction = await this.getRecurringTransactionById(id);
    if (!existingTransaction) throw new Error("Recurring transaction not found");
    
    const updatedTransaction: RecurringTransaction = {
      ...existingTransaction,
      ...transaction,
    };
    
    this.recurringTransactions.set(id, updatedTransaction);
    return updatedTransaction;
  }
  
  async deleteRecurringTransaction(id: number): Promise<boolean> {
    return this.recurringTransactions.delete(id);
  }
  
  // Summary and reporting
  async getTransactionSummary(userId: number): Promise<TransactionSummary> {
    const transactions = await this.getTransactions(userId);
    const user = await this.getUser(userId);
    
    if (!user) {
      throw new Error("User not found");
    }
    
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
    const transactions = (await this.getTransactions(userId))
      .filter(transaction => transaction.type === type);
    
    const categorySums = new Map<number, number>();
    let total = 0;
    
    // Calculate sum by category
    for (const transaction of transactions) {
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
    
    // Get upcoming bills (expense transactions with a future date)
    const upcoming = (await this.getTransactions(userId))
      .filter(transaction => 
        transaction.type === "expense" && 
        new Date(transaction.date) >= today && 
        new Date(transaction.date) <= thirtyDaysLater
      )
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    return upcoming;
  }
  
  // Helper method to create demo transactions
  private addDemoTransactions(userId: number) {
    // Get category IDs
    let salaryCategory: number = 1;
    let housingCategory: number = 6;
    let foodCategory: number = 7;
    let transportCategory: number = 8;
    let utilitiesCategory: number = 13;
    
    const today = new Date();
    const thisMonth = today.getMonth();
    const thisYear = today.getFullYear();
    
    // Create some transactions
    const transactions: InsertTransaction[] = [
      {
        userId,
        description: "Salário",
        amount: "3800.00",
        date: new Date(thisYear, thisMonth, 10),
        type: "income",
        categoryId: salaryCategory,
        isRecurring: true
      },
      {
        userId,
        description: "Aluguel",
        amount: "850.00",
        date: new Date(thisYear, thisMonth, 5),
        type: "expense",
        categoryId: housingCategory,
        isRecurring: true
      },
      {
        userId,
        description: "Supermercado",
        amount: "245.90",
        date: new Date(thisYear, thisMonth, 15),
        type: "expense",
        categoryId: foodCategory,
        isRecurring: false
      },
      {
        userId,
        description: "Combustível",
        amount: "120.00",
        date: new Date(thisYear, thisMonth, 3),
        type: "expense",
        categoryId: transportCategory,
        isRecurring: false
      },
      {
        userId,
        description: "Internet",
        amount: "120.00",
        date: new Date(thisYear, thisMonth + 1, today.getDate() + 2),
        type: "expense",
        categoryId: utilitiesCategory,
        isRecurring: true
      },
      {
        userId,
        description: "Energia Elétrica",
        amount: "189.75",
        date: new Date(),
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
        startDate: new Date(thisYear, thisMonth, 10)
      },
      {
        userId,
        description: "Aluguel",
        amount: "850.00",
        type: "expense",
        categoryId: housingCategory,
        frequency: "monthly",
        startDate: new Date(thisYear, thisMonth, 5)
      },
      {
        userId,
        description: "Internet",
        amount: "120.00",
        type: "expense",
        categoryId: utilitiesCategory,
        frequency: "monthly",
        startDate: new Date(thisYear, thisMonth, 25)
      },
      {
        userId,
        description: "Energia Elétrica",
        amount: "189.75",
        type: "expense",
        categoryId: utilitiesCategory,
        frequency: "monthly",
        startDate: new Date()
      }
    ];
    
    // Create transactions
    transactions.forEach(transaction => {
      this.createTransaction(transaction);
    });
    
    // Create recurring transactions
    recurringTransactions.forEach(transaction => {
      this.createRecurringTransaction(transaction);
    });
  }
}

export const storage = new MemStorage();
