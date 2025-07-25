const pool = require('../../db/pool');

class BuyBoxServiceMock {
  constructor() {
    this.isInitialized = false;
  }

  async syncAllBuyBoxData() {
    console.log('🔄 Buy Box sync simulado (aguardando configuração completa das credenciais)');
    
    // Por enquanto, apenas registrar que tentou sincronizar
    await pool.query(`
      INSERT INTO sync_logs (
        marketplace,
        sync_type,
        records_synced,
        status,
        details,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
    `, [
      'amazon',
      'buy_box_auto',
      0,
      'pending',
      JSON.stringify({
        message: 'Aguardando configuração completa das credenciais AWS',
        automatic: true
      })
    ]);
    
    return {
      total: 0,
      success: 0,
      errors: 0
    };
  }
}

module.exports = new BuyBoxServiceMock();