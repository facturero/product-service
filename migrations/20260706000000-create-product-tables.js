/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. categories
    await queryInterface.createTable('categories', {
      id: { type: Sequelize.CHAR(36), primaryKey: true },
      organization_id: { type: Sequelize.CHAR(36), allowNull: false },
      name: { type: Sequelize.STRING(255), allowNull: false },
      description: { type: Sequelize.STRING(255), allowNull: true },
      parent_id: {
        type: Sequelize.CHAR(36),
        allowNull: true,
        references: { model: 'categories', key: 'id' },
        onDelete: 'SET NULL',
      },
      status: { type: Sequelize.ENUM('active', 'inactive'), allowNull: false, defaultValue: 'active' },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('categories', ['organization_id', 'name', 'parent_id'], { unique: true });

    // 2. units
    await queryInterface.createTable('units', {
      id: { type: Sequelize.CHAR(36), primaryKey: true },
      organization_id: { type: Sequelize.CHAR(36), allowNull: false },
      code: { type: Sequelize.STRING(20), allowNull: false },
      name: { type: Sequelize.STRING(100), allowNull: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('units', ['organization_id', 'code'], { unique: true });

    // 3. products
    await queryInterface.createTable('products', {
      id: { type: Sequelize.CHAR(36), primaryKey: true },
      organization_id: { type: Sequelize.CHAR(36), allowNull: false },
      sku: { type: Sequelize.STRING(64), allowNull: true },
      name: { type: Sequelize.STRING(255), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      type: { type: Sequelize.ENUM('good', 'service'), allowNull: false, defaultValue: 'good' },
      category_id: {
        type: Sequelize.CHAR(36),
        allowNull: true,
        references: { model: 'categories', key: 'id' },
        onDelete: 'SET NULL',
      },
      unit_id: {
        type: Sequelize.CHAR(36),
        allowNull: true,
        references: { model: 'units', key: 'id' },
        onDelete: 'SET NULL',
      },
      price_cents: { type: Sequelize.BIGINT, allowNull: false, defaultValue: 0 },
      currency_code: { type: Sequelize.CHAR(3), allowNull: false, defaultValue: 'USD' },
      price_includes_tax: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      track_stock: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      status: { type: Sequelize.ENUM('active', 'inactive'), allowNull: false, defaultValue: 'active' },
      metadata: { type: Sequelize.JSON, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('products', ['organization_id', 'sku'], { unique: true });
    await queryInterface.addIndex('products', ['organization_id', 'status']);

    // 4. product_taxes
    await queryInterface.createTable('product_taxes', {
      id: { type: Sequelize.CHAR(36), primaryKey: true },
      product_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: { model: 'products', key: 'id' },
        onDelete: 'CASCADE',
      },
      tax_rate_id: { type: Sequelize.CHAR(36), allowNull: false },
      kind: { type: Sequelize.STRING(30), allowNull: false },
    });
    await queryInterface.addIndex('product_taxes', ['product_id', 'tax_rate_id'], { unique: true });

    // 5. product_images
    await queryInterface.createTable('product_images', {
      id: { type: Sequelize.CHAR(36), primaryKey: true },
      product_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: { model: 'products', key: 'id' },
        onDelete: 'CASCADE',
      },
      organization_id: { type: Sequelize.CHAR(36), allowNull: false },
      file_id: { type: Sequelize.CHAR(36), allowNull: false },
      alt: { type: Sequelize.STRING(255), allowNull: true },
      is_primary: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      position: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('product_images', ['product_id', 'file_id'], { unique: true });
    await queryInterface.addIndex('product_images', ['product_id', 'is_primary']);

    // 6. tax_rates (read-model)
    await queryInterface.createTable('tax_rates', {
      id: { type: Sequelize.CHAR(36), primaryKey: true },
      country_code: { type: Sequelize.STRING(2), allowNull: false },
      code: { type: Sequelize.STRING(20), allowNull: false },
      name: { type: Sequelize.STRING(100), allowNull: true },
      percentage: { type: Sequelize.DECIMAL(6, 2), allowNull: false },
      kind: { type: Sequelize.STRING(30), allowNull: false },
      is_default: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('tax_rates', ['country_code', 'code'], { unique: true });

    // 7. outbox_messages
    await queryInterface.createTable('outbox_messages', {
      id: { type: Sequelize.CHAR(36), primaryKey: true },
      aggregate_type: { type: Sequelize.STRING(50), allowNull: false },
      aggregate_id: { type: Sequelize.CHAR(36), allowNull: false },
      type: { type: Sequelize.STRING(100), allowNull: false },
      payload: { type: Sequelize.JSON, allowNull: false },
      occurred_at: { type: Sequelize.DATE, allowNull: false },
      processed_at: { type: Sequelize.DATE, allowNull: true },
    });
    await queryInterface.addIndex('outbox_messages', ['processed_at']);

    // 8. processed_events
    await queryInterface.createTable('processed_events', {
      event_id: { type: Sequelize.CHAR(36), primaryKey: true },
      processed_at: { type: Sequelize.DATE, allowNull: false },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('processed_events');
    await queryInterface.dropTable('outbox_messages');
    await queryInterface.dropTable('tax_rates');
    await queryInterface.dropTable('product_images');
    await queryInterface.dropTable('product_taxes');
    await queryInterface.dropTable('products');
    await queryInterface.dropTable('units');
    await queryInterface.dropTable('categories');
  },
};
