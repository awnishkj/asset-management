import React from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import '../styles/Dashboard.css';

export default function Layout({ children }) {
  return (
    <div className="dashboard-container">
      <Header />
      <div className="dashboard-body">
        <Sidebar />
        <div className="main-content">
          {children}
          <footer style={F.footer}>
            <div style={F.bottom}>
              <p style={F.devBy}>Developed by <strong style={{ color: '#667eea' }}>Awnish Kumar Jaiswal</strong> · Full Stack Developer</p>
              <p style={F.copy}>awnishkj2004@gmail.com · © {new Date().getFullYear()} AssetTrack. All rights reserved.</p>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}

const F = {
  footer: {
    background: '#0f172a',
    borderTop: '1px solid #1e293b',
    marginTop: 'auto',
    flexShrink: 0,
  },
  bottom: {
    padding: '12px 30px',
    textAlign: 'center',
  },
  devBy: { color: '#64748b', fontSize: 12, margin: '0 0 4px' },
  copy: { color: '#475569', fontSize: 12, margin: 0 },
};
