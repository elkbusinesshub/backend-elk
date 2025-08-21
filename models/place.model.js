const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/db');

class Place extends Model {
  static associate(models) {
    this.belongsTo(models.Place, { as: 'state', foreignKey: 'state' });
    this.belongsTo(models.Place, { as: 'district', foreignKey: 'district' });
    this.belongsTo(models.Place, { as: 'locality', foreignKey: 'locality' });
  }

  static async orderByDistance(latitude, longitude) {
    return this.sequelize.query(
      `SELECT *,
        (6371 * acos(cos(radians(:latitude)) * cos(radians(latitude)) * cos(radians(longitude) - radians(:longitude)) + sin(radians(:latitude)) * sin(radians(latitude)))) AS distance
      FROM Places
      ORDER BY distance`,
      {
        replacements: { latitude, longitude },
        type: sequelize.QueryTypes.SELECT,
      }
    );
  }
}

Place.init(
  {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
    },
    type: {
      type: DataTypes.STRING,
    },
    locality: {
      type: DataTypes.STRING,
    },
    place: {
      type: DataTypes.STRING,
    },
    district: {
      type: DataTypes.STRING,
    },
    state: {
      type: DataTypes.STRING,
    },
    country: {
      type: DataTypes.STRING,
    },
    longitude: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    latitude: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: 'Place',
    tableName: 'places',
    timestamps: false,
  }
);

module.exports = Place;
