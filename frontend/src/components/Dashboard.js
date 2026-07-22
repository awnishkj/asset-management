import React, { useState, useEffect, useCallback } from 'react';
import { FiPlus, FiSearch, FiFilter, FiRefreshCw } from 'react-icons/fi';
import axios from 'axios';
import '../styles/Dashboard.css';
import Layout from './Layout';
import usePolling from '../utils/usePolling';

export default function Dashboard() {
  const [assets, setAssets] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [assetsRes, statsRes] = await Promise.all([
        axios.get('/assets'),
        axios.get('/assets/stats/overview')
      ]);
      setAssets(assetsRes.data);
      setStats(statsRes.data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  usePolling(fetchData, 15000); // refresh every 15s

  const filteredAssets = assets.filter(a =>
    a.assetId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.assetName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Layout>
        <div className="dashboard-content">

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div className="page-heading" style={{ margin: 0 }}>
              <h2 style={{ margin: 0 }}>Dashboard</h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#94a3b8', fontSize: 12 }}>
              <FiRefreshCw size={13} />
              {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : 'Loading...'}
            </div>
          </div>

          <div className="dashboard-top">
            {/* Left: stat cards */}
            <div className="stats-left">
              {/* Row 1: Total Assets full width */}
              <div className="stat-card total stat-full">
                <h3>Total Assets</h3>
                <p className="stat-value">{loading ? '…' : stats.totalAssets ?? 0}</p>
              </div>
              {/* Row 2: Active | Damaged */}
              <div className="stats-row">
                <div className="stat-card active">
                  <h3>Active Assets</h3>
                  <p className="stat-value">{loading ? '…' : stats.activeAssets ?? 0}</p>
                </div>
                <div className="stat-card damaged">
                  <h3>Damaged</h3>
                  <p className="stat-value">{loading ? '…' : stats.damaged ?? 0}</p>
                </div>
              </div>
              {/* Row 3: Inactive | Maintenance */}
              <div className="stats-row">
                <div className="stat-card other">
                  <h3>Inactive</h3>
                  <p className="stat-value">{loading ? '…' : stats.inactive ?? 0}</p>
                </div>
                <div className="stat-card maintenance">
                  <h3>Maintenance</h3>
                  <p className="stat-value">{loading ? '…' : stats.maintenance ?? 0}</p>
                </div>
              </div>
            </div>

            {/* Right: Asset Status Overview */}
            <div className="chart-container status-overview">
              <h3>Asset Status Overview</h3>
              <div className="pie-chart">
                <div className="chart-legend">
                  <div className="legend-item"><span className="active"></span>Active: {stats.activeAssets ?? 0}</div>
                  <div className="legend-item"><span className="inactive"></span>Inactive: {stats.inactive ?? 0}</div>
                  <div className="legend-item"><span className="maintenance"></span>Maintenance: {stats.maintenance ?? 0}</div>
                  <div className="legend-item"><span style={{ background: '#f44336' }}></span>Damaged: {stats.damaged ?? 0}</div>
                </div>
                {stats.totalAssets > 0 && (
                  <div style={{ marginTop: 16, width: '100%' }}>
                    {[
                      { label: 'Active',      value: stats.activeAssets, color: '#4caf50' },
                      { label: 'Inactive',    value: stats.inactive,     color: '#2196f3' },
                      { label: 'Maintenance', value: stats.maintenance,  color: '#ff9800' },
                      { label: 'Damaged',     value: stats.damaged,      color: '#f44336' },
                    ].map(({ label, value, color }) =>
                      value > 0 ? (
                        <div key={label} style={{ marginBottom: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                            <span>{label}</span><span>{Math.round((value / stats.totalAssets) * 100)}%</span>
                          </div>
                          <div style={{ background: '#f0f0f0', borderRadius: 4, height: 8 }}>
                            <div style={{ background: color, width: `${(value / stats.totalAssets) * 100}%`, height: 8, borderRadius: 4, transition: 'width 0.5s' }} />
                          </div>
                        </div>
                      ) : null
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>


          <div className="assets-table-section">
            <h3>Recent Assets</h3>
            <div className="table-controls">
              <div className="search-box">
                <FiSearch />
                <input
                  type="text"
                  placeholder="Search assets..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="assets-table">
              <table>
                <thead>
                  <tr>
                    <th>Asset ID</th>
                    <th>Asset Name</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Last Location</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="5" style={{ textAlign: 'center', padding: 30, color: '#aaa' }}>Loading...</td></tr>
                  ) : filteredAssets.length > 0 ? (
                    filteredAssets.slice(0, 10).map((asset) => (
                      <tr key={asset._id}>
                        <td>{asset.assetId}</td>
                        <td>{asset.assetName}</td>
                        <td>{asset.category}</td>
                        <td><span className={`status ${asset.status?.toLowerCase() || ''}`}>{asset.status || 'N/A'}</span></td>
                        <td>{asset.location || 'N/A'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan="5" style={{ textAlign: 'center', padding: 30, color: '#666' }}>No assets found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
    </Layout>
  );
}
