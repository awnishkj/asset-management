import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Signup from './components/Signup';
import Dashboard from './components/Dashboard';
import Assets from './components/Assets';
import QRGenerator from './components/QRGenerator';
import QRScanner from './components/QRScanner';
import ScanHistory from './components/ScanHistory';
import Users from './components/Users';
import Settings from './components/Settings';
import Profile from './components/Profile';
import AssetPublicView from './components/AssetPublicView';
import AssetPublicList from './components/AssetPublicList';
import ForgotPassword from './components/ForgotPassword';
import './App.css';

const getToken = () => localStorage.getItem('token');

const PrivateRoute = ({ children }) => {
  return getToken() ? children : <Navigate to="/login" replace />;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/assets" element={<PrivateRoute><Assets /></PrivateRoute>} />
        <Route path="/qr-generator" element={<PrivateRoute><QRGenerator /></PrivateRoute>} />
        <Route path="/qr-scanner" element={<PrivateRoute><QRScanner /></PrivateRoute>} />
        <Route path="/scan-history" element={<PrivateRoute><ScanHistory /></PrivateRoute>} />
        <Route path="/users" element={<PrivateRoute><Users /></PrivateRoute>} />
        <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
        <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
        <Route path="/asset/:assetId" element={<AssetPublicView />} />
        <Route path="/assets-public" element={<AssetPublicList />} />
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
