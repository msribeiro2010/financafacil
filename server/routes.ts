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
  console.log(`[SERVER] Diretório de uploads criado: ${uploadsDir}`);
}

const storage_config = multer.diskStorage({
  destination: function (_req, _file, cb) {
    console.log(`[SERVER] Salvando arquivo no diretório: ${uploadsDir}`);
    cb(null, uploadsDir);
  },
  filename: function (_req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const filename = uniqueSuffix + path.extname(file.originalname);
    console.log(`[SERVER] Nome gerado para o arquivo: ${filename}, original: ${file.originalname}`);
    cb(null, filename);
  },
});

const upload = multer({
  storage: storage_config,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB limit
  },
  fileFilter: (_req, file, cb) => {
    // Accept images and PDFs
    console.log(`[SERVER] Verificando tipo de arquivo: ${file.mimetype}`);
    if (
      file.mimetype === "image/png" ||
      file.mimetype === "image/jpg" ||
      file.mimetype === "image/jpeg" ||
      file.mimetype === "application/pdf"
    ) {
      cb(null, true);
    } else {
      console.log(`[SERVER] Tipo de arquivo não permitido: ${file.mimetype}`);
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
    res.json({ status: "funcionando" });
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
        return res.status(401).json({ message: "Não autenticado. Por favor, faça login novamente." });
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

      // Buscar o resumo financeiro atualizado
      const financialSummary = await storage.getTransactionSummary(userId);
      console.log(`[PATCH /api/user/:id/settings] Resumo financeiro calculado:`, financialSummary);

      res.json({
        message: "Configurações atualizadas com sucesso",
        user: normalizedUser,
        summary: financialSummary
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
      // Verifica se o userId foi fornecido
      if (!req.params.userId) {
        console.error(`[GET /api/transactions/:userId] ID de usuário não fornecido`);
        return res.status(400).json({ message: "ID de usuário não fornecido" });
      }

      const userId = parseInt(req.params.userId);

      // Verificar se o userId é um número válido
      if (isNaN(userId) || userId <= 0) {
        console.error(`[GET /api/transactions/:userId] ID de usuário inválido: ${req.params.userId}`);
        return res.status(400).json({ message: "ID de usuário inválido" });
      }

      console.log(`[GET /api/transactions/:userId] Buscando transações para usuário ${userId}`);

      // Atualizar status de transações vencidas primeiro
      const { pool } = await import('./db');
      const today = new Date().toISOString().split('T')[0];

      console.log(`[GET /api/transactions/:userId] Atualizando status de transações vencidas (data atual: ${today})`);

      try {
        // Atualizar transações vencidas
        await pool.query(`
          UPDATE transactions 
          SET status = 'atrasada' 
          WHERE user_id = $1 
            AND type = 'expense'
            AND date < $2
            AND status = 'a_pagar'
        `, [userId, today]);

        console.log(`[GET /api/transactions/:userId] Status de transações vencidas atualizado`);
      } catch (updateError) {
        console.error(`[GET /api/transactions/:userId] Erro ao atualizar status de transações:`, updateError);
        // Continuamos mesmo com erro na atualização de status
      }

      // Buscar diretamente do banco para garantir que obteremos os dados
      try {
        const result = await pool.query(`
          SELECT 
            t.*,
            c.name as category_name,
            c.icon as category_icon,
            c.type as category_type
          FROM transactions t
          LEFT JOIN categories c ON t.category_id = c.id
          WHERE t.user_id = $1
          ORDER BY t.date DESC
        `, [userId]);

        // Transformar os dados para incluir a categoria como um objeto aninhado
        const transactions = result.rows.map(row => ({
          ...row,
          category: row.category_id ? {
            id: row.category_id,
            name: row.category_name,
            icon: row.category_icon,
            type: row.category_type
          } : null,
          // Manter campos antigos para compatibilidade
          category_name: row.category_name,
          category_icon: row.category_icon
        }));

        console.log(`[GET /api/transactions/:userId] Encontradas ${transactions.length} transações`);
        return res.json(transactions);
      } catch (queryError) {
        console.error(`[GET /api/transactions/:userId] Erro na consulta SQL:`, queryError);
        return res.status(500).json({ 
          message: "Erro ao buscar transações do banco de dados",
          error: queryError instanceof Error ? queryError.message : String(queryError)
        });
      }
    } catch (error) {
      console.error(`[GET /api/transactions/:userId] Erro geral:`, error);
      res.status(500).json({ 
        message: "Erro ao buscar transações",
        error: error instanceof Error ? error.message : String(error)
      });
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
        isRecurring: req.body.isRecurring === 'true',
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

      const { pool } = await import('./db');
      // Primeiro verificamos se a coluna attachment_path existe na tabela
      const columnCheckResult = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'transactions' 
        AND column_name = 'attachment_path'
      `);

      // Se a coluna não existir, alteramos a query para não incluir esse campo
      if (columnCheckResult.rows.length === 0) {
        console.log(`[DEBUG] Coluna attachment_path não encontrada na tabela, usando query alternativa`);
        const result = await pool.query(
          'INSERT INTO transactions (user_id, description, amount, type, category_id, date, recurring_id, is_recurring) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
          [
            validatedData.userId,
            validatedData.description,
            validatedData.amount,
            validatedData.type,
            validatedData.categoryId,
            validatedData.date,
            validatedData.recurringId || null,
            validatedData.isRecurring || false
          ]
        );
        return res.status(201).json(result.rows[0]);
      } else {
        const result = await pool.query(
          'INSERT INTO transactions (user_id, description, amount, type, category_id, date, recurring_id, attachment_path, is_recurring) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
          [
            validatedData.userId,
            validatedData.description,
            validatedData.amount,
            validatedData.type,
            validatedData.categoryId,
            validatedData.date,
            validatedData.recurringId || null,
            validatedData.attachmentPath || null,
            validatedData.isRecurring || false
          ]
        );
        return res.status(201).json(result.rows[0]);
      }
    } catch (error) {
      console.error("Erro ao criar transação:", error);
      res.status(500).json({
        message: "Erro ao criar transação. Por favor, verifique os dados e tente novamente.",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  app.patch("/api/transactions/:id", upload.single("attachment"), async (req, res) => {
    try {
      const transactionId = parseInt(req.params.id);
      console.log(`[PATCH /api/transactions/:id] Body para transação ${transactionId}:`, req.body);
      console.log(`[PATCH /api/transactions/:id] Headers:`, req.headers);

      // Log melhorado para depuração do status
      if (req.body.status !== undefined) {
        console.log(`[PATCH /api/transactions/:id] Status encontrado: "${req.body.status}" (tipo: ${typeof req.body.status})`);
      } else {
        console.log(`[PATCH /api/transactions/:id] Status não encontrado no req.body`);
        // Tentar encontrar em outras propriedades do request
        console.log(`[PATCH /api/transactions/:id] Keys disponíveis no body:`, Object.keys(req.body));
      }

      console.log(`[PATCH /api/transactions/:id] Tipo de Content-Type:`, req.headers['content-type']);
      console.log(`[PATCH /api/transactions/:id] Arquivo enviado:`, req.file || "Nenhum");

      // Verificar se o ID é válido
      if (isNaN(transactionId) || transactionId <= 0) {
        console.log(`[PATCH /api/transactions/:id] ID inválido: ${req.params.id}`);
        return res.status(400).json({ message: "ID de transação inválido" });
      }

      // Get existing transaction directly from database
      const { pool } = await import('./db');
      const existingTransactionResult = await pool.query('SELECT * FROM transactions WHERE id = $1', [transactionId]);

      if (existingTransactionResult.rows.length === 0) {
        console.log(`[PATCH /api/transactions/:id] Transação não encontrada com ID: ${transactionId}`);
        return res.status(404).json({ message: "Transação não encontrada" });
      }

      const existingTransaction = existingTransactionResult.rows[0];
      console.log(`[PATCH /api/transactions/:id] Transação existente:`, existingTransaction);

      // Prepare update data - campos e valores para a consulta SQL
      const updateFields = [];
      const updateValues = [];
      let valueIndex = 1;
      const updateData: Record<string, any> = {};

      // Simplificar a lógica para atualizar o status
      if (req.body.status !== undefined) {
        let statusValue = req.body.status;

        // Verificar se o status é uma string válida
        if (typeof statusValue !== 'string') {
          statusValue = String(statusValue);
        }

        // Validar os valores permitidos para status
        const validStatus = ['paga', 'a_pagar', 'atrasada'];
        if (!validStatus.includes(statusValue)) {
          console.log(`[PATCH /api/transactions/:id] Status inválido: ${statusValue}`);
          return res.status(400).json({ message: `Status inválido. Valores permitidos: ${validStatus.join(', ')}` });
        }

        updateFields.push(`status = $${valueIndex++}`);
        updateValues.push(statusValue);
        updateData.status = statusValue;
        console.log(`[PATCH /api/transactions/:id] Status atualizado para: ${statusValue}`);
      }

      if (updateFields.length === 0) {
        console.log(`[PATCH /api/transactions/:id] Nenhum campo para atualizar`);
        return res.status(400).json({ message: "Nenhum campo válido para atualização" });
      }

      // Build and execute the update query
      const updateQuery = `
        UPDATE transactions 
        SET ${updateFields.join(', ')} 
        WHERE id = $${valueIndex++} 
        RETURNING *
      `;

      updateValues.push(transactionId);

      const result = await pool.query(updateQuery, updateValues);

      if (result.rows.length === 0) {
        console.log(`[PATCH /api/transactions/:id] Falha ao atualizar transação`);
        return res.status(500).json({ message: "Falha ao atualizar transação" });
      }

      console.log(`[PATCH /api/transactions/:id] Transação atualizada com sucesso:`, result.rows[0]);
      return res.json(result.rows[0]);
    } catch (error) {
      console.error(`[PATCH /api/transactions/:id] Erro:`, error);
      return res.status(500).json({ 
        message: "Erro ao atualizar transação", 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // … última rota PATCH …

  // Cria o HTTP server e retorna
  const server: Server = createServer(app);
  return server;
}
