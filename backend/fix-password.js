const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
mongoose.connect('mongodb://localhost:27017/assettrack').then(async () => {
  const hash = await bcrypt.hash('2006', 10);
  const r = await mongoose.connection.db.collection('users').updateOne(
    { email: 'awnishkj2004@gmail.com' },
    { $set: { 
        password: hash,
        twoFactorEnabled: true,
        twoFactorCode: null,
        twoFactorExpires: null
    }}
  );
  console.log('Done. Modified:', r.modifiedCount);
  process.exit();
}).catch(e => { console.log('Error:', e.message); process.exit(1); });
