/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.dropTable('tax_rates');
  },

  async down(queryInterface, Sequelize) {
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
  },
};
