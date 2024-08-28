const admin = require('firebase-admin');
const serviceAccount = '/Users/izzaldi/Documents/GitHub/private-key/konnectpro-b215e-b318d994dd45.json';


admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

module.exports = db;