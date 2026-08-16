'use strict';

/**
 * Añade dos campos a `products` para soportar el flujo de inventory-service:
 * - allow_negative_stock: si true, billing puede facturar sin stock (inventory
 *   emite `inventory.stock.negative` como alerta). Si false, el intento falla
 *   con 422 INSUFFICIENT_STOCK. Default false por seguridad.
 * - valuation_method: estrategia de valorización que inventory-service usa
 *   al calcular el costo de salida. Default `weighted_average` (estándar SRI EC).
 *
 * Ambos se emiten en el payload de `product.product.upserted` para que
 * inventory-service los reciba en su read-model local.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('products', 'allow_negative_stock', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Si true, billing emite factura aunque no haya stock; solo alerta.',
    });

    await queryInterface.addColumn('products', 'valuation_method', {
      type: Sequelize.ENUM('weighted_average', 'fifo'),
      allowNull: false,
      defaultValue: 'weighted_average',
      comment: 'Estrategia de valorización que aplica inventory-service.',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('products', 'valuation_method');
    await queryInterface.removeColumn('products', 'allow_negative_stock');
    // MySQL: eliminar el tipo ENUM que quedó huérfano.
    // Sequelize lo maneja al hacer removeColumn en la mayoría de motores;
    // en Postgres podría necesitar un DROP TYPE explícito.
  },
};
