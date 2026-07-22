const mongoose = require('mongoose');

const scanHistorySchema = new mongoose.Schema({
  assetId: { type: String, required: true },
  assetName: String,
  location: String,        // human-readable address
  latitude: Number,
  longitude: Number,
  status: {
    type: String,
    enum: ['Active', 'Inactive', 'Maintenance', 'Damaged']
  },
  remarks: String,
  scannedBy: String,
  scannedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ScanHistory', scanHistorySchema);
