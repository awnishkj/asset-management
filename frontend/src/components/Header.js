import React, { useState, useRef, useEffect } from 'react';
import { FiLogOut, FiBell, FiSettings, FiUser, FiCheck, FiTrash2 } from 'react-icons/fi';
import '../styles/Header.css';

const INITIAL_NOTIFICATIONS = [];

export default function Header() {
  const [showMenu, setShowMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const notifRef = useRef(null);
  const menuRef = useRef(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClick = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  const markAsRead = (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const deleteNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  return (
    <header className="header">
      <div className="header-content">
        <h2>Welcome Back, {user.username || 'User'}</h2>
        <div className="header-actions">

          {/* Notification Bell */}
          <div className="notif-wrapper" ref={notifRef}>
            <button
              className="notification-btn"
              onClick={() => { setShowNotifications(prev => !prev); setShowMenu(false); }}
            >
              <FiBell />
              {unreadCount > 0 && (
                <span className="notification-badge">{unreadCount}</span>
              )}
            </button>

            {showNotifications && (
              <div className="notif-dropdown">
                <div className="notif-header">
                  <span className="notif-title">Notifications</span>
                  <div className="notif-actions">
                    {unreadCount > 0 && (
                      <button className="notif-action-btn" onClick={markAllRead} title="Mark all as read">
                        <FiCheck size={14} /> Mark all read
                      </button>
                    )}
                    {notifications.length > 0 && (
                      <button className="notif-action-btn danger" onClick={clearAll} title="Clear all">
                        <FiTrash2 size={14} /> Clear all
                      </button>
                    )}
                  </div>
                </div>

                <div className="notif-list">
                  {notifications.length === 0 ? (
                    <div className="notif-empty">
                      <FiBell size={28} />
                      <p>No notifications</p>
                    </div>
                  ) : (
                    notifications.map(n => (
                      <div
                        key={n.id}
                        className={`notif-item ${!n.read ? 'unread' : ''}`}
                        onClick={() => markAsRead(n.id)}
                      >
                        <div className="notif-dot-col">
                          {!n.read && <span className="notif-dot" />}
                        </div>
                        <div className="notif-body">
                          <p className="notif-item-title">{n.title}</p>
                          <p className="notif-item-msg">{n.message}</p>
                          <span className="notif-time">{n.time}</span>
                        </div>
                        <button
                          className="notif-delete-btn"
                          onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                          title="Remove"
                        >
                          ×
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Settings icon */}
          <button className="settings-btn" onClick={() => window.location.href = '/settings'}>
            <FiSettings />
          </button>

          {/* User menu */}
          <div className="user-menu" ref={menuRef}>
            <button
              className="user-btn"
              onClick={() => { setShowMenu(prev => !prev); setShowNotifications(false); }}
            >
              <FiUser />
            </button>
            {showMenu && (
              <div className="dropdown-menu">
                <a href="/profile">Profile</a>
                <a href="/settings">Settings</a>
                <button onClick={handleLogout} className="logout-btn">
                  <FiLogOut /> Logout
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
}
