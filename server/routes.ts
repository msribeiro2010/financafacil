import express, { type Express, type Request, type Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import multer from "multer";
import path from "path";
import fs from "fs";
import { 
  insertTransactionSchema, 
  insertRecurringTransactionSchema, 
  accountSettingsSchema 
} from "@shared/schema";

// Configure multer for file uploads
const uploadsDir = path.join(process.cwd(), "uploads");

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage_config = multer.diskStorage({
  destination: function (_req, _file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (_req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage_config,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (_req, file, cb) => {
    // Accept images and PDFs
    if (
      file.mimetype === "image/png" ||
      file.mimetype === "image/jpg" ||
      file.mimetype === "image/jpeg" ||
      file.mimetype === "application/pdf"
    ) {
      cb(null, true);
    } else {
      cb(new Error("Apenas arquivos PNG, JPG e PDF são permitidos"));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Serve static files from uploads directory
  app.use('/uploads', (req, res, next) => {
    // Add security headers to prevent unauthorized access
    res.setHeader('Content-Security-Policy', "default-src 'self'");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  }, express.static(uploadsDir));
  
  // API routes
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // User routes
  app.get("/api/user/:id", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      // Don't send password
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar usuário" });
    }
  });

  app.post("/api/user/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      
      console.log(`Login attempt for username: ${username}`);
      
      if (!username || !password) {
        console.log("Missing username or password");
        return res.status(400).json({ message: "Usuário e senha são obrigatórios" });
      }
      
      const user = await storage.getUserByUsername(username);
      console.log(`User found:`, user ? "Yes" : "No");
      
      if (!user || user.password !== password) {
        console.log("Invalid credentials");
        return res.status(401).json({ message: "Usuário ou senha inválidos" });
      }
      
      console.log("Login successful");
      // Don't send password
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Erro ao fazer login" });
    }
  });

  // Account settings routes
  app.patch("/api/user/:id/settings", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      const validatedData = accountSettingsSchema.parse(req.body);
      const updatedUser = await storage.updateUserSettings(
        userId,
        validatedData.initialBalance,
        validatedData.overdraftLimit
      );
      
      // Don't send password
      const { password, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Erro ao atualizar configurações" });
    }
  });

  // Category routes
  app.get("/api/categories", async (req, res) => {
    try {
      const type = req.query.type as string | undefined;
      const categories = await storage.getCategories(type);
      res.json(categories);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar categorias" });
    }
  });

  // Transaction routes
  app.get("/api/transactions/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const transactions = await storage.getTransactions(userId, limit);
      
      // Enhance transactions with category information
      const enhancedTransactions = await Promise.all(
        transactions.map(async (transaction) => {
          let category = null;
          if (transaction.categoryId) {
            category = await storage.getCategoryById(transaction.categoryId);
          }
          return { ...transaction, category };
        })
      );
      
      res.json(enhancedTransactions);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar transações" });
    }
  });

  app.post("/api/transactions", upload.single("attachment"), async (req, res) => {
    try {
      const data = req.body;
      
      // Convert string values to appropriate types but keep date as string
      const transactionData = {
        ...data,
        userId: parseInt(data.userId),
        amount: data.amount,
        categoryId: data.categoryId ? parseInt(data.categoryId) : undefined,
        date: data.date, // Keep date as string to match schema expectations
        isRecurring: data.isRecurring === "true",
        recurringId: data.recurringId ? parseInt(data.recurringId) : undefined,
        attachment: req.file ? req.file.path : undefined
      };
      
      const validatedData = insertTransactionSchema.parse(transactionData);
      const transaction = await storage.createTransaction(validatedData);
      
      res.status(201).json(transaction);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Erro ao criar transação" });
    }
  });

  app.patch("/api/transactions/:id", upload.single("attachment"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = req.body;
      
      console.log("Transaction update data received:", data);
      
      // Convert string values to appropriate types
      const transactionData: any = {};
      
      if (data.userId) transactionData.userId = parseInt(data.userId);
      if (data.type) transactionData.type = data.type;
      if (data.description) transactionData.description = data.description;
      if (data.amount) transactionData.amount = data.amount;
      if (data.categoryId) transactionData.categoryId = parseInt(data.categoryId);
      if (data.date) transactionData.date = data.date; // Keep as string
      if (data.isRecurring !== undefined) transactionData.isRecurring = data.isRecurring === "true";
      if (data.recurringId) transactionData.recurringId = parseInt(data.recurringId);
      if (req.file) transactionData.attachment = req.file.path;
      
      console.log("Processed transaction data:", transactionData);
      
      const transaction = await storage.updateTransaction(id, transactionData);
      res.json(transaction);
    } catch (error) {
      console.error("Error updating transaction:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Erro ao atualizar transação" });
    }
  });

  app.delete("/api/transactions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteTransaction(id);
      
      if (!success) {
        return res.status(404).json({ message: "Transação não encontrada" });
      }
      
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ message: "Erro ao excluir transação" });
    }
  });

  // Recurring transaction routes
  app.get("/api/recurring/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const recurringTransactions = await storage.getRecurringTransactions(userId);
      
      // Enhance transactions with category information
      const enhancedTransactions = await Promise.all(
        recurringTransactions.map(async (transaction) => {
          let category = null;
          if (transaction.categoryId) {
            category = await storage.getCategoryById(transaction.categoryId);
          }
          return { ...transaction, category };
        })
      );
      
      res.json(enhancedTransactions);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar transações recorrentes" });
    }
  });

  app.post("/api/recurring", upload.single("attachment"), async (req, res) => {
    try {
      const data = req.body;
      
      // Log the incoming data for debugging
      console.log("Recurring transaction data received:", data);
      
      // Convert string values to appropriate types
      const transactionData = {
        userId: parseInt(data.userId),
        type: data.type,
        description: data.description,
        amount: data.amount,
        frequency: data.frequency,
        startDate: data.startDate,
        categoryId: data.categoryId ? parseInt(data.categoryId) : undefined,
        endDate: data.endDate || undefined,
        attachment: req.file ? req.file.path : undefined
      };
      
      const validatedData = insertRecurringTransactionSchema.parse(transactionData);
      const transaction = await storage.createRecurringTransaction(validatedData);
      
      res.status(201).json(transaction);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Erro ao criar transação recorrente" });
    }
  });

  app.patch("/api/recurring/:id", upload.single("attachment"), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const data = req.body;
      
      // Log the incoming data for debugging
      console.log("Recurring transaction update data received:", data);
      
      // Convert string values to appropriate types
      const transactionData: any = {};
      
      if (data.userId) transactionData.userId = parseInt(data.userId);
      if (data.type) transactionData.type = data.type;
      if (data.description) transactionData.description = data.description;
      if (data.amount) transactionData.amount = data.amount;
      if (data.frequency) transactionData.frequency = data.frequency;
      if (data.categoryId) transactionData.categoryId = parseInt(data.categoryId);
      if (data.startDate) transactionData.startDate = data.startDate;
      if (data.endDate) transactionData.endDate = data.endDate;
      if (req.file) transactionData.attachment = req.file.path;
      
      const transaction = await storage.updateRecurringTransaction(id, transactionData);
      res.json(transaction);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Erro ao atualizar transação recorrente" });
    }
  });

  app.delete("/api/recurring/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteRecurringTransaction(id);
      
      if (!success) {
        return res.status(404).json({ message: "Transação recorrente não encontrada" });
      }
      
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ message: "Erro ao excluir transação recorrente" });
    }
  });

  // Summary routes
  app.get("/api/summary/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const summary = await storage.getTransactionSummary(userId);
      res.json(summary);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar resumo" });
    }
  });

  app.get("/api/category-summary/:userId/:type", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const type = req.params.type;
      
      if (type !== "expense" && type !== "income") {
        return res.status(400).json({ message: "Tipo inválido" });
      }
      
      const summary = await storage.getCategorySummary(userId, type);
      res.json(summary);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar resumo por categoria" });
    }
  });

  app.get("/api/upcoming/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const bills = await storage.getUpcomingBills(userId);
      
      // Enhance bills with category information
      const enhancedBills = await Promise.all(
        bills.map(async (bill) => {
          let category = null;
          if (bill.categoryId) {
            category = await storage.getCategoryById(bill.categoryId);
          }
          return { ...bill, category };
        })
      );
      
      res.json(enhancedBills);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar contas a vencer" });
    }
  });

  // Create and return HTTP server
  const httpServer = createServer(app);
  return httpServer;
}
