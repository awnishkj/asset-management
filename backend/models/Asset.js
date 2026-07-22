const mongoose = require('mongoose');

const assetSchema = new mongoose.Schema({
  assetId: {
    type: String,
    required: true,
    unique: true
  },
  assetName: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['IT Equipment', 'Furniture', 'Machinery', 'Vehicles', 'Other']
  },
  status: {
    type: String,
    required: true,
    enum: ['Active', 'Inactive', 'Maintenance', 'Damaged'],
    default: 'Active'
  },
  description: String,
  location: {
    type: String,
    default: ''
  },
  latitude: Number,
  longitude: Number,
  manufacturer: String,
  serialNumber: String,
  purchaseDate: Date,
  purchasePrice: Number,
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  updatedBy: String,
  qrCode: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Asset', assetSchema);
