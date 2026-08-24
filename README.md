<div align="center">

<img src="frontend/public/logo.png" alt="AssetTrack Logo" width="100" />

# AssetTrack

**Smart Asset Tracking & Management System**

[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://mongodb.com)
[![JWT](https://img.shields.io/badge/Auth-JWT-000000?style=for-the-badge&logo=jsonwebtokens&logoColor=white)](https://jwt.io)
[![MongoDB Atlas](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://mongodb.com/atlas)
[![Resend](https://img.shields.io/badge/Email-Resend-000000?style=for-the-badge&logo=mail.ru&logoColor=white)](https://resend.com)

*Track any asset, anywhere, with a QR code scan.*

</div>

---

## ✨ Features

| Feature | Description |
|---|---|
| 🔐 **Auth + 2FA** | JWT login with email-based two-factor authentication |
| 📦 **Asset Management** | Full CRUD — create, update, delete, search assets |
| 📱 **QR Code Generator** | Generate & download printable QR codes per asset |
| 🔍 **QR Scanner** | Scan via camera or upload image — works on any device |
| 🌍 **Public Asset View** | Scan QR on any network → opens asset page instantly |
| 📍 **Location Tracking** | GPS coordinates + manual location on every scan |
| 📊 **Dashboard** | Live stats, status charts, recent activity |
| 🕓 **Scan History** | Full timeline of every scan with location & remarks |
| 👥 **User Roles** | Admin / Manager / User role-based access control |
| 📧 **Email Notifications** | Resend HTTP API for 2FA OTP & password reset (works on Render Free) |

---

## 🏗️ Tech Stack

```
Frontend          Backend           Database        Infra
─────────         ────────          ────────        ─────
React 18          Node.js           MongoDB Atlas   Cloudflare Tunnel
React Router 6    Express.js        Mongoose        Render (backend)
Axios             JWT + bcryptjs    ─────────       nodemon
Chart.js          Resend (email)
Leaflet Maps      QRCode / jsQR
qrcode.react      express-validator
```

---

## 📁 Project Structure

```
asset-management/
├── backend/
│   ├── models/              # Mongoose schemas (Asset, User, ScanHistory)
│   ├── routes/              # API routes (auth, assets, qr, users, scanHistory)
│   ├── middleware/          # JWT auth middleware
│   ├── services/
│   │   └── email.js         # Email abstraction (Resend → SMTP → Ethereal fallback)
│   ├── server.js            # Express entry point + QR redirect route
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/      # All React components
│   │   ├── styles/          # Per-component CSS
│   │   └── utils/           # Error helpers, polling hook
│   ├── public/
│   └── package.json
│
├── START.ps1                # One-click startup script (Windows)
├── .env.example             # Environment variable template
└── cloudflared.exe          # Cloudflare tunnel binary
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js v14+
- MongoDB (local) — start with `mongod --dbpath "C:\data\MongoDB\data\db"`
- Git

### 1 — Clone & Install

```bash
git clone https://github.com/awnishkj/asset-management.git
cd asset-management

# Install backend deps
cd backend && npm install

# Install frontend deps
cd ../frontend && npm install
```

### 2 — Configure Environment

**`backend/.env`**
```env
PORT=5000
HTTPS_PORT=5443
NODE_ENV=development
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/assettrack?retryWrites=true&w=majority
JWT_SECRET=your_secret_here

# Email — Option A: Resend HTTP API (required for Render Free, recommended everywhere)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=AssetTrack <no-reply@yourdomain.com>

# Email — Option B: Gmail SMTP (local dev only — blocked on Render Free)
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_SECURE=false
# SMTP_USER=your@gmail.com
# SMTP_PASS=your_app_password

# Updated automatically by START.ps1 each session
FRONTEND_URL=http://localhost:3000
```

**`frontend/.env`**
```env
REACT_APP_API_URL=http://localhost:5000/api
HOST=0.0.0.0
```

### 3 — Run

**Option A — One-click (Windows, with tunnels):**
```powershell
.\START.ps1
```

**Option B — Manual:**
```bash
# Terminal 1 — MongoDB
mongod --dbpath "C:\data\MongoDB\data\db"

# Terminal 2 — Backend
cd backend && npm run dev

# Terminal 3 — Frontend
cd frontend && npm start
```

Open **http://localhost:3000**

---

## 🌐 Public QR Access (Any Network)

QR codes encode a **backend tunnel URL** that redirects to the frontend:

```
Phone scans QR
    ↓
https://<backend-tunnel>/asset/<ID>   ← encoded in QR
    ↓  302 redirect (reads FRONTEND_URL live)
https://<frontend-tunnel>/asset/<ID>  ← asset page opens
```

Run `START.ps1` — it auto-updates both `.env` files with fresh tunnel URLs every session.

---

## 📧 Email Setup (Resend)

Email is used for **2FA login codes** and **password reset**. The app uses [Resend](https://resend.com) HTTP API — works on Render Free (which blocks SMTP ports 25/465/587).

### Why not Gmail SMTP?
Render Free web services block all outbound SMTP traffic. Resend uses HTTPS so it works everywhere.

### Setup (2 minutes)
1. Sign up at **[resend.com](https://resend.com)** (free — 3,000 emails/month)
2. Go to **API Keys** → Create → copy the key starting with `re_`
3. Set in your environment:

```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=AssetTrack <no-reply@yourdomain.com>
```

> If you don't have a custom domain yet, leave `EMAIL_FROM` blank — it defaults to `onboarding@resend.dev` which only delivers to your own verified Resend email address (fine for testing).

### Email provider selection logic
```
RESEND_API_KEY set?    → Resend HTTP API   ✅ production / Render
SMTP_HOST+USER+PASS?   → Nodemailer SMTP   ✅ local dev / self-hosted
Neither + development  → Ethereal test     ✅ dev fallback (logs preview URL)
Neither + production   → Error thrown      ❌ configure a provider
```

---

## ☁️ Deploying on Render

### Backend (Web Service)
| Setting | Value |
|---|---|
| Build Command | `cd backend && npm install` |
| Start Command | `cd backend && node server.js` |
| Port | auto-detected via `process.env.PORT` |

### Required Render Environment Variables
| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `MONGODB_URI` | Your Atlas connection string |
| `JWT_SECRET` | Strong random string |
| `RESEND_API_KEY` | From [resend.com](https://resend.com) |
| `EMAIL_FROM` | `AssetTrack <no-reply@yourdomain.com>` |
| `FRONTEND_URL` | Your deployed frontend URL |

---

## 📡 API Reference

<details>
<summary><strong>Auth</strong></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login` | Login (triggers 2FA) |
| POST | `/api/auth/verify-2fa` | Verify OTP code |
| POST | `/api/auth/resend-2fa` | Resend OTP |
| POST | `/api/auth/qr-login` | Login from QR scan (no 2FA) |
| POST | `/api/auth/forgot-password` | Send reset code |
| POST | `/api/auth/reset-password` | Reset password |

</details>

<details>
<summary><strong>Assets</strong></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/assets` | List all assets |
| POST | `/api/assets` | Create asset |
| GET | `/api/assets/:id` | Get asset by ID |
| PUT | `/api/assets/:id` | Update asset |
| DELETE | `/api/assets/:id` | Delete asset |
| GET | `/api/assets/stats/overview` | Dashboard stats |
| GET | `/api/assets/public/:assetId` | Public asset lookup (no auth) |
| POST | `/api/assets/public/:assetId/update` | Public update from scan |
| GET | `/api/assets/public/:assetId/history` | Scan history (no auth) |

</details>

<details>
<summary><strong>QR & Scan History</strong></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/qr/generate` | Generate QR code |
| POST | `/api/qr/decode` | Decode QR data |
| GET | `/api/scan-history` | All scan records |
| POST | `/api/scan-history` | Record a scan |
| GET | `/api/scan-history/asset/:assetId` | History per asset |

</details>

<details>
<summary><strong>QR Redirect</strong></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/asset/:assetId` | Redirect to frontend asset page |

</details>

---

## 🗄️ Data Models

<details>
<summary><strong>Asset</strong></summary>

```js
{
  assetId:       String  // unique
  assetName:     String
  category:      String  // IT Equipment | Vehicles | Furniture | Machinery
  status:        String  // Active | Inactive | Maintenance | Damaged
  location:      String
  latitude:      Number
  longitude:     Number
  description:   String
  manufacturer:  String
  serialNumber:  String
  purchaseDate:  Date
  purchasePrice: Number
  qrCode:        String  // base64 data URL
  lastUpdated:   Date
  updatedBy:     String
}
```

</details>

<details>
<summary><strong>User</strong></summary>

```js
{
  username:       String  // unique
  email:          String  // unique
  password:       String  // bcrypt hashed
  role:           String  // admin | manager | user
  phone:          String
  empId:          String
  twoFactorCode:  String
  twoFactorExpires: Date
  twoFactorEnabled: Boolean
  createdAt:      Date
}
```

</details>

<details>
<summary><strong>ScanHistory</strong></summary>

```js
{
  assetId:    String
  assetName:  String
  location:   String
  latitude:   Number
  longitude:  Number
  status:     String
  remarks:    String
  scannedBy:  String
  scannedAt:  Date
}
```

</details>

---

## 🔒 Security

- Passwords hashed with **bcryptjs** (salt rounds: 10)
- **JWT** tokens with configurable expiry (7d / 30d with Remember Me)
- **2FA** via email OTP on every login — delivered via Resend HTTP API
- `.env` files excluded from version control
- Input validation via **express-validator**
- CORS enabled for cross-origin requests
- Email credentials never logged or exposed in error responses

---

## 📄 License

MIT © [awnishkj](https://github.com/awnishkj)

---

<div align="center">
  Built with ❤️ by <a href="https://github.com/awnishkj">awnishkj</a>
</div>
