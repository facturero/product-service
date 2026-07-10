import { DataTypes, InferAttributes, InferCreationAttributes, Model } from 'sequelize';
import { sequelize } from './sequelize.js';

export class CategoryModel extends Model<
  InferAttributes<CategoryModel>,
  InferCreationAttributes<CategoryModel>
> {
  declare id: string;
  declare organization_id: string;
  declare name: string;
  declare description: string | null;
  declare parent_id: string | null;
  declare status: 'active' | 'inactive';
  declare created_at: Date;
  declare updated_at: Date;
}

CategoryModel.init(
  {
    id: { type: DataTypes.CHAR(36), primaryKey: true },
    organization_id: { type: DataTypes.CHAR(36), allowNull: false },
    name: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.STRING(255), allowNull: true },
    parent_id: { type: DataTypes.CHAR(36), allowNull: true },
    status: { type: DataTypes.ENUM('active', 'inactive'), allowNull: false, defaultValue: 'active' },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  { sequelize, tableName: 'categories', timestamps: false },
);

export class UnitModel extends Model<
  InferAttributes<UnitModel>,
  InferCreationAttributes<UnitModel>
> {
  declare id: string;
  declare organization_id: string;
  declare code: string;
  declare name: string;
  declare created_at: Date;
  declare updated_at: Date;
}

UnitModel.init(
  {
    id: { type: DataTypes.CHAR(36), primaryKey: true },
    organization_id: { type: DataTypes.CHAR(36), allowNull: false },
    code: { type: DataTypes.STRING(20), allowNull: false },
    name: { type: DataTypes.STRING(100), allowNull: false },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  { sequelize, tableName: 'units', timestamps: false },
);

export class ProductModel extends Model<
  InferAttributes<ProductModel>,
  InferCreationAttributes<ProductModel>
> {
  declare id: string;
  declare organization_id: string;
  declare sku: string | null;
  declare name: string;
  declare description: string | null;
  declare type: 'good' | 'service';
  declare category_id: string | null;
  declare unit_id: string | null;
  declare price_cents: number;
  declare currency_code: string;
  declare price_includes_tax: boolean;
  declare track_stock: boolean;
  declare status: 'active' | 'inactive';
  declare metadata: unknown | null;
  declare created_at: Date;
  declare updated_at: Date;
}

ProductModel.init(
  {
    id: { type: DataTypes.CHAR(36), primaryKey: true },
    organization_id: { type: DataTypes.CHAR(36), allowNull: false },
    sku: { type: DataTypes.STRING(64), allowNull: true },
    name: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    type: { type: DataTypes.ENUM('good', 'service'), allowNull: false, defaultValue: 'good' },
    category_id: { type: DataTypes.CHAR(36), allowNull: true },
    unit_id: { type: DataTypes.CHAR(36), allowNull: true },
    price_cents: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0 },
    currency_code: { type: DataTypes.CHAR(3), allowNull: false, defaultValue: 'USD' },
    price_includes_tax: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    track_stock: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    status: { type: DataTypes.ENUM('active', 'inactive'), allowNull: false, defaultValue: 'active' },
    metadata: { type: DataTypes.JSON, allowNull: true },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  { sequelize, tableName: 'products', timestamps: false },
);

export class ProductTaxModel extends Model<
  InferAttributes<ProductTaxModel>,
  InferCreationAttributes<ProductTaxModel>
> {
  declare id: string;
  declare product_id: string;
  declare tax_rate_id: string;
  declare kind: 'vat' | 'withholding_iva' | 'withholding_rent' | 'special';
}

ProductTaxModel.init(
  {
    id: { type: DataTypes.CHAR(36), primaryKey: true },
    product_id: { type: DataTypes.CHAR(36), allowNull: false },
    tax_rate_id: { type: DataTypes.CHAR(36), allowNull: false },
    kind: { type: DataTypes.ENUM('vat', 'withholding_iva', 'withholding_rent', 'special'), allowNull: false },
  },
  { sequelize, tableName: 'product_taxes', timestamps: false },
);

export class ProductImageModel extends Model<
  InferAttributes<ProductImageModel>,
  InferCreationAttributes<ProductImageModel>
> {
  declare id: string;
  declare product_id: string;
  declare organization_id: string;
  declare file_id: string;
  declare alt: string | null;
  declare is_primary: boolean;
  declare position: number;
  declare created_at: Date;
}

ProductImageModel.init(
  {
    id: { type: DataTypes.CHAR(36), primaryKey: true },
    product_id: { type: DataTypes.CHAR(36), allowNull: false },
    organization_id: { type: DataTypes.CHAR(36), allowNull: false },
    file_id: { type: DataTypes.CHAR(36), allowNull: false },
    alt: { type: DataTypes.STRING(255), allowNull: true },
    is_primary: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    created_at: DataTypes.DATE,
  },
  { sequelize, tableName: 'product_images', timestamps: false },
);

export class OutboxModel extends Model<
  InferAttributes<OutboxModel>,
  InferCreationAttributes<OutboxModel>
> {
  declare id: string;
  declare aggregate_type: string;
  declare aggregate_id: string;
  declare type: string;
  declare payload: unknown;
  declare occurred_at: Date;
  declare processed_at: Date | null;
}

OutboxModel.init(
  {
    id: { type: DataTypes.CHAR(36), primaryKey: true },
    aggregate_type: { type: DataTypes.STRING(50), allowNull: false },
    aggregate_id: { type: DataTypes.CHAR(36), allowNull: false },
    type: { type: DataTypes.STRING(100), allowNull: false },
    payload: { type: DataTypes.JSON, allowNull: false },
    occurred_at: { type: DataTypes.DATE, allowNull: false },
    processed_at: { type: DataTypes.DATE, allowNull: true },
  },
  { sequelize, tableName: 'outbox_messages', timestamps: false },
);

export class ProcessedEventModel extends Model<
  InferAttributes<ProcessedEventModel>,
  InferCreationAttributes<ProcessedEventModel>
> {
  declare event_id: string;
  declare processed_at: Date;
}

ProcessedEventModel.init(
  {
    event_id: { type: DataTypes.CHAR(36), primaryKey: true },
    processed_at: { type: DataTypes.DATE, allowNull: false },
  },
  { sequelize, tableName: 'processed_events', timestamps: false },
);

// Asociaciones
ProductModel.belongsTo(CategoryModel, { foreignKey: 'category_id', as: 'category' });
CategoryModel.hasMany(ProductModel, { foreignKey: 'category_id', as: 'products' });

ProductModel.belongsTo(UnitModel, { foreignKey: 'unit_id', as: 'unit' });
UnitModel.hasMany(ProductModel, { foreignKey: 'unit_id', as: 'products' });

ProductModel.hasMany(ProductTaxModel, { foreignKey: 'product_id', as: 'taxes' });
ProductTaxModel.belongsTo(ProductModel, { foreignKey: 'product_id' });

ProductModel.hasMany(ProductImageModel, { foreignKey: 'product_id', as: 'images' });
ProductImageModel.belongsTo(ProductModel, { foreignKey: 'product_id' });
