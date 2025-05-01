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
  // Rota temporária para limpar todas as transações e reiniciar a conta
  app.delete("/api/account/reset/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      console.log(`[DELETE /api/account/reset/:userId] Reiniciando conta do usuário ${userId}`);
      
      // Verifica se o ID é válido
      if (isNaN(userId) || userId <= 0) {
        return res.status(400).json({ message: "ID de usuário inválido" });
      }
      
      const { pool } = await import('./db');
      
      // Primeiro identificar transações recorrentes para eliminar as referências
      const findRecurringResult = await pool.query('SELECT id FROM recurring_transactions WHERE user_id = $1', [userId]);
      const recurringIds = findRecurringResult.rows.map(row => row.id);
      
      // Limpar referências a transações recorrentes
      if (recurringIds.length > 0) {
        await pool.query('UPDATE transactions SET recurring_id = NULL WHERE recurring_id = ANY($1::int[])', [recurringIds]);
      }
      
      // Excluir todas as transações recorrentes
      const deleteRecurringResult = await pool.query('DELETE FROM recurring_transactions WHERE user_id = $1', [userId]);
      
      // Excluir todas as transações normais
      const deleteTransactionsResult = await pool.query('DELETE FROM transactions WHERE user_id = $1', [userId]);
      
      // Redefinir o saldo inicial e limite de cheque especial para 0
      await pool.query('UPDATE users SET initial_balance = $1, overdraft_limit = $2 WHERE id = $3', ['0', '0', userId]);
      
      console.log(`[DELETE /api/account/reset/:userId] Conta reiniciada com sucesso. Excluídas ${deleteRecurringResult.rowCount} transações recorrentes e ${deleteTransactionsResult.rowCount} transações normais.`);
      
      return res.status(200).json({
        message: "Conta reiniciada com sucesso",
        transactionsDeleted: deleteTransactionsResult.rowCount,
        recurringTransactionsDeleted: deleteRecurringResult.rowCount
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error(`[DELETE /api/account/reset/:userId] Erro: ${errorMessage}`, error);
      res.status(500).json({ message: "Erro ao reiniciar conta", error: errorMessage });
    }
  });

  // Rota temporária para limpar transações recorrentes
  app.delete("/api/recurring/clear/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      console.log(`[DELETE /api/recurring/clear/:userId] Limpando todas as transações recorrentes do usuário ${userId}`);
      
      // Verifica se o ID é válido
      if (isNaN(userId) || userId <= 0) {
        console.log(`[DELETE /api/recurring/clear/:userId] ID de usuário inválido: ${userId}`);
        return res.status(400).json({ message: "ID de usuário inválido" });
      }
      
      // Precisamos primeiro limpar as referências nas transações normais
      const { pool } = await import('./db');
      
      // Primeiro, identificamos as transações recorrentes do usuário
      const findResult = await pool.query('SELECT id FROM recurring_transactions WHERE user_id = $1', [userId]);
      
      if (findResult.rows.length > 0) {
        console.log(`[DELETE /api/recurring/clear/:userId] Encontradas ${findResult.rows.length} transações recorrentes`);
        
        // IDs das transações recorrentes a serem excluídas
        const recurringIds = findResult.rows.map(row => row.id);
        
        // Atualiza transações para remover referências a transações recorrentes
        console.log(`[DELETE /api/recurring/clear/:userId] Limpando referências nas transações para: ${JSON.stringify(recurringIds)}`);
        await pool.query('UPDATE transactions SET recurring_id = NULL WHERE recurring_id = ANY($1::int[])', [recurringIds]);
        
        // Agora podemos excluir as transações recorrentes
        console.log(`[DELETE /api/recurring/clear/:userId] Excluindo transações recorrentes`);
        const result = await pool.query('DELETE FROM recurring_transactions WHERE user_id = $1 RETURNING id', [userId]);
        
        console.log(`[DELETE /api/recurring/clear/:userId] ${result.rowCount} transações recorrentes excluídas`);
        if (result.rows) {
          console.log(`[DELETE /api/recurring/clear/:userId] IDs excluídos: ${JSON.stringify(result.rows)}`);
        }
        
        return res.status(200).json({ 
          message: `${result.rowCount} transações recorrentes excluídas com sucesso`,
          referencesUpdated: recurringIds.length
        });
      } else {
        console.log(`[DELETE /api/recurring/clear/:userId] Nenhuma transação recorrente encontrada para o usuário ${userId}`);
        return res.status(200).json({ message: "Nenhuma transação recorrente encontrada" });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error(`[DELETE /api/recurring/clear/:userId] Erro: ${errorMessage}`, error);
      res.status(500).json({ message: "Erro ao limpar transações recorrentes", error: errorMessage });
    }
  });

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
      console.log(`[GET /api/user/:id] Buscando usuário com ID ${userId}`);
      
      // Buscar usuário diretamente pelo db para depuração
      const { pool } = await import('./db');
      const result = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
      
      if (result.rows.length === 0) {
        console.log(`[GET /api/user/:id] Usuário não encontrado`);
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      const user = result.rows[0];
      console.log(`[GET /api/user/:id] Usuário encontrado:`, user);
      
      // Don't send password
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error(`[GET /api/user/:id] Erro:`, error);
      res.status(500).json({ message: "Erro ao buscar usuário" });
    }
  });
  
  // Rota para redefinir todos os dados do usuário
  app.post("/api/user/:id/reset", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      console.log(`[POST /api/user/:id/reset] Solicitação de redefinição de dados para usuário ${userId}`);
      
      // 1. Excluir todas as transações do usuário
      const { pool } = await import('./db');
      await pool.query('DELETE FROM transactions WHERE user_id = $1', [userId]);
      console.log(`[POST /api/user/:id/reset] Transações excluídas para usuário ${userId}`);
      
      // 2. Excluir todas as transações recorrentes do usuário
      await pool.query('DELETE FROM recurring_transactions WHERE user_id = $1', [userId]);
      console.log(`[POST /api/user/:id/reset] Transações recorrentes excluídas para usuário ${userId}`);
      
      // 3. Redefinir o saldo inicial e limite de cheque especial
      const initialBalance = req.body.initialBalance || '0.00';
      const overdraftLimit = req.body.overdraftLimit || '0.00';
      
      await pool.query(
        'UPDATE users SET initial_balance = $1, overdraft_limit = $2 WHERE id = $3',
        [initialBalance, overdraftLimit, userId]
      );
      console.log(`[POST /api/user/:id/reset] Configurações da conta redefinidas para: saldo=${initialBalance}, limite=${overdraftLimit}`);
      
      // 4. Buscar o usuário atualizado para retornar
      const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
      if (userResult.rows.length === 0) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      const updatedUser = userResult.rows[0];
      const { password, ...userWithoutPassword } = updatedUser;
      
      // Normalizar os dados do usuário para garantir consistência
      const normalizedUser = {
        ...userWithoutPassword,
        initialBalance: updatedUser.initial_balance || updatedUser.initialBalance,
        overdraftLimit: updatedUser.overdraft_limit || updatedUser.overdraftLimit,
        initial_balance: updatedUser.initial_balance || updatedUser.initialBalance,
        overdraft_limit: updatedUser.overdraft_limit || updatedUser.overdraftLimit,
      };
      
      res.json({
        message: "Dados do usuário redefinidos com sucesso",
        user: normalizedUser
      });
    } catch (error) {
      console.error(`[POST /api/user/:id/reset] Erro:`, error);
      res.status(500).json({ 
        message: "Erro ao redefinir dados do usuário", 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      });
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
      
      // Store user ID in session
      if (req.session) {
        req.session.userId = user.id;
      }
      
      // Don't send password
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Erro ao fazer login" });
    }
  });
  
  app.post("/api/user/logout", (req, res) => {
    try {
      if (req.session) {
        req.session.destroy((err) => {
          if (err) {
            console.error("Logout error:", err);
            return res.status(500).json({ message: "Erro ao fazer logout" });
          }
          res.clearCookie('connect.sid');
          res.json({ success: true });
        });
      } else {
        res.json({ success: true });
      }
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  });
  
  app.get("/api/user/session", async (req, res) => {
    try {
      if (!req.session || !req.session.userId) {
        return res.status(401).json({ message: "Não autenticado" });
      }
      
      const userId = req.session.userId;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(401).json({ message: "Usuário não encontrado" });
      }
      
      // Don't send password
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Session check error:", error);
      res.status(500).json({ message: "Erro ao buscar usuário" });
    }
  });

  // Account settings routes
  app.patch("/api/user/:id/settings", async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      console.log(`[PATCH /api/user/:id/settings] Atualizando configurações do usuário ${userId}:`, req.body);
      
      // Buscar usuário diretamente para depuração
      const { pool } = await import('./db');
      const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
      
      if (userResult.rows.length === 0) {
        console.log(`[PATCH /api/user/:id/settings] Usuário não encontrado`);
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      const validatedData = accountSettingsSchema.parse(req.body);
      console.log(`[PATCH /api/user/:id/settings] Dados validados:`, validatedData);
      
      // Atualizar diretamente no banco de dados para garantir que a operação seja realizada
      const updateResult = await pool.query(
        "UPDATE users SET initial_balance = $1, overdraft_limit = $2 WHERE id = $3 RETURNING *",
        [validatedData.initialBalance, validatedData.overdraftLimit, userId]
      );
      
      console.log(`[PATCH /api/user/:id/settings] SQL executado com valores: initialBalance=${validatedData.initialBalance}, overdraftLimit=${validatedData.overdraftLimit}`);
      
      if (updateResult.rows.length === 0) {
        console.log(`[PATCH /api/user/:id/settings] Falha ao atualizar usuário`);
        return res.status(500).json({ message: "Erro ao atualizar configurações" });
      }
      
      const updatedUser = updateResult.rows[0];
      console.log(`[PATCH /api/user/:id/settings] Usuário atualizado com sucesso:`, updatedUser);
      
      // Don't send password
      const { password, ...userWithoutPassword } = updatedUser;
      
      // Cria uma versão normalizada do usuário com ambos os formatos de campo (camelCase e snake_case)
      const normalizedUser = {
        ...userWithoutPassword,
        // Garante que tanto camelCase quanto snake_case estão disponíveis
        initialBalance: updatedUser.initial_balance || updatedUser.initialBalance,
        overdraftLimit: updatedUser.overdraft_limit || updatedUser.overdraftLimit,
        initial_balance: updatedUser.initial_balance || updatedUser.initialBalance,
        overdraft_limit: updatedUser.overdraft_limit || updatedUser.overdraftLimit,
        // Informações de debug
        debug: {
          initialBalanceSubmitted: validatedData.initialBalance,
          overdraftLimitSubmitted: validatedData.overdraftLimit,
          initialBalanceUpdated: updatedUser.initial_balance || updatedUser.initialBalance,
          overdraftLimitUpdated: updatedUser.overdraft_limit || updatedUser.overdraftLimit
        }
      };
      
      console.log(`[PATCH /api/user/:id/settings] Enviando resposta normalizada:`, normalizedUser);
      res.json(normalizedUser);
    } catch (error) {
      console.error(`[PATCH /api/user/:id/settings] Erro:`, error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.errors });
      }
      res.status(500).json({ message: "Erro ao atualizar configurações", error: error instanceof Error ? error.message : 'Erro desconhecido' });
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
      console.log(`[DELETE /api/recurring/:id] Solicitação de exclusão para ID: ${id}`);
      
      // Verifica se o ID é válido
      if (isNaN(id) || id <= 0) {
        console.log(`[DELETE /api/recurring/:id] ID inválido: ${id}`);
        return res.status(400).json({ message: "ID de transação recorrente inválido" });
      }
      
      // Tenta excluir a transação recorrente
      const success = await storage.deleteRecurringTransaction(id);
      console.log(`[DELETE /api/recurring/:id] Resultado da exclusão: ${success ? 'sucesso' : 'falha'}`);
      
      if (!success) {
        return res.status(404).json({ message: "Transação recorrente não encontrada" });
      }
      
      console.log(`[DELETE /api/recurring/:id] Transação ${id} excluída com sucesso`);
      res.status(204).end();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      console.error(`[DELETE /api/recurring/:id] Erro: ${errorMessage}`, error);
      res.status(500).json({ message: "Erro ao excluir transação recorrente", error: errorMessage });
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
