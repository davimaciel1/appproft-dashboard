/**
 * Middleware de Isolamento Multi-tenant
 * Garante que cada usuário só acessa seus próprios dados
 */

const secureLogger = require('../utils/secureLogger');

/**
 * Middleware para garantir isolamento de tenant
 */
const tenantIsolation = (req, res, next) => {
  try {
    // Verifica se o usuário está autenticado
    if (!req.userId) {
      secureLogger.warn('Tentativa de acesso sem autenticação', {
        path: req.path,
        ip: req.ip
      });
      return res.status(401).json({ error: 'Não autenticado' });
    }

    // Adiciona o tenantId ao request (neste caso, é o próprio userId)
    req.tenantId = req.userId;

    // Adiciona funções helper para queries seguras
    req.secureTenantQuery = (baseQuery, params = []) => {
      // Sempre adiciona WHERE user_id = ? ou AND user_id = ?
      if (baseQuery.toLowerCase().includes('where')) {
        return {
          query: `${baseQuery} AND user_id = ?`,
          params: [...params, req.tenantId]
        };
      } else {
        return {
          query: `${baseQuery} WHERE user_id = ?`,
          params: [...params, req.tenantId]
        };
      }
    };

    // Validação adicional para operações críticas
    req.validateOwnership = async (resourceTable, resourceId, client) => {
      const query = `SELECT user_id FROM ${resourceTable} WHERE id = ? AND user_id = ?`;
      const result = await client.query(query, [resourceId, req.tenantId]);
      
      if (result.rows.length === 0) {
        secureLogger.warn('Tentativa de acesso a recurso não autorizado', {
          userId: req.userId,
          resourceTable,
          resourceId
        });
        return false;
      }
      
      return true;
    };

    // Log de auditoria
    secureLogger.info('Acesso autorizado', {
      userId: req.userId,
      tenantId: req.tenantId,
      path: req.path,
      method: req.method
    });

    next();
  } catch (error) {
    secureLogger.error('Erro no middleware de isolamento', {
      error: error.message,
      userId: req.userId
    });
    res.status(500).json({ error: 'Erro interno' });
  }
};

/**
 * Middleware para operações administrativas (se necessário no futuro)
 */
const adminOnly = (req, res, next) => {
  // Por enquanto, não há usuários admin
  // Implementar quando necessário
  secureLogger.warn('Tentativa de acesso administrativo', {
    userId: req.userId,
    path: req.path
  });
  
  res.status(403).json({ error: 'Acesso negado' });
};

module.exports = {
  tenantIsolation,
  adminOnly
};