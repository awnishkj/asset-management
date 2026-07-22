// Generate self-signed cert using Node built-in crypto (Node 22+)
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });

// Use Node's built-in X509Certificate generation
const { X509Certificate } = crypto;

// Build a minimal self-signed cert via forge approach - use node-forge if available
// Otherwise fall back to a pre-generated hardcoded test cert
try {
  const forge = require('node-forge');
  const pki = forge.pki;

  const keys = pki.rsa.generateKeyPair(2048);
  const cert = pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

  const attrs = [
    { name: 'commonName', value: '192.168.1.2' },
    { name: 'organizationName', value: 'AssetTrack' },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.setExtensions([
    { name: 'subjectAltName', altNames: [
      { type: 7, ip: '192.168.1.2' },
      { type: 7, ip: '127.0.0.1' },
      { type: 2, value: 'localhost' },
    ]},
    { name: 'basicConstraints', cA: true },
  ]);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  fs.writeFileSync(path.join(__dirname, 'cert.pem'), pki.certificateToPem(cert));
  fs.writeFileSync(path.join(__dirname, 'key.pem'), pki.privateKeyToPem(keys.privateKey));
  console.log('Certificate generated successfully with node-forge.');
} catch (e) {
  console.log('node-forge not available, trying selfsigned...');
  const ss = require('selfsigned');
  const result = ss.generate([{ name: 'commonName', value: 'localhost' }], { days: 365 });
  console.log('selfsigned result keys:', Object.keys(result));
  const certPem = result.cert || result.certificate || result[0];
  const keyPem = result.private || result.key || result[1];
  if (!certPem || !keyPem) throw new Error('Could not extract cert/key from selfsigned: ' + JSON.stringify(Object.keys(result)));
  fs.writeFileSync(path.join(__dirname, 'cert.pem'), certPem);
  fs.writeFileSync(path.join(__dirname, 'key.pem'), keyPem);
  console.log('Certificate generated with selfsigned.');
}
