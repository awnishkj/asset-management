import React, { useState, useCallback } from 'react';
import axios from 'axios';
import { FiSearch, FiRefreshCw } from 'react-icons/fi';
import '../styles/ScanHistory.css';
import usePolling from '../utils/usePolling';
import Layout from './Layout';

export default function ScanHistory() {
  const [history, setHistory] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const fetchScanHistory = useCallback(async () => {
    try {
      const response = await axios.get('/scan-history');
      setHistory(response.data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching scan history:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  usePolling(fetchScanHistory, 10000); // refresh every 10s — scans happen frequently

  const filteredHistory = history.filter(record =>
    record.assetId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.assetName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    record.location?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredHistory.length / ITEMS_PER_PAGE);
  const paginatedHistory = filteredHistory.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reset to page 1 when search changes
  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  return (
    <Layout>
        <div className="scan-history-content">
          <div className="section-header">
            <div>
              <h2>Scan History</h2>
              {lastUpdated && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8', fontSize: 12, marginTop: 2 }}>
                  <FiRefreshCw size={12} /> Updated {lastUpdated.toLocaleTimeString()}
                </div>
              )}
            </div>
            <div className="search-box">
              <FiSearch />
              <input
                type="text"
                placeholder="Search by Asset ID, Name, or Location..."
                value={searchTerm}
                onChange={handleSearch}
              />
            </div>
          </div>

          {loading ? (
            <div className="loading">Loading scan history...</div>
          ) : (
            <div className="history-table">
              <table>
                <thead>
                  <tr>
                    <th>Date & Time</th>
                    <th>Asset ID</th>
                    <th>Asset Name</th>
                    <th>Location</th>
                    <th>Status</th>
                    <th>Scanned By</th>
                    <th>Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedHistory.length > 0 ? (
                    paginatedHistory.map((record, index) => (
                      <tr key={record._id || index}>
                        <td>{new Date(record.scannedAt).toLocaleString()}</td>
                        <td>{record.assetId}</td>
                        <td>{record.assetName}</td>
                        <td>{record.location || 'N/A'}</td>
                        <td>
                          <span className={`status ${record.status?.toLowerCase() || 'active'}`}>
                            {record.status || 'Active'}
                          </span>
                        </td>
                        <td>{record.scannedBy || 'Unknown'}</td>
                        <td style={{ color: '#666', fontStyle: record.remarks ? 'normal' : 'italic' }}>
                          {record.remarks || '—'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan="7" className="no-data">No scan history found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, padding: '0 4px' }}>
              <p style={{ color: '#94a3b8', fontSize: 13, margin: 0 }}>
                Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredHistory.length)} of {filteredHistory.length} records
              </p>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  style={pgBtn(currentPage === 1)}
                >← Prev</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    style={pgBtn(false, page === currentPage)}
                  >{page}</button>
                ))}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  style={pgBtn(currentPage === totalPages)}
                >Next →</button>
              </div>
            </div>
          )}
        </div>
    </Layout>
  );
}

const pgBtn = (disabled, active = false) => ({
  padding: '6px 12px',
  borderRadius: 6,
  border: '1px solid #e2e8f0',
  background: active ? '#3b82f6' : disabled ? '#f8fafc' : '#fff',
  color: active ? '#fff' : disabled ? '#94a3b8' : '#374151',
  cursor: disabled ? 'not-allowed' : 'pointer',
  fontSize: 13,
  fontWeight: active ? 600 : 400,
});
