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
Body: {
  username: string,
  email: string,
  password: string
}
```

#### Login
```
POST /api/auth/login
Body: {
  email: string,
  password: string,
  rememberMe: boolean
}
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

#### Update Asset
```
PUT /api/assets/:id
Body: { asset fields to update }
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

### Email / 2FA (SMTP)

- The app sends 2FA codes via email. In development, if SMTP is not configured, the server falls back to Nodemailer Ethereal (test) accounts and logs a preview URL to the backend console. Open that preview URL in your browser to view the sent email.
- To enable real email delivery, set the SMTP environment variables in `backend/.env` or your environment (see `.env.example`). Recommended providers: Gmail (use App Password), Mailgun, SendGrid, or Mailtrap for testing.

Gmail (App Password) quick setup:

1. Enable 2-Step Verification on your Google account.
2. Go to Google Account → Security → App Passwords.
3. Create a new App Password for "Mail" and copy it.
4. In `backend/.env` set:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=awnishkj2004@gmail.com
SMTP_PASS=your_app_password_here
SMTP_FROM=awnishkj2004@gmail.com
SMTP_SECURE=false
```

If you are testing locally and do not want to use Gmail yet, leave SMTP values blank and the app will use Ethereal in development only.

Mailtrap / MailHog (local testing):

- Mailtrap: sign up for Mailtrap, get SMTP credentials, and set them in `.env`. Emails are captured in your Mailtrap inbox.
- MailHog: run MailHog locally and point `SMTP_HOST`/`SMTP_PORT` to it; emails will appear at http://localhost:8025.

Security note: Never commit real SMTP credentials to source control. Use environment variables or secret management.

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
