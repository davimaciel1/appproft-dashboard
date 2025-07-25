const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const tokenManager = require('../services/tokenManager');
const AmazonService = require('../services/amazonService');
const BrandOwnerCompetitorService = require('../services/brandOwnerCompetitorService');

// Obter informações do brand owner
router.get('/info', async (req, res) => {
  try {
    // Por enquanto usar o seller_id do env ou da sessão
    const sellerId = process.env.AMAZON_SELLER_ID || req.user?.sellerId || 'default';
    
    const result = await pool.query(`
      SELECT * FROM brand_owners WHERE seller_id = $1 LIMIT 1
    `, [sellerId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Brand owner não encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Erro ao buscar brand owner:', error);
    res.status(500).json({ error: 'Erro ao buscar informações' });
  }
});

// Listar competidores
router.get('/competitors', async (req, res) => {
  try {
    const sellerId = process.env.AMAZON_SELLER_ID || req.user?.sellerId || 'default';
    
    const result = await pool.query(`
      SELECT 
        mc.id,
        mc.our_asin,
        p1.name as our_product,
        mc.competitor_asin,
        mc.competitor_brand,
        mc.competition_level,
        cm.our_price,
        cm.competitor_price,
        cm.price_difference,
        cm.price_difference_percent,
        CASE 
          WHEN cm.our_price < cm.competitor_price THEN 'Vantagem'
          WHEN cm.our_price = cm.competitor_price THEN 'Empate'
          ELSE 'Desvantagem'
        END as price_position,
        cm.our_rank,
        cm.competitor_rank,
        cm.our_rating,
        cm.competitor_rating,
        cm.monitoring_date
      FROM brand_owners bo
      JOIN manual_competitors mc ON bo.id = mc.brand_owner_id
      LEFT JOIN products p1 ON mc.our_asin = p1.asin
      LEFT JOIN competitor_monitoring cm ON mc.id = cm.manual_competitor_id
        AND cm.monitoring_date = (
          SELECT MAX(monitoring_date) 
          FROM competitor_monitoring cm2 
          WHERE cm2.manual_competitor_id = mc.id
        )
      WHERE bo.seller_id = $1 AND mc.is_active = true
      ORDER BY mc.created_at DESC
    `, [sellerId]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar competidores:', error);
    res.status(500).json({ error: 'Erro ao buscar competidores' });
  }
});

// Adicionar competidor
router.post('/competitors', async (req, res) => {
  try {
    const { ourAsin, competitorAsin, competitorBrand, notes } = req.body;
    const sellerId = process.env.AMAZON_SELLER_ID || req.user?.sellerId || 'default';
    
    const amazonService = new AmazonService(tokenManager, 'default');
    const brandOwnerService = new BrandOwnerCompetitorService(amazonService, pool);
    
    const competitorId = await brandOwnerService.addManualCompetitor(
      sellerId,
      ourAsin,
      competitorAsin,
      competitorBrand || 'Unknown',
      'direct',
      notes
    );
    
    res.json({ 
      success: true, 
      competitorId,
      message: 'Competidor adicionado com sucesso' 
    });
  } catch (error) {
    console.error('Erro ao adicionar competidor:', error);
    res.status(500).json({ error: error.message });
  }
});

// Monitorar competidores
router.post('/monitor', async (req, res) => {
  try {
    const sellerId = process.env.AMAZON_SELLER_ID || req.user?.sellerId || 'default';
    
    const amazonService = new AmazonService(tokenManager, 'default');
    const brandOwnerService = new BrandOwnerCompetitorService(amazonService, pool);
    
    const result = await brandOwnerService.monitorAllBrandOwnerCompetitors(sellerId);
    
    res.json({
      success: true,
      ...result,
      message: `Monitoramento concluído: ${result.success} competidores atualizados`
    });
  } catch (error) {
    console.error('Erro ao monitorar competidores:', error);
    res.status(500).json({ error: error.message });
  }
});

// Remover competidor
router.delete('/competitors/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const sellerId = process.env.AMAZON_SELLER_ID || req.user?.sellerId || 'default';
    
    // Verificar se o competidor pertence ao seller
    const checkResult = await pool.query(`
      SELECT mc.id FROM manual_competitors mc
      JOIN brand_owners bo ON mc.brand_owner_id = bo.id
      WHERE mc.id = $1 AND bo.seller_id = $2
    `, [id, sellerId]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Competidor não encontrado' });
    }
    
    // Desativar competidor (soft delete)
    await pool.query(`
      UPDATE manual_competitors 
      SET is_active = false, updated_at = NOW()
      WHERE id = $1
    `, [id]);
    
    res.json({ success: true, message: 'Competidor removido' });
  } catch (error) {
    console.error('Erro ao remover competidor:', error);
    res.status(500).json({ error: error.message });
  }
});

// Obter histórico de monitoramento
router.get('/history/:competitorId', async (req, res) => {
  try {
    const { competitorId } = req.params;
    const sellerId = process.env.AMAZON_SELLER_ID || req.user?.sellerId || 'default';
    
    // Verificar permissão
    const checkResult = await pool.query(`
      SELECT mc.id FROM manual_competitors mc
      JOIN brand_owners bo ON mc.brand_owner_id = bo.id
      WHERE mc.id = $1 AND bo.seller_id = $2
    `, [competitorId, sellerId]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Competidor não encontrado' });
    }
    
    // Buscar histórico
    const history = await pool.query(`
      SELECT 
        monitoring_date,
        our_price,
        competitor_price,
        price_difference,
        price_difference_percent,
        our_rank,
        competitor_rank
      FROM competitor_monitoring
      WHERE manual_competitor_id = $1
      ORDER BY monitoring_date DESC
      LIMIT 30
    `, [competitorId]);
    
    res.json(history.rows);
  } catch (error) {
    console.error('Erro ao buscar histórico:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;