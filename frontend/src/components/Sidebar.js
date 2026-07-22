import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FiLayout, FiDatabase, FiCode, FiClock, FiUsers, FiSettings, FiLogOut, FiUser, FiChevronUp } from 'react-icons/fi';
import '../styles/Sidebar.css';

export default function Sidebar() {
  const location = useLocation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  const raw = localStorage.getItem('user');
  const user = raw ? JSON.parse(raw) : null;
  const displayName = user?.username || user?.email?.split('@')[0] || 'User';
  const avatarSrc = user?.profilePic || null;
  const initials = displayName.slice(0, 2).toUpperCase();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const menuItems = [
    { name: 'Dashboard', path: '/dashboard', icon: FiLayout },
    { name: 'Assets', path: '/assets', icon: FiDatabase },
    { name: 'QR Generator', path: '/qr-generator', icon: FiCode },
    { name: 'QR Scanner', path: '/qr-scanner', icon: FiCode },
    { name: 'Scan History', path: '/scan-history', icon: FiClock },
    { name: 'Users', path: '/users', icon: FiUsers },
    { name: 'Settings', path: '/settings', icon: FiSettings },
  ];

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <img src="/logo.png" alt="AssetTrack Logo" style={{ width: 64, height: 64, objectFit: 'contain', borderRadius: '50%' }} />
        <h2>ASSETTRACK</h2>
      </div>

      <nav className="sidebar-nav">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-profile-wrap" ref={dropdownRef}>          {/* Dropdown menu — appears above */}
          {dropdownOpen && (
            <div className="sidebar-profile-dropdown">
              <Link to="/profile" className="dropdown-item" onClick={() => setDropdownOpen(false)}>
                <FiUser /> Profile
              </Link>
              <button className="dropdown-item dropdown-logout" onClick={handleLogout}>
                <FiLogOut /> Logout
              </button>
            </div>
          )}

          {/* Profile card — click to toggle dropdown */}
          <button
            className={`sidebar-profile ${dropdownOpen ? 'open' : ''}`}
            onClick={() => setDropdownOpen(prev => !prev)}
          >
            <div className="sidebar-profile-avatar">
              {avatarSrc
                ? <img src={avatarSrc} alt="Profile" />
                : <span>{initials}</span>
              }
            </div>
            <span className="sidebar-profile-name">{displayName}</span>
            <FiChevronUp className={`profile-chevron ${dropdownOpen ? 'rotated' : ''}`} />
          </button>
        </div>
      </div>
    </aside>
  );
}
