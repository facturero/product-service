/** @type {import('sequelize-cli').Migration} */
module.exports = {
  // El listado de productos filtra por organization_id y ordena por
  // created_at DESC, id DESC. Sin este índice compuesto MySQL resolvía la
  // ordenación con un filesort de TODAS las filas del org en cada petición
  // (más un COUNT que escanea lo mismo) → GET /products se hundía a ~17 RPS.
  async up(queryInterface) {
    await queryInterface.addIndex('products', ['organization_id', 'created_at', 'id'], {
      name: 'products_org_created',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('products', 'products_org_created');
  },
};
