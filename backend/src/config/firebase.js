const { initializeApp, getApps, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

const initializeFirebase = () => {
  try {
    if (!getApps().length) {
      if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
        initializeApp({
          credential: cert(serviceAccount)
        });
        console.log('Firebase Admin initialized with JSON credentials.');
      } else {
        console.warn('FIREBASE_SERVICE_ACCOUNT_JSON not found. Firebase Admin is NOT initialized.');
      }
    }
  } catch (error) {
    console.error('Firebase Admin initialization error:', error.message);
  }
};

const admin = {
  auth: () => getAuth()
};

module.exports = { admin, initializeFirebase };

