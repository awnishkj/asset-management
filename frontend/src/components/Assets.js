import React, { useState, useCallback } from 'react';
import { FiEdit2, FiTrash2, FiPlus, FiSearch, FiRefreshCw, FiEye, FiDownload } from 'react-icons/fi';
import { QRCodeCanvas } from 'qrcode.react';
import axios from 'axios';
import '../styles/Assets.css';
import AssetModal from './AssetModal';
import Layout from './Layout';
import usePolling from '../utils/usePolling';

export default function Assets() {
  const [assets, setAssets] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [viewAsset, setViewAsset] = useState(null);
  const [qrAsset, setQrAsset] = useState(null); // show QR after new asset added

  const fetchAssets = useCallback(async () => {
    try {
      const response = await axios.get('/assets');
      setAssets(response.data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching assets:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  usePolling(fetchAssets, 15000);

  const filteredAssets = assets.filter(asset =>
    asset.assetId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    asset.assetName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDeleteAsset = async (id) => {
    if (window.confirm('Are you sure you want to delete this asset?')) {
      try {
        await axios.delete(`/assets/${id}`);
        setAssets(prev => prev.filter(a => a._id !== id));
      } catch (error) {
        console.error('Error deleting asset:', error);
      }
    }
  };

  const handleSaveAsset = async (assetData) => {
    try {
      if (selectedAsset) {
        const res = await axios.put(`/assets/${selectedAsset._id}`, assetData);
        setAssets(prev => prev.map(a => a._id === selectedAsset._id ? res.data : a));
      } else {
        const res = await axios.post('/assets', assetData);
        setAssets(prev => [res.data, ...prev]);
        // Show QR modal for newly created asset
        setQrAsset(res.data);
      }
      setShowModal(false);
      setSelectedAsset(null);
    } catch (error) {
      console.error('Error saving asset:', error);
    }
  };

  return (
    <Layout>
        <div className="assets-content">
          <div className="assets-header">
            <h2>Asset Management</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#94a3b8', fontSize: 12 }}>
              <FiRefreshCw size={13} />
              {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : ''}
            </div>
            <div className="assets-controls">
              <div className="search-box">
                <FiSearch />
                <input
                  type="text"
                  placeholder="Search assets..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <button className="add-btn" onClick={() => { setSelectedAsset(null); setShowModal(true); }}>
                <FiPlus /> Add New Asset
              </button>
            </div>
          </div>

          {loading ? (
            <div className="loading">Loading assets...</div>
          ) : (
            <div className="assets-table">
              <table>
                <thead>
                  <tr>
                    <th>Asset ID</th>
                    <th>Asset Name</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Location</th>
                    <th>Last Updated</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAssets.length > 0 ? (
                    filteredAssets.map((asset) => (
                      <tr key={asset._id}>
                        <td>{asset.assetId}</td>
                        <td>{asset.assetName}</td>
                        <td>{asset.category}</td>
                        <td><span className={`status ${asset.status?.toLowerCase()}`}>{asset.status}</span></td>
                        <td>{asset.location || 'N/A'}</td>
                        <td>{asset.lastUpdated ? new Date(asset.lastUpdated).toLocaleDateString() : 'N/A'}</td>
                        <td>
                          <button className="edit-btn" title="View Details" onClick={() => setViewAsset(asset)}>
                            <FiEye />
                          </button>
                          <button className="edit-btn" onClick={() => { setSelectedAsset(asset); setShowModal(true); }}>
                            <FiEdit2 />
                          </button>
                          <button className="delete-btn" onClick={() => handleDeleteAsset(asset._id)}>
                            <FiTrash2 />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan="7" className="no-data">No assets found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {showModal && (
            <AssetModal
              asset={selectedAsset}
              onSave={handleSaveAsset}
              onClose={() => { setShowModal(false); setSelectedAsset(null); }}
            />
          )}

          {/* ── VIEW DETAILS MODAL ── */}
          {viewAsset && (
            <div style={V.overlay} onClick={() => setViewAsset(null)}>
              <div style={V.modal} onClick={e => e.stopPropagation()}>
                <div style={V.header}>
                  <div>
                    <p style={{ color: '#64748b', fontSize: 12, margin: 0 }}>{viewAsset.assetId}</p>
                    <h2 style={{ margin: '4px 0 0', fontSize: 20 }}>{viewAsset.assetName}</h2>
                  </div>
                  <button style={V.closeBtn} onClick={() => setViewAsset(null)}>✕</button>
                </div>
                <div style={V.grid}>
                  {[
                    { label: 'Category',      value: viewAsset.category },
                    { label: 'Status',        value: viewAsset.status },
                    { label: 'Location',      value: viewAsset.location || '—' },
                    { label: 'Description',   value: viewAsset.description || '—' },
                    { label: 'Manufacturer',  value: viewAsset.manufacturer || '—' },
                    { label: 'Serial Number', value: viewAsset.serialNumber || '—' },
                    { label: 'Purchase Date', value: viewAsset.purchaseDate ? new Date(viewAsset.purchaseDate).toLocaleDateString() : '—' },
                    { label: 'Purchase Price',value: viewAsset.purchasePrice ? `₹${viewAsset.purchasePrice}` : '—' },
                    { label: 'Last Updated',  value: viewAsset.lastUpdated ? new Date(viewAsset.lastUpdated).toLocaleString() : '—' },
                    { label: 'Updated By',    value: viewAsset.updatedBy || '—' },
                    { label: 'Coordinates',   value: viewAsset.latitude && viewAsset.longitude ? `${Number(viewAsset.latitude).toFixed(4)}, ${Number(viewAsset.longitude).toFixed(4)}` : '—' },
                  ].map(({ label, value }) => (
                    <div key={label} style={V.row}>
                      <span style={V.label}>{label}</span>
                      <span style={V.value}>{value}</span>
                    </div>
                  ))}
                </div>
                <button style={V.editBtn} onClick={() => { setSelectedAsset(viewAsset); setShowModal(true); setViewAsset(null); }}>
                  Edit Asset
                </button>
              </div>
            </div>
          )}
          {/* ── QR CODE MODAL (auto-shown after new asset) ── */}
          {qrAsset && (
            <div style={V.overlay} onClick={() => setQrAsset(null)}>
              <div style={{ ...V.modal, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ margin: 0, fontSize: 18 }}>QR Code Generated!</h3>
                  <button style={V.closeBtn} onClick={() => setQrAsset(null)}>✕</button>
                </div>
                <p style={{ color: '#64748b', fontSize: 13, marginBottom: 4 }}>{qrAsset.assetId} — {qrAsset.assetName}</p>
                <p style={{ color: '#94a3b8', fontSize: 12, marginBottom: 16 }}>Scan this QR to open the asset update page</p>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                  <QRCodeCanvas
                    id={`qr-new-${qrAsset.assetId}`}
                    value={`${process.env.REACT_APP_FRONTEND_URL || `http://${window.location.hostname}:3000`}/asset/${qrAsset.assetId}`}
                    size={200}
                    level="H"
                    includeMargin={true}
                  />
                </div>
                <button
                  style={{ ...V.editBtn, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}
                  onClick={() => {
                    const canvas = document.getElementById(`qr-new-${qrAsset.assetId}`);
                    const link = document.createElement('a');
                    link.href = canvas.toDataURL('image/png');
                    link.download = `${qrAsset.assetId}-qr.png`;
                    link.click();
                  }}
                >
                  <FiDownload /> Download QR Code
                </button>
                <button
                  onClick={() => setQrAsset(null)}
                  style={{ marginTop: 10, width: '100%', padding: '10px', background: 'none', border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer', color: '#64748b', fontSize: 14 }}
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
    </Layout>
  );
}

const V = {
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.5)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  modal: {
    background: '#fff', borderRadius: 14, padding: '24px',
    width: '100%', maxWidth: 520, maxHeight: '85vh',
    overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid #f1f5f9',
  },
  closeBtn: {
    background: 'none', border: 'none', fontSize: 18,
    cursor: 'pointer', color: '#94a3b8', padding: '0 4px',
  },
  grid: { display: 'flex', flexDirection: 'column', gap: 0 },
  row: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 0', borderBottom: '1px solid #f8fafc',
  },
  label: { color: '#64748b', fontSize: 13 },
  value: { color: '#0f172a', fontSize: 13, fontWeight: 500, textAlign: 'right', maxWidth: '60%' },
  editBtn: {
    marginTop: 20, width: '100%', padding: '12px',
    background: '#667eea', color: '#fff', border: 'none',
    borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
};

