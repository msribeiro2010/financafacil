
import { pool } from "../server/db";

async function addCategories() {
  try {
    console.log("Adicionando categorias adicionais...");
    
    // Categorias adicionais
    const newCategories = [
      { name: "Cartão de Crédito", type: "expense", icon: "ri-bank-card-line" },
      { name: "Empréstimos", type: "expense", icon: "ri-money-dollar-box-line" },
      { name: "Educação dos Filhos", type: "expense", icon: "ri-graduation-cap-line" },
      { name: "Academia", type: "expense", icon: "ri-heart-pulse-line" },
      { name: "Assinaturas", type: "expense", icon: "ri-netflix-fill" },
      { name: "Presente", type: "expense", icon: "ri-gift-line" },
      { name: "Bônus", type: "income", icon: "ri-money-dollar-box-line" },
      { name: "Reembolso", type: "income", icon: "ri-refund-line" },
      { name: "Pensão", type: "income", icon: "ri-hand-coin-line" }
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
addCategories();
