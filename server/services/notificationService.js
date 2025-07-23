const cron = require('node-cron');

class NotificationService {
  constructor() {
    this.io = null;
    this.lastOrderIds = {
      amazon: new Set(),
      mercadolivre: new Set()
    };
  }

  initialize(io) {
    this.io = io;
    console.log('Serviço de notificações inicializado');
    
    // Verificar novos pedidos a cada 30 segundos
    cron.schedule('*/30 * * * * *', () => {
      this.checkNewOrders();
    });

    // Simular novo pedido a cada 2 minutos (para demonstração)
    if (process.env.USE_MOCK_DATA === 'true') {
      cron.schedule('*/2 * * * *', () => {
        this.simulateNewOrder();
      });
    }
  }

  async checkNewOrders() {
    try {
      // Verificar pedidos Amazon
      const amazonOrders = await this.getAmazonOrders();
      this.processNewOrders(amazonOrders, 'amazon');

      // Verificar pedidos Mercado Livre
      const mlOrders = await this.getMercadoLivreOrders();
      this.processNewOrders(mlOrders, 'mercadolivre');
    } catch (error) {
      console.error('Erro ao verificar novos pedidos:', error);
    }
  }

  processNewOrders(orders, marketplace) {
    orders.forEach(order => {
      if (!this.lastOrderIds[marketplace].has(order.orderId)) {
        this.lastOrderIds[marketplace].add(order.orderId);
        this.notifyNewOrder(order, marketplace);
      }
    });
  }

  notifyNewOrder(order, marketplace) {
    const notification = {
      id: Date.now(),
      type: 'new_order',
      marketplace,
      order: {
        orderId: order.orderId,
        total: order.total,
        items: order.items,
        product: order.productName || 'Novo Pedido',
        timestamp: new Date()
      }
    };

    // Emitir para todos os clientes conectados
    if (this.io) {
      this.io.emit('newOrder', notification);
      console.log(`Nova notificação de pedido ${marketplace}:`, notification.order.orderId);
    }
  }

  simulateNewOrder() {
    const marketplaces = ['amazon', 'mercadolivre'];
    const products = [
      'Echo Dot (4ª Geração)',
      'Kindle Paperwhite',
      'JBL Go 3',
      'Fone Bluetooth QCY',
      'Smart Lâmpada RGB'
    ];

    const marketplace = marketplaces[Math.floor(Math.random() * marketplaces.length)];
    const product = products[Math.floor(Math.random() * products.length)];
    
    const mockOrder = {
      orderId: `${marketplace.toUpperCase()}-${Date.now()}`,
      total: Math.floor(Math.random() * 500) + 50,
      items: Math.floor(Math.random() * 5) + 1,
      productName: product
    };

    this.notifyNewOrder(mockOrder, marketplace);
  }

  async getAmazonOrders() {
    // Aqui você integraria com o amazonService.getOrders()
    // Por enquanto retorna array vazio
    return [];
  }

  async getMercadoLivreOrders() {
    // Aqui você integraria com o mercadolivreService.getOrders()
    // Por enquanto retorna array vazio
    return [];
  }

  // Método para enviar notificações manuais
  sendCustomNotification(type, data) {
    if (this.io) {
      this.io.emit(type, data);
    }
  }
}

module.exports = new NotificationService();