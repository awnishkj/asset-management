require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const db = mongoose.connection.db;
  const hash = await bcrypt.hash('2006', 10);
  const r = await db.collection('users').updateOne(
    { email: 'awnishkj2004@gmail.com' },
    { $set: { password: hash, twoFactorEnabled: false, twoFactorCode: null, twoFactorExpires: null } }
  );
  console.log('Password reset to 2006. Modified:', r.modifiedCount);
  process.exit();
}).catch(e => { console.log('Error:', e.message); process.exit(1); });
