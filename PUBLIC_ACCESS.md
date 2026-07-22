# How to Make AssetTrack Accessible from Any Network

Your phone needs to reach your PC over the internet. Here's the simplest approach:

## Option 1: Cloudflare Tunnel (Recommended - Free, No Account)

1. Open **two** terminals (PowerShell or CMD)

2. **Terminal 1 - Backend Tunnel:**
   ```
   cd C:\Users\AWNISH JAISWAL\Desktop\okkk
   .\cloudflared.exe tunnel --url http://localhost:5000
   ```
   Wait ~10 seconds. You'll see a line like:
   ```
   INF |  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):
   INF |  https://abc-xyz-123.trycloudflare.com
   ```
   **Copy that HTTPS URL** — that's your Backend URL.

3. **Terminal 2 - Frontend Tunnel:**
   ```
   cd C:\Users\AWNISH JAISWAL\Desktop\okkk
   .\cloudflared.exe tunnel --url http://localhost:3000
   ```
   Wait ~10 seconds. Copy the HTTPS URL that appears — that's your Frontend URL.

4. **Update the frontend `.env` file:**
   Open `frontend\.env` and update:
   ```
   REACT_APP_API_URL=<YOUR_BACKEND_URL>/api
   REACT_APP_FRONTEND_URL=<YOUR_FRONTEND_URL>
   ```

5. **Restart the frontend:**
   - Stop the frontend process (Ctrl+C in its terminal or from Kiro)
   - Run `npm start` again in the `frontend` folder

6. **Generate new QR codes** in the app — old ones have the local IP baked in.

---

## Option 2: ngrok (Requires Free Account)

1. Sign up at https://ngrok.com
2. Get your authtoken: https://dashboard.ngrok.com/get-started/your-authtoken
3. Run: `.\ngrok.exe authtoken <YOUR_TOKEN>`
4. Start two tunnels (two separate terminals):
   ```
   .\ngrok.exe http 5000
   .\ngrok.exe http 3000
   ```
5. Copy the HTTPS URLs that appear
6. Update `.env` as described above

---

## Current Setup (Local Network Only)

Right now, QR codes point to:
```
http://10.134.23.16:3000/asset/...
```

This only works if the phone is on **the same WiFi** as your PC. For access from anywhere (mobile data, other networks), use one of the tunnel options above.

---

## Important Notes

- **Tunnels are temporary** — URLs change each time you restart cloudflared/ngrok
- **Regenerate QR codes** after updating URLs
- Keep the tunnel terminals running while using the app remotely
- For production, consider a proper hosting setup or Cloudflare Zero Trust with named tunnels
