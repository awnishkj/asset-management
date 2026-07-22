import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || `http://${window.location.hostname}:5000/api`;

const STATUS_STYLE = {
  Active:      { bg: '#1a472a', color: '#4ade80', border: '#22c55e' },
  Inactive:    { bg: '#1e3a5f', color: '#60a5fa', border: '#3b82f6' },
  Maintenance: { bg: '#4a2c00', color: '#fbbf24', border: '#f59e0b' },
  Damaged:     { bg: '#4a1515', color: '#f87171', border: '#ef4444' },
};

const CATEGORY_ICON = {
  'IT Equipment': '💻',
  'Vehicles': '🚗',
  'Furniture': '🪑',
  'Machinery': '⚙️',
};

export default function AssetPublicList() {
  const navigate = useNavigate();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchAssets = async () => {
      try {
        const res = await axios.get(`${API_URL}/assets/public-list`);
        setAssets(res.data || []);
      } catch (err) {
        setError('Failed to load assets');
      } finally {
        setLoading(false);
      }
    };
    fetchAssets();
  }, []);

  const filtered = assets.filter(a =>
    a.assetId?.toLowerCase().includes(search.toLowerCase()) ||
    a.assetName?.toLowerCase().includes(search.toLowerCase()) ||
    a.category?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <img src="/logo.png" alt="logo" style={{ width: 36, height: 36, objectFit: 'contain' }} />
        <h1 style={S.headerTitle}>ASSETTRACK</h1>
      </div>

      {/* Search */}
      <div style={S.searchWrap}>
        <input
          style={S.search}
          placeholder="🔍  Search assets..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div style={{ padding: '0 16px 8px', color: '#64748b', fontSize: 13 }}>
        {loading ? 'Loading...' : `${filtered.length} asset${filtered.length !== 1 ? 's' : ''}`}
      </div>

      {/* Asset List */}
      <div style={S.list}>
        {loading ? (
          <div style={S.center}>
            <div style={S.spinner} />
            <p style={{ color: '#94a3b8', marginTop: 12 }}>Loading assets...</p>
          </div>
        ) : error ? (
          <div style={S.center}><p style={{ color: '#f87171' }}>{error}</p></div>
        ) : filtered.length === 0 ? (
          <div style={S.center}><p style={{ color: '#94a3b8' }}>No assets found</p></div>
        ) : (
          filtered.map(asset => {
            const ss = STATUS_STYLE[asset.status] || STATUS_STYLE.Active;
            return (
              <button
                key={asset._id}
                style={S.card}
                onClick={() => navigate(`/asset/${encodeURIComponent(asset.assetId)}`)}
              >
                <div style={S.cardIcon}>
                  <span style={{ fontSize: 22 }}>{CATEGORY_ICON[asset.category] || '📦'}</span>
                </div>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <p style={{ color: '#94a3b8', fontSize: 11, margin: '0 0 2px' }}>{asset.assetId}</p>
                  <p style={{ color: '#f1f5f9', fontSize: 15, fontWeight: 600, margin: '0 0 6px' }}>{asset.assetName}</p>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ ...S.badge, background: ss.bg, color: ss.color, borderColor: ss.border }}>
                      {asset.status}
                    </span>
                    <span style={{ color: '#475569', fontSize: 12 }}>{asset.category}</span>
                    {asset.location && <span style={{ color: '#475569', fontSize: 12 }}>📍 {asset.location}</span>}
                  </div>
                </div>
                <span style={{ color: '#475569', fontSize: 20 }}>›</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

const S = {
  page: { minHeight: '100vh', background: '#0f172a', fontFamily: "'Segoe UI', sans-serif" },
  header: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '16px 20px', borderBottom: '1px solid #1e293b',
  },
  headerTitle: { color: '#f1f5f9', fontSize: 18, fontWeight: 700, margin: 0 },
  searchWrap: { padding: '14px 16px 8px' },
  search: {
    width: '100%', padding: '12px 14px', borderRadius: 10,
    background: '#1e293b', border: '1px solid #334155',
    color: '#f1f5f9', fontSize: 15, outline: 'none',
    boxSizing: 'border-box',
  },
  list: { display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 16px 40px' },
  card: {
    display: 'flex', alignItems: 'center', gap: 14,
    background: '#1e293b', border: '1px solid #334155',
    borderRadius: 14, padding: '14px 16px',
    cursor: 'pointer', width: '100%', textAlign: 'left',
  },
  cardIcon: {
    width: 48, height: 48, borderRadius: 12, background: '#0f172a',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  badge: {
    display: 'inline-block', padding: '2px 10px',
    borderRadius: 20, fontSize: 11, fontWeight: 600, border: '1px solid',
  },
  center: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: '60px 20px',
  },
  spinner: {
    width: 32, height: 32, border: '3px solid #334155',
    borderTop: '3px solid #667eea', borderRadius: '50%',
  },
};
