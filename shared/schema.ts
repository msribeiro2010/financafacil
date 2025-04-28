import { pgTable, text, serial, integer, boolean, date, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  initialBalance: numeric("initial_balance", { precision: 10, scale: 2 }).default("0").notNull(),
  overdraftLimit: numeric("overdraft_limit", { precision: 10, scale: 2 }).default("0").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // "income" or "expense"
  icon: text("icon").notNull().default("ri-question-line"),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  date: date("date").notNull(),
  type: text("type").notNull(), // "income" or "expense"
  categoryId: integer("category_id").references(() => categories.id),
  attachment: text("attachment"), // Path to the uploaded file
  createdAt: timestamp("created_at").defaultNow().notNull(),
  isRecurring: boolean("is_recurring").default(false).notNull(),
  recurringId: integer("recurring_id").references(() => recurringTransactions.id),
});

export const recurringTransactions = pgTable("recurring_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  type: text("type").notNull(), // "income" or "expense"
  categoryId: integer("category_id").references(() => categories.id),
  frequency: text("frequency").notNull(), // monthly, bimonthly, quarterly, semiannual, annual
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  lastProcessed: date("last_processed"),
  attachment: text("attachment"), // Path to the uploaded file
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert Schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true
});

export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true
});

export const insertRecurringTransactionSchema = createInsertSchema(recurringTransactions).omit({
  id: true,
  createdAt: true,
  lastProcessed: true
});

// Extended Schemas
export const accountSettingsSchema = z.object({
  initialBalance: z.string().min(1, { message: "Saldo inicial é obrigatório" }),
  overdraftLimit: z.string().min(1, { message: "Limite de cheque especial é obrigatório" })
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;

export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

export type InsertRecurringTransaction = z.infer<typeof insertRecurringTransactionSchema>;
export type RecurringTransaction = typeof recurringTransactions.$inferSelect;

export type AccountSettings = z.infer<typeof accountSettingsSchema>;

// Custom types for statistics and reporting
export type TransactionSummary = {
  totalIncome: number;
  totalExpenses: number;
  currentBalance: number;
  projectedBalance: number;
};

export type CategorySummary = {
  categoryId: number;
  name: string;
  total: number;
  percentage: number;
  icon: string;
};
