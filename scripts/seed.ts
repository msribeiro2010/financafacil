import { db } from "../server/db";
import { users, categories } from "../shared/schema";

async function seed() {
  console.log("Starting database seeding...");

  // Check if there are any users in the database
  const existingUsers = await db.select().from(users);
  if (existingUsers.length > 0) {
    console.log("Database already has users. Skipping seeding.");
    process.exit(0);
  }

  // Create demo user
  console.log("Creating demo user...");
  const [demoUser] = await db.insert(users).values({
    username: "demo",
    password: "demo123",
    initialBalance: "1800.00",
    overdraftLimit: "1000.00"
  }).returning();

  // Create default categories
  console.log("Creating default categories...");
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
    await db.insert(categories).values(category);
  }

  console.log("Database seeding completed successfully!");
  process.exit(0);
}

seed().catch(error => {
  console.error("Error seeding database:", error);
  process.exit(1);
});