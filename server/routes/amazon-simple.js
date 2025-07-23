const express = require('express');
const router = express.Router();
const axios = require('axios');

// Rota simplificada para testar Amazon
router.get('/test', async (req, res) => {
  try {
    // Obter token
    const tokenResponse = await axios.post('https://api.amazon.com/auth/o2/token', {
      grant_type: 'refresh_token',
      refresh_token: process.env.AMAZON_REFRESH_TOKEN,
      client_id: process.env.AMAZON_SP_API_CLIENT_ID,
      client_secret: process.env.AMAZON_SP_API_CLIENT_SECRET
    });
    
    const accessToken = tokenResponse.data.access_token;
    
    // Buscar pedidos dos últimos 30 dias
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const ordersResponse = await axios.get(
      `https://sellingpartnerapi-na.amazon.com/orders/v0/orders`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-amz-access-token': accessToken
      },
      params: {
        MarketplaceIds: process.env.SP_API_MARKETPLACE_ID,
        CreatedAfter: thirtyDaysAgo.toISOString()
      }
    });
    
    res.json({
      success: true,
      orders: ordersResponse.data.payload?.Orders || [],
      count: ordersResponse.data.payload?.Orders?.length || 0
    });
    
  } catch (error) {
    console.error('Erro Amazon:', error.response?.data || error.message);
    res.status(500).json({ 
      error: error.response?.data || error.message,
      details: error.response?.data?.errors
    });
  }
});

module.exports = router;