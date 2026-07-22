import React, { useState, useEffect, useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { FiDownload, FiRotateCcw, FiSearch, FiChevronDown } from 'react-icons/fi';
import axios from 'axios';
import '../styles/QRGenerator.css';
import Layout from './Layout';

export default function QRGenerator() {
  const [assets, setAssets] = useState([]);
  const [loadingAssets, setLoadingAssets] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [generating, setGenerating] = useState(false);
  const dropdownRef = useRef(null);

  // Fetch assets from backend
  useEffect(() => {
    const fetchAssets = async () => {
      try {
        const res = await axios.get('/assets');
        setAssets(res.data || []);
      } catch (err) {
        console.error('Failed to load assets:', err);
      } finally {
        setLoadingAssets(false);
      }
    };
    fetchAssets();
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredAssets = assets.filter(a =>
    a.assetId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.assetName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectAsset = (asset) => {
    setSelectedAsset(asset);
    setDropdownOpen(false);
    setSearchTerm('');
    setShowQR(false);
  };

  const handleGenerate = async () => {
    if (!selectedAsset) {
      alert('Please select an asset first');
      return;
    }
    setGenerating(true);
    try {
      await axios.post('/qr/generate', {
        assetId: selectedAsset.assetId,
        assetName: selectedAsset.assetName,
      });
      setShowQR(true);
    } catch (error) {
      console.error('Error generating QR code:', error);
      alert('Failed to generate QR code');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = () => {
    const canvas = document.getElementById('qr-code');
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `${selectedAsset.assetId}-qr.png`;
    link.click();
  };

  const handleReset = () => {
    setSelectedAsset(null);
    setShowQR(false);
    setSearchTerm('');
  };

  return (
    <Layout>

        <div className="qr-generator-content">
          <div className="qr-form-section">
            <h2>QR Code Generator</h2>

            <form className="qr-form" onSubmit={e => e.preventDefault()}>

              {/* Asset selector dropdown */}
              <div className="form-group">
                <label>Select Asset *</label>
                {loadingAssets ? (
                  <p style={{ color: '#aaa', fontSize: 13 }}>Loading assets...</p>
                ) : assets.length === 0 ? (
                  <p style={{ color: '#e53935', fontSize: 13 }}>
                    No assets found. Please add assets in the <a href="/assets">Assets</a> page first.
                  </p>
                ) : (
                  <div className="asset-dropdown" ref={dropdownRef}>
                    <button
                      type="button"
                      className="asset-dropdown-btn"
                      onClick={() => setDropdownOpen(prev => !prev)}
                    >
                      {selectedAsset ? (
                        <span>
                          <strong>{selectedAsset.assetId}</strong> — {selectedAsset.assetName}
                          <span className={`status-dot ${selectedAsset.status?.toLowerCase()}`} />
                        </span>
                      ) : (
                        <span style={{ color: '#aaa' }}>Search and select an asset...</span>
                      )}
                      <FiChevronDown style={{ marginLeft: 'auto', flexShrink: 0 }} />
                    </button>

                    {dropdownOpen && (
                      <div className="asset-dropdown-panel">
                        <div className="asset-dropdown-search">
                          <FiSearch size={14} />
                          <input
                            autoFocus
                            type="text"
                            placeholder="Search by ID, name or category..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                          />
                        </div>
                        <ul className="asset-dropdown-list">
                          {filteredAssets.length === 0 ? (
                            <li className="asset-dropdown-empty">No assets match</li>
                          ) : (
                            filteredAssets.map(asset => (
                              <li
                                key={asset._id}
                                className={`asset-dropdown-item ${selectedAsset?._id === asset._id ? 'selected' : ''}`}
                                onClick={() => handleSelectAsset(asset)}
                              >
                                <div className="asset-item-main">
                                  <span className="asset-item-id">{asset.assetId}</span>
                                  <span className="asset-item-name">{asset.assetName}</span>
                                </div>
                                <div className="asset-item-meta">
                                  <span className="asset-item-cat">{asset.category}</span>
                                  <span className={`status ${asset.status?.toLowerCase()}`} style={{ fontSize: 11, padding: '2px 8px' }}>
                                    {asset.status}
                                  </span>
                                </div>
                              </li>
                            ))
                          )}
                        </ul>
                        <div className="asset-dropdown-footer">
                          {filteredAssets.length} of {assets.length} assets
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Read-only fields populated from selected asset */}
              {selectedAsset && (
                <>
                  <div className="form-group">
                    <label>Asset ID</label>
                    <input type="text" value={selectedAsset.assetId} readOnly className="readonly-input" />
                  </div>
                  <div className="form-group">
                    <label>Asset Name</label>
                    <input type="text" value={selectedAsset.assetName} readOnly className="readonly-input" />
                  </div>
                  <div className="form-group">
                    <label>Category</label>
                    <input type="text" value={selectedAsset.category || '—'} readOnly className="readonly-input" />
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <input type="text" value={selectedAsset.status || '—'} readOnly className="readonly-input" />
                  </div>
                  {selectedAsset.location && (
                    <div className="form-group">
                      <label>Location</label>
                      <input type="text" value={selectedAsset.location} readOnly className="readonly-input" />
                    </div>
                  )}
                </>
              )}

              <div className="form-actions">
                <button
                  type="button"
                  onClick={handleGenerate}
                  className="generate-btn"
                  disabled={!selectedAsset || generating}
                >
                  {generating ? 'Generating...' : 'Generate QR Code'}
                </button>
                <button type="button" onClick={handleReset} className="reset-btn">
                  <FiRotateCcw /> Reset
                </button>
              </div>
            </form>
          </div>

          {showQR && selectedAsset ? (
            <div className="qr-display-section">
              <h3>Generated QR Code</h3>
              <div className="qr-asset-info">
                <p><strong>{selectedAsset.assetId}</strong> — {selectedAsset.assetName}</p>
                <p style={{ color: '#888', fontSize: 13 }}>{selectedAsset.category} · {selectedAsset.status}</p>
              </div>
              <div className="qr-code-box">
                <QRCodeCanvas
                  id="qr-code"
                  value={`${process.env.REACT_APP_API_URL?.replace('/api', '') || window.location.origin}/asset/${encodeURIComponent(selectedAsset.assetId)}`}
                  size={240}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <button onClick={handleDownload} className="download-btn">
                <FiDownload /> Download QR Code
              </button>
            </div>
          ) : (
            <div className="qr-display-section qr-display-placeholder">
              <h3>QR Code Preview</h3>
              <div className="qr-code-box qr-empty-box">
                <div className="qr-empty-icon">
                  <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                    <rect x="4" y="4" width="30" height="30" rx="3" stroke="#ccc" strokeWidth="3" fill="none"/>
                    <rect x="46" y="4" width="30" height="30" rx="3" stroke="#ccc" strokeWidth="3" fill="none"/>
                    <rect x="4" y="46" width="30" height="30" rx="3" stroke="#ccc" strokeWidth="3" fill="none"/>
                    <rect x="11" y="11" width="16" height="16" rx="1" fill="#ddd"/>
                    <rect x="53" y="11" width="16" height="16" rx="1" fill="#ddd"/>
                    <rect x="11" y="53" width="16" height="16" rx="1" fill="#ddd"/>
                    <rect x="46" y="46" width="8" height="8" fill="#ddd"/>
                    <rect x="58" y="46" width="8" height="8" fill="#ddd"/>
                    <rect x="46" y="58" width="8" height="8" fill="#ddd"/>
                    <rect x="58" y="58" width="8" height="8" fill="#ddd"/>
                  </svg>
                </div>
                <p style={{ color: '#bbb', fontSize: 13, marginTop: 12 }}>
                  Select an asset and click<br />"Generate QR Code"
                </p>
              </div>
            </div>
          )}
        </div>
    </Layout>
  );
}
