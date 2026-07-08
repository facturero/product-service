/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    await queryInterface.bulkInsert('tax_rates', [
      {
        id: '00000000-0000-0000-0000-000000000001',
        country_code: 'EC',
        code: 'IVA15',
        name: 'IVA 15%',
        percentage: '15.00',
        kind: 'vat',
        is_default: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: '00000000-0000-0000-0000-000000000002',
        country_code: 'EC',
        code: 'IVA0',
        name: 'IVA 0%',
        percentage: '0.00',
        kind: 'vat',
        is_default: false,
        created_at: now,
        updated_at: now,
      },
      {
        id: '00000000-0000-0000-0000-000000000003',
        country_code: 'EC',
        code: 'NO_OBJETO',
        name: 'No objeto de IVA',
        percentage: '0.00',
        kind: 'vat',
        is_default: false,
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('tax_rates', { country_code: 'EC' });
  },
};
