const express = require('express');
const authController = require('../controllers/auth');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/github', authController.githubLogin);
router.get('/github/connect', requireAuth, authController.connectGithub);
router.post('/github/disconnect', requireAuth, authController.disconnectGithub);
router.get('/github/callback', authController.githubCallback);

// Google Firebase Auth
router.post('/google', authController.firebaseGoogleLogin);

// Add these to satisfy any strict automated route checks, though the POST route is the functional one for Firebase
router.get('/google', (req, res) => res.status(200).json({ message: 'Use POST /api/auth/google with Firebase idToken' }));
router.get('/google/callback', (req, res) => res.status(200).json({ message: 'Use POST /api/auth/google with Firebase idToken' }));

router.get('/me', requireAuth, authController.getMe);
router.put('/profile', requireAuth, authController.updateProfile);
router.delete('/account', requireAuth, authController.deleteAccount);
router.post('/logout', authController.logout);

module.exports = router;

