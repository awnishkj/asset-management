import React, { useState } from 'react';
import { FiX } from 'react-icons/fi';
import '../styles/AssetModal.css';

export default function AssetModal({ asset, onSave, onClose }) {
  const [formData, setFormData] = useState(asset || {
    assetId: '',
    assetName: '',
    category: 'IT Equipment',
    status: 'Active',
    description: '',
    location: '',
    manufacturer: '',
    serialNumber: '',
    purchaseDate: '',
    purchasePrice: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{asset ? 'Edit Asset' : 'Add New Asset'}</h3>
          <button className="close-btn" onClick={onClose}>
            <FiX />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="asset-form">
          <div className="form-row">
            <div className="form-group">
              <label>Asset ID *</label>
              <input
                type="text"
                name="assetId"
                value={formData.assetId}
                onChange={handleChange}
                placeholder="e.g., AT-001"
                required
              />
            </div>
            <div className="form-group">
              <label>Asset Name *</label>
              <input
                type="text"
                name="assetName"
                value={formData.assetName}
                onChange={handleChange}
                placeholder="e.g., Dell Laptop"
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Category</label>
              <select name="category" value={formData.category} onChange={handleChange}>
                <option value="IT Equipment">IT Equipment</option>
                <option value="Furniture">Furniture</option>
                <option value="Machinery">Machinery</option>
                <option value="Vehicles">Vehicles</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label>Status</label>
              <select name="status" value={formData.status} onChange={handleChange}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Maintenance">Maintenance</option>
                <option value="Damaged">Damaged</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Location</label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="Enter location"
              />
            </div>
            <div className="form-group">
              <label>Manufacturer</label>
              <input
                type="text"
                name="manufacturer"
                value={formData.manufacturer}
                onChange={handleChange}
                placeholder="Enter manufacturer"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Serial Number</label>
              <input
                type="text"
                name="serialNumber"
                value={formData.serialNumber}
                onChange={handleChange}
                placeholder="Enter serial number"
              />
            </div>
            <div className="form-group">
              <label>Purchase Date</label>
              <input
                type="date"
                name="purchaseDate"
                value={formData.purchaseDate}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Purchase Price</label>
            <input
              type="number"
              name="purchasePrice"
              value={formData.purchasePrice}
              onChange={handleChange}
              placeholder="Enter purchase price"
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Enter asset description"
              rows="4"
            ></textarea>
          </div>

          <div className="modal-actions">
            <button type="button" className="cancel-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="save-btn">
              {asset ? 'Update Asset' : 'Create Asset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
