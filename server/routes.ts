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
      
      // Primeiro identificar transações recorrentes para eliminar as referências
      const findRecurringResult = await pool.query('SELECT id FROM recurring_transactions WHERE user_id = $1', [userId]);
      const recurringIds = findRecurringResult.rows.map(row => row.id);
      
      // Limpar referências a transações recorrentes
      if (recurringIds.length > 0) {
        await pool.query('UPDATE transactions SET recurring_id = NULL WHERE recurring_id = ANY($1::int[])', [recurringIds]);
      }
      
      await pool.query('DELETE FROM transactions WHERE user_id = $1', [userId]);
      console.log(`[POST /api/user/:id/reset] Transações excluídas para usuário ${userId}`);
      
      // 2. Excluir todas as transações recorrentes do usuário
      await pool.query('DELETE FROM recurring_transactions WHERE user_id = $1', [userId]);
      console.log(`[POST /api/user/:id/reset] Transações recorrentes excluídas para usuário ${userId}`);
      
      // 3. Redefinir o saldo inicial e limite de cheque especial PARA VALORES FIXOS DE ZERO
      // Isso garante a limpeza completa da conta
      const initialBalance = '0.00';
      const overdraftLimit = '0.00';
      
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

  app.post("/api/user/register", async (req, res) => {
    try {
      const { username, email, password } = req.body;
      
      console.log(`Registration attempt for username: ${username}`);
      
      if (!username || !password) {
        console.log("Missing username or password");
        return res.status(400).json({ message: "Usuário e senha são obrigatórios" });
      }
      
      // Verificar se o usuário já existe
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        console.log(`Username ${username} already exists`);
        return res.status(400).json({ message: "Nome de usuário já existe" });
      }
      
      // Criar o novo usuário
      const newUser = await storage.createUser({
        username,
        email: email || "",
        password,
        initialBalance: "0.00",
        overdraftLimit: "0.00"
      });
      
      console.log(`User registered successfully: ${username}`);
      
      // Não enviar a senha na resposta
      const { password: _, ...userWithoutPassword } = newUser;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Erro ao registrar usuário" });
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
      
      console.log(`Looking for user with username: ${username}`);
      const user = await storage.getUserByUsername(username);
      console.log(`User found:`, user ? "Yes" : "No");
      
      if (!user) {
        console.log("User not found");
        return res.status(401).json({ message: "Usuário ou senha inválidos" });
      }

      console.log("Checking credentials");
      // Para simplificar a autenticação durante o desenvolvimento, permitir login direto
      // Para uma aplicação em produção, aqui seria o lugar para verificar o hash da senha
      // Por exemplo: const passwordMatch = await bcrypt.compare(password, user.password);
      const isValidPassword = user.password === password;
      
      if (!isValidPassword) {
        console.log("Invalid password");
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
  
  // Endpoint para autenticar com Google
  app.post("/api/user/google-auth", async (req, res) => {
    try {
      const { displayName, email, uid } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email obrigatório para autenticação Google" });
      }
      
      // Verificar se o usuário já existe pelo uid do Google
      let user = await storage.getUserByEmail(email);
      
      if (user) {
        // Usuário existe, fazer login
        // Store user ID in session
        if (req.session) {
          req.session.userId = user.id;
        }
        
        // Don't send password
        const { password: _, ...userWithoutPassword } = user;
        return res.json(userWithoutPassword);
      } else {
        // Criar novo usuário com os dados do Google
        const username = email.split('@')[0] || displayName.replace(/\s+/g, '');
        
        // Verificar se o username já existe
        const existingUserWithUsername = await storage.getUserByUsername(username);
        
        // Se username existir, adicionar um sufixo numérico
        const finalUsername = existingUserWithUsername 
          ? `${username}${Math.floor(Math.random() * 10000)}` 
          : username;
        
        // Senha aleatória que o usuário nunca usará (login sempre via Google)
        const password = Math.random().toString(36).slice(-10);
        
        const newUser = await storage.createUser({
          username: finalUsername,
          email,
          password,
          initialBalance: "0.00",
          overdraftLimit: "0.00"
        });
        
        // Store user ID in session
        if (req.session) {
          req.session.userId = newUser.id;
        }
        
        // Don't send password
        const { password: _, ...userWithoutPassword } = newUser;
        return res.status(201).json(userWithoutPassword);
      }
    } catch (error) {
      console.error("Google auth error:", error);
      res.status(500).json({ message: "Erro na autenticação com Google" });
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
      
      // Verificar o formato dos dados recebidos
      console.log('[PATCH /api/user/:id/settings] Tipo de req.body:', typeof req.body);
      console.log('[PATCH /api/user/:id/settings] Propriedades recebidas:', Object.keys(req.body));
      console.log('[PATCH /api/user/:id/settings] Raw req.body:', JSON.stringify(req.body));
      
      // Buscar usuário diretamente para depuração
      const { pool } = await import('./db');
      const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
      
      if (userResult.rows.length === 0) {
        console.log(`[PATCH /api/user/:id/settings] Usuário não encontrado`);
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      // Log do usuário atual antes da atualização
      console.log(`[PATCH /api/user/:id/settings] Dados atuais do usuário:`, userResult.rows[0]);
      
      // Prepara valores iniciais com defaults seguros
      let initialBalance = '0.00';
      let overdraftLimit = '0.00';
      
      try {
        // Tenta validar com o schema
        const validatedData = accountSettingsSchema.parse(req.body);
        console.log(`[PATCH /api/user/:id/settings] Dados validados:`, validatedData);
        
        initialBalance = validatedData.initialBalance;
        overdraftLimit = validatedData.overdraftLimit;
      } catch (validationError) {
        console.log('[PATCH /api/user/:id/settings] Erro de validação de schema, usando valores brutos de req.body');
        initialBalance = typeof req.body.initialBalance === 'string' ? req.body.initialBalance : '0.00';
        overdraftLimit = typeof req.body.overdraftLimit === 'string' ? req.body.overdraftLimit : '0.00';
      }
      
      // Atualizar diretamente no banco de dados para garantir que a operação seja realizada
      console.log(`[PATCH /api/user/:id/settings] Executando SQL com valores: initialBalance=${initialBalance}, overdraftLimit=${overdraftLimit}`);
      
      await pool.query(
        "UPDATE users SET initial_balance = $1, overdraft_limit = $2 WHERE id = $3",
        [initialBalance, overdraftLimit, userId]
      );
      
      // Busca o usuário novamente após a atualização
      const afterUpdateResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
      console.log(`[PATCH /api/user/:id/settings] Usuário após atualização:`, afterUpdateResult.rows[0]);
      
      if (afterUpdateResult.rows.length === 0) {
        console.log(`[PATCH /api/user/:id/settings] Falha ao obter usuário atualizado`);
        return res.status(500).json({ message: "Erro ao atualizar configurações" });
      }
      
      const updatedUser = afterUpdateResult.rows[0];
      const { password, ...userWithoutPassword } = updatedUser;
      
      // Normalizar os dados do usuário para garantir consistência entre camelCase e snake_case
      const normalizedUser = {
        ...userWithoutPassword,
        initialBalance: updatedUser.initial_balance || updatedUser.initialBalance,
        overdraftLimit: updatedUser.overdraft_limit || updatedUser.overdraftLimit,
        initial_balance: updatedUser.initial_balance || updatedUser.initialBalance,
        overdraft_limit: updatedUser.overdraft_limit || updatedUser.overdraftLimit,
      };
      
      console.log(`[PATCH /api/user/:id/settings] Enviando usuário normalizado:`, normalizedUser);
      
      res.json({
        message: "Configurações atualizadas com sucesso",
        user: normalizedUser
      });
    } catch (error) {
      console.error(`[PATCH /api/user/:id/settings] Erro:`, error);
      res.status(500).json({ 
        message: "Erro ao atualizar configurações", 
        error: error instanceof Error ? error.message : 'Erro desconhecido' 
      });
    }
  });

  // Transaction routes
  app.get("/api/transactions/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      console.log(`[GET /api/transactions/:userId] Buscando transações para usuário ${userId}`);
      
      // Usar a função do dbWithExtensions
      const { dbWithExtensions } = await import('./db');
      const transactions = await dbWithExtensions.getTransactions(userId);
      
      console.log(`[GET /api/transactions/:userId] Encontradas ${transactions.length} transações`);
      res.json(transactions);
    } catch (error) {
      console.error(`[GET /api/transactions/:userId] Erro:`, error);
      res.status(500).json({ message: "Erro ao buscar transações" });
    }
  });

  app.post("/api/transactions", upload.single("attachment"), async (req, res) => {
    try {
      console.log("Body received:", req.body);
      
      // Prepare transaction data
      const transactionData = {
        ...req.body,
        userId: parseInt(req.body.userId),
        amount: req.body.amount,
        categoryId: parseInt(req.body.categoryId),
        date: req.body.date,
        recurringId: req.body.recurringId ? parseInt(req.body.recurringId) : null,
        attachmentPath: req.file ? `/uploads/${req.file.filename}` : null,
      };
      
      console.log("Transaction data:", transactionData);
      
      let validatedData;
      try {
        validatedData = insertTransactionSchema.parse(transactionData);
        console.log("Validated data:", validatedData);
      } catch (validationError) {
        console.error("Validation error:", validationError);
        return res.status(400).json({
          message: "Dados de transação inválidos",
          error: validationError,
        });
      }

      const newTransaction = await storage.createTransaction(validatedData);
      console.log("New transaction created:", newTransaction);
      
      res.status(201).json(newTransaction);
    } catch (error) {
      console.error("Error creating transaction:", error);
      res.status(500).json({
        message: "Erro ao criar transação",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.patch("/api/transactions/:id", upload.single("attachment"), async (req, res) => {
    try {
      const transactionId = parseInt(req.params.id);
      console.log(`PATCH /api/transactions/${transactionId} Body:`, req.body);
      
      // Get existing transaction
      const existingTransaction = await storage.getTransactionById(transactionId);
      if (!existingTransaction) {
        return res.status(404).json({ message: "Transação não encontrada" });
      }

      // Prepare update data
      const updateData = { ...req.body };
      if (updateData.userId) updateData.userId = parseInt(updateData.userId);
      if (updateData.categoryId) updateData.categoryId = parseInt(updateData.categoryId);
      if (updateData.recurringId) updateData.recurringId = parseInt(updateData.recurringId);

      // Handle the new attachment if present
      if (req.file) {
        updateData.attachmentPath = `/uploads/${req.file.filename}`;
      } else if (updateData.removeAttachment === 'true') {
        // Remove attachment if explicitly requested
        updateData.attachmentPath = null;
      }

      console.log("Update data:", updateData);

      const updatedTransaction = await storage.updateTransaction(transactionId, updateData);
      console.log("Updated transaction:", updatedTransaction);
      
      res.json(updatedTransaction);
    } catch (error) {
      console.error("Error updating transaction:", error);
      res.status(500).json({
        message: "Erro ao atualizar transação",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.delete("/api/transactions/:id", async (req, res) => {
    try {
      const transactionId = parseInt(req.params.id);
      const deleted = await storage.deleteTransaction(transactionId);
      
      if (deleted) {
        res.json({ message: "Transação excluída com sucesso" });
      } else {
        res.status(404).json({ message: "Transação não encontrada" });
      }
    } catch (error) {
      console.error("Error deleting transaction:", error);
      res.status(500).json({
        message: "Erro ao excluir transação",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Recurring transaction routes
  app.get("/api/recurring/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      console.log(`[GET /api/recurring/:userId] Buscando transações recorrentes para usuário ${userId}`);
      
      // Usar a função do dbWithExtensions
      const { dbWithExtensions } = await import('./db');
      const transactions = await dbWithExtensions.getRecurringTransactions(userId);
      
      console.log(`[GET /api/recurring/:userId] Encontradas ${transactions.length} transações recorrentes`);
      res.json(transactions);
    } catch (error) {
      console.error("[GET /api/recurring/:userId] Erro:", error);
      res.status(500).json({ message: "Erro ao buscar transações recorrentes" });
    }
  });

  app.post("/api/recurring", async (req, res) => {
    try {
      console.log("Recurring transaction body:", req.body);
      
      // Prepare recurring transaction data
      const recurringData = {
        ...req.body,
        userId: parseInt(req.body.userId),
        amount: req.body.amount,
        categoryId: parseInt(req.body.categoryId),
      };
      
      console.log("Recurring transaction data:", recurringData);
      
      // Validate data
      let validatedData;
      try {
        validatedData = insertRecurringTransactionSchema.parse(recurringData);
        console.log("Validated recurring data:", validatedData);
      } catch (validationError) {
        console.error("Validation error on recurring transaction:", validationError);
        return res.status(400).json({
          message: "Dados de transação recorrente inválidos",
          error: validationError,
        });
      }

      const newRecurringTransaction = await storage.createRecurringTransaction(validatedData);
      console.log("New recurring transaction created:", newRecurringTransaction);
      
      res.status(201).json(newRecurringTransaction);
    } catch (error) {
      console.error("Error creating recurring transaction:", error);
      res.status(500).json({
        message: "Erro ao criar transação recorrente",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.patch("/api/recurring/:id", async (req, res) => {
    try {
      const transactionId = parseInt(req.params.id);
      
      // Prepare update data
      const updateData = { ...req.body };
      if (updateData.userId) updateData.userId = parseInt(updateData.userId);
      if (updateData.categoryId) updateData.categoryId = parseInt(updateData.categoryId);

      const updatedTransaction = await storage.updateRecurringTransaction(
        transactionId,
        updateData
      );
      
      res.json(updatedTransaction);
    } catch (error) {
      console.error("Error updating recurring transaction:", error);
      res.status(500).json({
        message: "Erro ao atualizar transação recorrente",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.delete("/api/recurring/:id", async (req, res) => {
    try {
      const transactionId = parseInt(req.params.id);
      
      // Limpar referências nas transações normais antes de excluir a transação recorrente
      try {
        const { pool } = await import('./db');
        await pool.query('UPDATE transactions SET recurring_id = NULL WHERE recurring_id = $1', [transactionId]);
        console.log(`[DELETE /api/recurring/:id] Referências atualizadas para transação recorrente ${transactionId}`);
      } catch (dbError) {
        console.error(`[DELETE /api/recurring/:id] Erro ao atualizar referências:`, dbError);
      }
      
      const deleted = await storage.deleteRecurringTransaction(transactionId);
      
      if (deleted) {
        res.json({ message: "Transação recorrente excluída com sucesso" });
      } else {
        res.status(404).json({ message: "Transação recorrente não encontrada" });
      }
    } catch (error) {
      console.error("Error deleting recurring transaction:", error);
      res.status(500).json({
        message: "Erro ao excluir transação recorrente",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  // Category routes
  app.get("/api/categories", async (req, res) => {
    try {
      const type = req.query.type as string | undefined;
      const categories = await storage.getCategories(type);
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Erro ao buscar categorias" });
    }
  });

  // Summary routes
  app.get("/api/summary/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const summary = await storage.getTransactionSummary(userId);
      res.json(summary);
    } catch (error) {
      console.error("Error fetching transaction summary:", error);
      res.status(500).json({ message: "Erro ao buscar resumo de transações" });
    }
  });

  app.get("/api/category-summary/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const type = req.query.type as string || "expense";
      
      const categorySummary = await storage.getCategorySummary(userId, type);
      res.json(categorySummary);
    } catch (error) {
      console.error("Error fetching category summary:", error);
      res.status(500).json({ message: "Erro ao buscar resumo por categoria" });
    }
  });

  app.get("/api/upcoming-bills/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const upcomingBills = await storage.getUpcomingBills(userId);
      res.json(upcomingBills);
    } catch (error) {
      console.error("Error fetching upcoming bills:", error);
      res.status(500).json({ message: "Erro ao buscar contas a pagar" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
