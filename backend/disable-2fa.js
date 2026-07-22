require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const db = mongoose.connection.db;
  const r = await db.collection('users').updateOne(
    { email: 'awnishkj2004@gmail.com' },
    { $set: { twoFactorEnabled: false, twoFactorCode: null, twoFactorExpires: null } }
  );
  console.log('2FA disabled. Modified:', r.modifiedCount);
  process.exit();
}).catch(e => { console.log('Error:', e.message); process.exit(1); });
