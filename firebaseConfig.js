const admin = require('firebase-admin');
const serviceAccount = '/Users/izzaldi/Documents/GitHub/private-key/testingtracker-2d31c-768bbb72dd43.json';


admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

module.exports = db;