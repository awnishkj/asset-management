const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Database Connection
mongoose.set('strictQuery', false);

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/assettrack', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
})
  .then(() => console.log('MongoDB connected'))
  .catch(err => {
    console.error('MongoDB connection error:', err.message || err);
    process.exit(1);
  });

// Database availability middleware
app.use((req, res, next) => {
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      message: 'MongoDB is unavailable. Please ensure the database is running and try again.'
    });
  }
  next();
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/assets', require('./routes/assets'));
app.use('/api/qr', require('./routes/qr'));
app.use('/api/users', require('./routes/users'));
app.use('/api/scan-history', require('./routes/scanHistory'));

// QR scan redirect — phone scans QR → hits this → redirects to frontend asset page
// FRONTEND_URL is updated in .env each session, backend reads it live
app.get('/asset/:assetId', (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL;
  const assetId = req.params.assetId;
  if (!frontendUrl) {
    return res.status(503).send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:40px;background:#0f172a;color:#fff">
        <h2>⚠️ Frontend URL not configured</h2>
        <p style="color:#94a3b8">Set FRONTEND_URL in backend/.env and restart</p>
        <p style="color:#64748b;font-size:13px">Asset ID: ${assetId}</p>
      </body></html>
    `);
  }
  res.redirect(302, `${frontendUrl}/asset/${encodeURIComponent(assetId)}`);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: err.message || 'Something went wrong!',
    ...(process.env.NODE_ENV !== 'production' ? { stack: err.stack } : {})
  });
});

const PORT = process.env.PORT || 5000;
const HTTPS_PORT = process.env.HTTPS_PORT || 5443;

// Try to start HTTPS server (needed for GPS on mobile)
const certPath = path.join(__dirname, 'cert.pem');
const keyPath = path.join(__dirname, 'key.pem');

if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
  const httpsOptions = {
    cert: fs.readFileSync(certPath),
    key: fs.readFileSync(keyPath),
  };
  https.createServer(httpsOptions, app).listen(HTTPS_PORT, '0.0.0.0', () => {
    console.log(`HTTPS Server running on port ${HTTPS_PORT}`);
  });
}

// Also keep HTTP server for desktop
http.createServer(app).listen(PORT, '0.0.0.0', () => {
  console.log(`HTTP Server running on port ${PORT}`);
});
