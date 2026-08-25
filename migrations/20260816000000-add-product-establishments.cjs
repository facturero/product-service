/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Asignación producto ↔ establecimiento (M:N). Un producto debe estar
    // asignado a al menos un establecimiento de la organización para venderse.
    // El POS sincroniza solo los productos asignados al establecimiento del
    // punto de emisión emparejado. Los establecimientos viven en
    // organization-service (organization_db); aquí solo se referencia el uuid.
    await queryInterface.createTable('product_establishments', {
      product_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
        references: { model: 'products', key: 'id' },
        onDelete: 'CASCADE',
      },
      establishment_id: {
        type: Sequelize.CHAR(36),
        allowNull: false,
      },
      created_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('product_establishments', ['product_id', 'establishment_id'], { unique: true });
    await queryInterface.addIndex('product_establishments', ['establishment_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('product_establishments');
  },
};
