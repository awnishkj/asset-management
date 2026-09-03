# ASSETTRACK Development Guide

## Quick Start

### Prerequisites
- Node.js (v14 or higher)
- MongoDB (local or Atlas connection)
- npm or yarn

### Installation

1. **Backend Setup**
```bash
cd backend
npm install
```

2. **Frontend Setup**
```bash
cd frontend
npm install
```

### Configuration

#### Backend Configuration
Create `backend/.env`:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/assettrack
JWT_SECRET=your_secret_key_here
NODE_ENV=development
```

#### Frontend Configuration
Create `frontend/.env`:
```env
REACT_APP_API_URL=http://localhost:5000/api
```

### Running the Application

**Terminal 1 - Backend**:
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend**:
```bash
cd frontend
npm start
```

Application will be available at `http://localhost:3000`

## API Documentation

### Authentication Endpoints

#### Register User
```
POST /api/auth/register
Body: { username, email, password }
```

#### Login
```
POST /api/auth/login
Body: { identifier, password, rememberMe }

First login (no Authenticator set up yet):
  Response: { twoFactor: true, setup: true, twoFactorToken, qrCode, manualKey }
  → Scan the QR with Google/Microsoft Authenticator, then call /verify-2fa

Subsequent logins:
  Response: { twoFactor: true, setup: false, twoFactorToken }
  → Call /verify-2fa with current Authenticator code
```

#### Verify Authenticator (2FA)
```
POST /api/auth/verify-2fa
Headers: Authorization: Bearer <twoFactorToken>
Body: { code, twoFactorToken }
Response: { token, user }  — full session JWT
```

#### QR Login (from asset scan page)
```
POST /api/auth/qr-login
Body: { identifier, password, totpCode }
Response: { token, user }
```

#### Forgot Password
```
POST /api/auth/forgot-password
Body: { email }
Response: { resetStepToken }

POST /api/auth/forgot-password/verify-totp
Body: { resetStepToken, totpCode }
Response: { passwordResetToken }

POST /api/auth/reset-password
Body: { passwordResetToken, newPassword }
```

### Asset Endpoints

#### List All Assets
```
GET /api/assets
```

#### Get Asset by ID
```
GET /api/assets/:id
```

#### Create Asset
```
POST /api/assets
Body: {
  assetId: string,
  assetName: string,
  category: string,
  status: string,
  location: string,
  ...
}
```

#### Update Asset (dashboard)
```
PUT /api/assets/:id
Headers: Authorization: Bearer <jwt>
Body: { asset fields to update }
```

#### Verify Authenticator for Asset Update (QR scan flow)
```
POST /api/assets/public/:assetId/verify-update
Headers: Authorization: Bearer <jwt>
Body: { totpCode }
Response: { updateToken }  — 5-minute signed JWT, tied to userId + assetId

Security rules enforced:
  - req.userId comes from the authenticated JWT only (never from req.body)
  - TOTP verified against that user's own twoFactorSecret from MongoDB
  - updateToken contains { purpose: 'asset-update', userId, assetId }
  - updateToken is stored in React component state only — never in localStorage
```

#### Update Asset from QR Scan (protected)
```
POST /api/assets/public/:assetId/update
Headers:
  Authorization: Bearer <jwt>
  X-Update-Token: <updateToken>
Body: { status, location, latitude, longitude, remarks, scannedBy, updatedBy }

Backend checks (all must pass or 403 is returned):
  1. Bearer JWT valid and not expired
  2. X-Update-Token valid and not expired
  3. updateToken.purpose === 'asset-update'
  4. updateToken.userId === req.userId (from Bearer JWT)
  5. updateToken.assetId === URL :assetId
```

#### Delete Asset
```
DELETE /api/assets/:id
```

#### Get Statistics
```
GET /api/assets/stats/overview
```

### QR Code Endpoints

#### Generate QR Code
```
POST /api/qr/generate
Body: {
  assetId: string,
  assetName: string
}
```

#### Decode QR Code
```
POST /api/qr/decode
Body: {
  qrData: string
}
```

### Scan History Endpoints

#### Get All Scans
```
GET /api/scan-history
```

#### Record Scan
```
POST /api/scan-history
Body: {
  assetId: string,
  assetName: string,
  location: string,
  status: string,
  scannedBy: string
}
```

#### Get Asset Scan History
```
GET /api/scan-history/asset/:assetId
```

## Development Workflow

### Adding New Features

1. Create components in `frontend/src/components/`
2. Create routes in `backend/routes/`
3. Add models if needed in `backend/models/`
4. Update API URLs in components
5. Test endpoints with Postman or similar tool

### Database

MongoDB should be running before starting the backend server.

**Local MongoDB**:
```bash
mongod
```

**MongoDB Atlas** (Cloud):
Update `MONGODB_URI` in `.env` with your connection string.

## Debugging

### Backend Debugging
- Check console output for errors
- Use MongoDB Compass to inspect database
- Use Postman to test API endpoints

### Authenticator 2FA (TOTP)

AssetTrack uses **TOTP** (Time-based One-Time Password) via **otplib v13**. No email is sent for login.

**First-time setup:**
1. Log in with username + password.
2. The server generates a TOTP secret, stores it as `twoFactorPendingSecret`, and returns a QR code PNG.
3. Scan the QR in Google Authenticator or Microsoft Authenticator.
4. Enter the 6-digit code → secret is promoted to `twoFactorSecret`, `twoFactorEnabled` set to `true`.
5. All subsequent logins require the Authenticator code.

**DEV bypass (development only):**
Set `SKIP_2FA=true` in `backend/.env` to skip the TOTP step during development. Never use in production.

```env
SKIP_2FA=true   # backend/.env — skips 2FA entirely in NODE_ENV=development
```

**QR scan asset update verification:**
Every asset update from the public QR scan page requires a fresh Authenticator code, even after login. The code is verified against the currently logged-in user's `twoFactorSecret` — the backend reads the user from the JWT, not from anything the frontend sends. A 5-minute `updateToken` is issued and must be passed as `X-Update-Token` on the actual update request.

### Frontend Debugging
- Use browser DevTools (F12)
- Check React Components tab
- Use Network tab to inspect API calls

## Troubleshooting

### Backend won't start
- Check if MongoDB is running
- Verify `.env` file is in `backend/` directory
- Check if port 5000 is available

### Frontend won't start
- Clear `node_modules` and reinstall: `npm install`
- Clear browser cache
- Check if backend API is running

### API calls failing
- Verify CORS is enabled in backend
- Check JWT token is being sent
- Verify `.env` files are correctly configured

## Production Deployment

### Build Frontend
```bash
cd frontend
npm run build
```

### Environment Variables for Production
Update `.env` files with production values:
- Change API URLs to production domain
- Use strong JWT_SECRET
- Set NODE_ENV=production
- Use MongoDB Atlas or production database

## Additional Resources

- [Express.js Documentation](https://expressjs.com/)
- [React Documentation](https://react.dev/)
- [MongoDB Documentation](https://docs.mongodb.com/)
- [JWT Authentication](https://jwt.io/)

---

For more help, refer to README.md or create an issue.
