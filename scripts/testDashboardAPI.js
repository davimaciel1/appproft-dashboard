const axios = require("axios");

const API_BASE_URL = process.env.API_URL || "https://appproft.com";

console.log("=== TESTANDO ROTAS DO DASHBOARD ===\n");
console.log("Base URL:", API_BASE_URL);

async function testRoutes() {
  try {
    // 1. Testar health check
    console.log("\n1. Testando /api/health...");
    try {
      const healthResponse = await axios.get(`${API_BASE_URL}/api/health`);
      console.log("✅ Health check OK:", healthResponse.data);
    } catch (error) {
      console.log("❌ Health check falhou:", error.message);
    }
    
    // 2. Testar rota de produtos (dashboard-local)
    console.log("\n2. Testando /api/dashboard-local/products...");
    try {
      const productsResponse = await axios.get(`${API_BASE_URL}/api/dashboard-local/products`, {
        headers: {
          "Authorization": "Bearer test-token" // Ajustar se necessário
        }
      });
      console.log("✅ Produtos retornados:", productsResponse.data.products ? productsResponse.data.products.length : "N/A");
      if (productsResponse.data.products && productsResponse.data.products.length > 0) {
        console.log("Primeiro produto:", productsResponse.data.products[0]);
      }
    } catch (error) {
      console.log("❌ Erro ao buscar produtos:", error.response?.status, error.response?.data || error.message);
    }
    
    // 3. Testar rota de métricas (dashboard-local)
    console.log("\n3. Testando /api/dashboard-local/metrics...");
    try {
      const metricsResponse = await axios.get(`${API_BASE_URL}/api/dashboard-local/metrics`, {
        headers: {
          "Authorization": "Bearer test-token" // Ajustar se necessário
        }
      });
      console.log("✅ Métricas retornadas:", metricsResponse.data);
    } catch (error) {
      console.log("❌ Erro ao buscar métricas:", error.response?.status, error.response?.data || error.message);
    }
    
    // 4. Testar rota pública temporária
    console.log("\n4. Testando /api/public/dashboard...");
    try {
      const publicResponse = await axios.get(`${API_BASE_URL}/api/public/dashboard`);
      console.log("✅ Dados públicos retornados:", {
        produtos: publicResponse.data.products?.length || 0,
        métricas: publicResponse.data.metrics ? "OK" : "N/A"
      });
    } catch (error) {
      console.log("❌ Erro na rota pública:", error.response?.status, error.response?.data || error.message);
    }
    
    // 5. Listar todas as rotas disponíveis
    console.log("\n5. Testando rotas disponíveis...");
    const rotasParaTestar = [
      "/api/dashboard/products",
      "/api/dashboard/metrics",
      "/api/dashboard-local/products", 
      "/api/dashboard-local/metrics",
      "/api/public/dashboard"
    ];
    
    for (const rota of rotasParaTestar) {
      try {
        const response = await axios.head(`${API_BASE_URL}${rota}`);
        console.log(`✅ ${rota} - Status: ${response.status}`);
      } catch (error) {
        console.log(`❌ ${rota} - Status: ${error.response?.status || "Erro"}`);
      }
    }
    
  } catch (error) {
    console.error("\n❌ ERRO GERAL:", error.message);
  }
}

// Executar testes
console.log("\nIniciando testes...");
console.log("Testando em produção: https://appproft.com");
testRoutes();
