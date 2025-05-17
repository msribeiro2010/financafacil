
import { pool } from "../server/db";

async function addIncomeCategories() {
  try {
    console.log("Adicionando categorias adicionais de receitas...");
    
    // Categorias adicionais de receitas
    const newCategories = [
      { name: "Salário", type: "income", icon: "ri-money-dollar-circle-line" },
      { name: "Depósitos Diversos", type: "income", icon: "ri-bank-line" },
      { name: "Transferência", type: "income", icon: "ri-exchange-funds-line" },
      { name: "Rendimentos", type: "income", icon: "ri-line-chart-line" },
      { name: "Empréstimo", type: "income", icon: "ri-hand-coin-line" },
      { name: "Restituição", type: "income", icon: "ri-refund-2-line" },
      { name: "Venda de Bens", type: "income", icon: "ri-store-2-line" },
      { name: "Aluguel", type: "income", icon: "ri-home-4-line" }
    ];
    
    // Inserir categorias verificando se já existem
    for (const category of newCategories) {
      // Verificar se a categoria já existe
      const checkResult = await pool.query(
        "SELECT id FROM categories WHERE name = $1 AND type = $2",
        [category.name, category.type]
      );
      
      if (checkResult.rows.length === 0) {
        // Categoria não existe, vamos criar
        await pool.query(
          "INSERT INTO categories (name, type, icon) VALUES ($1, $2, $3)",
          [category.name, category.type, category.icon]
        );
        console.log(`Categoria '${category.name}' (${category.type}) adicionada com sucesso.`);
      } else {
        console.log(`Categoria '${category.name}' (${category.type}) já existe.`);
      }
    }
    
    console.log("Processo concluído!");
  } catch (error) {
    console.error("Erro ao adicionar categorias:", error);
  } finally {
    await pool.end();
  }
}

// Executar o script
addIncomeCategories();
