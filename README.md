# ASSETTRACK - Asset Management System

A comprehensive asset tracking system built with React, Node.js, Express, and MongoDB. Features include QR code generation/scanning, real-time location tracking, and comprehensive asset management.

## Features

- **User Authentication**: Secure login with JWT tokens
- **Asset Management**: Create, read, update, and delete assets
- **QR Code Generation**: Generate and download QR codes for assets
- **QR Code Scanning**: Scan QR codes with camera integration
- **Scan History**: Track all asset scans with timestamps and locations
- **Live Asset Tracking**: Real-time location tracking on maps
- **Asset Statistics**: Dashboard with asset status overview
- **User Management**: Multi-user support with role-based access

## Project Structure

```
├── backend/
│   ├── models/          # MongoDB schemas
│   ├── routes/          # API endpoints
│   ├── controllers/      # Business logic
│   ├── middleware/       # Custom middleware
│   ├── server.js        # Express server
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── components/   # React components
    │   ├── pages/        # Page components
    │   ├── styles/       # CSS files
    │   ├── App.js        # Main app component
    │   └── index.js      # React entry point
    ├── public/           # Static files
    └── package.json
```

## Installation

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file with the following variables:
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/assettrack
JWT_SECRET=your_jwt_secret_key_here
NODE_ENV=development
```

4. Start the server:
```bash
npm run dev
```

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file:
```
REACT_APP_API_URL=http://localhost:5000/api
```

4. Start the development server:
```bash
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Assets
- `GET /api/assets` - Get all assets
- `GET /api/assets/:id` - Get single asset
- `POST /api/assets` - Create new asset
- `PUT /api/assets/:id` - Update asset
- `DELETE /api/assets/:id` - Delete asset
- `GET /api/assets/stats/overview` - Get asset statistics

### QR Codes
- `POST /api/qr/generate` - Generate QR code
- `POST /api/qr/decode` - Decode QR code

### Scan History
- `GET /api/scan-history` - Get all scans
- `POST /api/scan-history` - Record scan
- `GET /api/scan-history/asset/:assetId` - Get asset scan history

## Database Schema

### Asset Model
- assetId (String, unique)
- assetName (String)
- category (String)
- status (String)
- location (String)
- latitude, longitude (Numbers)
- manufacturer, serialNumber (String)
- purchaseDate, purchasePrice
- qrCode (String)

### User Model
- username, email (String, unique)
- password (String, hashed)
- role (String: admin, manager, user)
- createdAt (Date)

### ScanHistory Model
- assetId, assetName (String)
- location (String)
- latitude, longitude (Numbers)
- scannedBy (String)
- scannedAt (Date)

## Technologies Used

- **Frontend**: React 18, React Router, Axios
- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose
- **QR Code**: qrcode, jsqr
- **Authentication**: JWT, bcryptjs
- **Styling**: CSS3 with responsive design
- **Location**: Leaflet, React-Leaflet
- **Charts**: Chart.js, React-ChartJS-2

## Environment Variables

### Backend (.env)
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/assettrack
JWT_SECRET=your_jwt_secret_key_here
NODE_ENV=development
```

### Frontend (.env)
```
REACT_APP_API_URL=http://localhost:5000/api
```

## Running the Application

1. **Start MongoDB** (if not running as a service)
2. **Start Backend Server**:
```bash
cd backend
npm run dev
```

3. **Start Frontend Development Server**:
```bash
cd frontend
npm start
```

4. **Access Application**: Open http://localhost:3000 in your browser

## Default Login Credentials

Create a test user through the registration page or use MongoDB to insert test data.

## Features in Detail

### Dashboard
- View total assets count
- Monitor active, inactive, and maintenance assets
- Real-time location tracking map
- Asset status distribution charts
- Recent assets list

### Asset Management
- Add new assets with full details
- Edit existing asset information
- Delete assets
- Search and filter assets
- View asset details and history

### QR Code Management
- Generate unique QR codes for each asset
- Download QR codes as PNG images
- Print QR codes for asset labels
- Scan QR codes with device camera
- Automatic asset lookup on scan

### Scan History
- Track all QR code scans
- View scan timestamps and locations
- Monitor asset movement patterns
- Export scan history reports

## Security Considerations

- Passwords are hashed using bcryptjs
- JWT tokens for API authentication
- CORS enabled for frontend communication
- Input validation on all API endpoints
- Environment variables for sensitive data

## Future Enhancements

- Real-time GPS tracking
- Mobile app development
- Advanced analytics and reports
- Bulk asset import/export
- Multi-location support
- Asset maintenance scheduling
- Email notifications
- Two-factor authentication

## License

MIT

## Support

For issues or questions, please create an issue in the repository.

---

Built with ❤️ for efficient asset management
