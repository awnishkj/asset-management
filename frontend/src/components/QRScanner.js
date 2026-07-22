import React, { useState, useRef } from 'react';
import { FiRefreshCw, FiUpload } from 'react-icons/fi';
import jsQR from 'jsqr';
import axios from 'axios';
import '../styles/QRScanner.css';
import Layout from './Layout';

export default function QRScanner() {
  const [error, setError] = useState('');
  const [uploadedImage, setUploadedImage] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const imageInputRef = useRef(null);

  const startScanning = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) videoRef.current.srcObject = stream;
      setError('');
    } catch (err) {
      setError('Cannot access camera: ' + err.message);
    }
  };

  const captureFrame = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      context.drawImage(videoRef.current, 0, 0);

      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const qrCode = jsQR(imageData.data, imageData.width, imageData.height);
      if (qrCode) {
        setError('');
        handleScanSuccess(qrCode.data);
      } else {
        setError('No QR code detected in frame. Try again.');
      }
    }
  };

  const saveScanRecord = async (assetId, assetName) => {
    try {
      await axios.post('/scan-history', {
        assetId: assetId || 'Unknown',
        assetName: assetName || 'Unknown',
        scannedBy: 'PC Scan',
        status: 'Active',
        scannedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Failed to save scan record:', err);
    }
  };

  const handleScanSuccess = async (data) => {
    try {
      let assetId = null;
      let assetName = null;

      if (data.startsWith('http')) {
        const match = data.match(/\/asset\/(.+)$/);
        if (match) {
          assetId = decodeURIComponent(match[1]);
          try {
            const res = await axios.get(`/assets/public/${encodeURIComponent(assetId)}`);
            assetName = res.data?.assetName || null;
          } catch { /* asset not found */ }
        } else {
          assetId = data;
        }
      } else {
        try {
          const parsed = JSON.parse(data);
          assetId = parsed.assetId || data;
          assetName = parsed.assetName || null;
        } catch {
          assetId = data;
        }
      }

      await saveScanRecord(assetId, assetName);
      window.open(`/asset/${encodeURIComponent(assetId)}?source=pc`, '_blank');
    } catch {
      window.open(`/asset/${encodeURIComponent(data)}?source=pc`, '_blank');
    }
  };

  const handleReset = () => {
    setError('');
    setUploadedImage(null);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = canvasRef.current;
          canvas.width = img.width;
          canvas.height = img.height;
          const context = canvas.getContext('2d');
          context.drawImage(img, 0, 0);
          const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          const qrCode = jsQR(imageData.data, imageData.width, imageData.height);
          if (qrCode) {
            setUploadedImage(URL.createObjectURL(file));
            setError('');
            handleScanSuccess(qrCode.data);
          } else {
            setError('No QR code found in the image. Please try another image.');
            setUploadedImage(null);
          }
        } catch (err) {
          setError('Error processing image: ' + err.message);
          setUploadedImage(null);
        }
      };
      img.onerror = () => setError('Failed to load image');
      img.src = event.target.result;
    };
    reader.onerror = () => setError('Failed to read file');
    reader.readAsDataURL(file);
  };

  return (
    <Layout>
        <div className="qr-scanner-content">
          <h2>QR Code Scanner</h2>

          <div className="scanner-container">

            {/* Left: Upload QR Image */}
            <div className="camera-section">
              <h3>Upload QR Image</h3>
              <div className="upload-area">
                <label htmlFor="image-upload" className="upload-label">
                  <FiUpload size={32} />
                  <p>Click to upload QR code image</p>
                  <small>Supported: JPG, PNG, GIF</small>
                </label>
                <input
                  ref={imageInputRef}
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  style={{ display: 'none' }}
                />
              </div>
              {uploadedImage && (
                <div className="uploaded-image-preview">
                  <img src={uploadedImage} alt="Uploaded QR code" />
                </div>
              )}
              {error && <div className="error-box"><p>{error}</p></div>}
            </div>

            {/* Right: Camera */}
            <div className="camera-section">
              <h3>Scan with Camera</h3>
              <video ref={videoRef} autoPlay playsInline className="camera-feed" />
              <canvas ref={canvasRef} style={{ display: 'none' }} width={640} height={480} />
              {!videoRef.current?.srcObject ? (
                <button onClick={startScanning} className="start-scan-btn">Start Camera</button>
              ) : (
                <button onClick={captureFrame} className="capture-btn">
                  <FiRefreshCw /> Capture & Scan Frame
                </button>
              )}
            </div>

          </div>
        </div>
    </Layout>
  );
}
