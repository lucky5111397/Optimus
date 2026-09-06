const axios = require('axios');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const crypto = require('crypto');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

function generateOAuthState(payload = {}) {
  const stateData = {
    action: payload.action || 'login',
    userId: payload.userId ? payload.userId.toString() : null,
    nonce: crypto.randomBytes(16).toString('hex')
  };
  return jwt.sign(stateData, process.env.JWT_SECRET || 'fallback_secret_dev_only', { expiresIn: '15m' });
}

function verifyOAuthState(stateStr) {
  if (!stateStr) return null;
  try {
    return jwt.verify(stateStr, process.env.JWT_SECRET || 'fallback_secret_dev_only');
  } catch (err) {
    return null;
  }
}

exports.githubLogin = (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const backendUrl = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;
  const redirectUri = `${backendUrl}/api/auth/github/callback`;
  const state = generateOAuthState({ action: 'login' });
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo,user&state=${encodeURIComponent(state)}`;
  res.redirect(githubAuthUrl);
};

exports.connectGithub = (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const backendUrl = process.env.BACKEND_URL || `${req.protocol}://${req.get('host')}`;
  const redirectUri = `${backendUrl}/api/auth/github/callback`;
  const state = generateOAuthState({ action: 'link', userId: req.userId });
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=repo,user&state=${encodeURIComponent(state)}`;
  res.redirect(githubAuthUrl);
};

exports.githubCallback = async (req, res) => {
  const { code, state, error } = req.query;
  const statePayload = verifyOAuthState(state);

  // 0. Handle OAuth cancellation or errors from GitHub
  if (error) {
    console.warn('GitHub OAuth rejected or cancelled:', error, req.query.error_description);
    const targetUrl = statePayload?.action === 'link'
      ? `${FRONTEND_URL}/settings?error=oauth_cancelled`
      : `${FRONTEND_URL}/login?error=oauth_cancelled`;
    return res.redirect(targetUrl);
  }

  if (!code) {
    return res.redirect(`${FRONTEND_URL}/login?error=no_code`);
  }

  // 1. Verify OAuth CSRF state parameter
  if (!statePayload) {
    console.error('Invalid or expired OAuth state in githubCallback');
    return res.redirect(`${FRONTEND_URL}/login?error=invalid_state`);
  }

  try {
    // 2. Exchange authorization code for access token
    const tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code
      },
      {
        headers: { accept: 'application/json' },
        timeout: 15000
      }
    );

    const accessToken = tokenResponse.data.access_token;
    if (!accessToken) {
      const errTarget = statePayload.action === 'link'
        ? `${FRONTEND_URL}/settings?error=no_access_token`
        : `${FRONTEND_URL}/login?error=no_access_token`;
      return res.redirect(errTarget);
    }

    // 3. Fetch authenticated user info from GitHub
    const userResponse = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 15000
    });
    const githubUser = userResponse.data;

    // 4. Fetch primary email if not public in profile
    let email = githubUser.email;
    if (!email) {
      try {
        const emailsResponse = await axios.get('https://api.github.com/user/emails', {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 10000
        });
        const primaryEmail = (emailsResponse.data || []).find(e => e.primary);
        if (primaryEmail) email = primaryEmail.email;
      } catch (err) {
        console.warn('Failed to fetch github emails:', err.message);
      }
    }

    // 5. BRANCH A: Connect GitHub to Existing Authenticated Account (Action: 'link')
    if (statePayload.action === 'link') {
      const targetUserId = statePayload.userId;
      if (!targetUserId) {
        return res.redirect(`${FRONTEND_URL}/settings?error=missing_user_link`);
      }

      const existingUser = await User.findById(targetUserId);
      if (!existingUser) {
        return res.redirect(`${FRONTEND_URL}/settings?error=user_not_found`);
      }

      // Prevent account takeover: Check if this GitHub account is already tied to another user
      const duplicateUser = await User.findOne({
        githubId: githubUser.id.toString(),
        _id: { $ne: existingUser._id }
      });

      if (duplicateUser) {
        console.warn(`GitHub ID ${githubUser.id} is already linked to user ${duplicateUser._id}`);
        return res.redirect(`${FRONTEND_URL}/settings?error=github_already_linked`);
      }

      // Associate GitHub identity and token
      existingUser.githubId = githubUser.id.toString();
      existingUser.githubUsername = githubUser.login;
      existingUser.accessToken = accessToken;
      if (!existingUser.avatarUrl) existingUser.avatarUrl = githubUser.avatar_url;
      await existingUser.save();

      return res.redirect(`${FRONTEND_URL}/settings?github=connected`);
    }

    // 5. BRANCH B: Standard Login / Registration (Action: 'login')
    let user = await User.findOne({ githubId: githubUser.id.toString() });
    let isNew = false;

    if (!user) {
      if (email) {
        user = await User.findOne({ email });
      }

      if (user) {
        user.githubId = githubUser.id.toString();
        user.githubUsername = githubUser.login;
        user.accessToken = accessToken;
        if (!user.avatarUrl) user.avatarUrl = githubUser.avatar_url;
      } else {
        isNew = true;
        user = new User({
          githubId: githubUser.id.toString(),
          githubUsername: githubUser.login,
          username: githubUser.login,
          name: githubUser.name || githubUser.login,
          email: email,
          avatarUrl: githubUser.avatar_url,
          accessToken,
          provider: 'github'
        });
      }
    } else {
      user.githubUsername = githubUser.login;
      user.username = user.username || githubUser.login;
      user.name = user.name || githubUser.name || githubUser.login;
      user.email = email || user.email;
      user.avatarUrl = githubUser.avatar_url || user.avatarUrl;
      user.accessToken = accessToken;
    }

    await user.save();

    // 6. Generate JWT and issue HTTP-only cookie
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'fallback_secret_dev_only',
      { expiresIn: '7d' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    return res.redirect(`${FRONTEND_URL}${isNew ? '/setup' : '/dashboard'}`);
  } catch (error) {
    console.error('GitHub Auth Error:', error.response?.data || error.message);
    const targetUrl = statePayload?.action === 'link'
      ? `${FRONTEND_URL}/settings?error=auth_failed`
      : `${FRONTEND_URL}/login?error=auth_failed`;
    return res.redirect(targetUrl);
  }
};

exports.disconnectGithub = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Guard: Prevent user lockout if GitHub was their sole login provider
    if (!user.googleId) {
      return res.status(400).json({
        error: 'Cannot disconnect GitHub when it is your only login provider. Add a Google login first to prevent account lockout.'
      });
    }

    user.accessToken = undefined;
    user.githubId = undefined;
    user.githubUsername = undefined;
    await user.save();

    return res.json({
      message: 'GitHub account disconnected successfully',
      githubConnected: false
    });
  } catch (error) {
    console.error('Disconnect GitHub Error:', error);
    return res.status(500).json({ error: 'Failed to disconnect GitHub account' });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const safeUser = user.toObject();
    safeUser.githubConnected = Boolean(user.accessToken);
    safeUser.githubUsername = user.githubUsername || (user.githubId ? user.username : null);
    delete safeUser.accessToken;

    return res.json(safeUser);
  } catch (error) {
    console.error('Get Me Error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
};

// PUT /api/auth/profile
exports.updateProfile = async (req, res) => {
  try {
    const { username, name } = req.body;
    const updates = {};
    
    if (username !== undefined) {
      // Basic validation: alphanumeric, dash, underscore, 2-30 chars
      if (typeof username !== 'string' || !/^[a-zA-Z0-9_-]{2,30}$/.test(username)) {
        return res.status(400).json({ error: 'Invalid username. Use 2-30 alphanumeric characters, dashes, or underscores.' });
      }
      updates.username = username;
    }
    
    if (name !== undefined) {
      if (typeof name !== 'string' || name.length < 1 || name.length > 100) {
        return res.status(400).json({ error: 'Name must be between 1 and 100 characters.' });
      }
      updates.name = name;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update.' });
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-accessToken');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Update Profile Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.logout = (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
};

const { admin } = require('../config/firebase');

exports.firebaseGoogleLogin = async (req, res) => {
  const { idToken } = req.body;

  if (!idToken) {
    return res.status(400).json({ error: 'Missing ID token' });
  }

  try {
    // 1. Verify the Firebase ID Token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    if (!decodedToken || !decodedToken.uid) {
      return res.status(401).json({ error: 'Invalid ID token' });
    }

    const { uid, email, name, picture } = decodedToken;

    // 2. Find or create user in MongoDB
    let user = await User.findOne({ googleId: uid });
    let isNew = false;

    if (!user) {
      // Check if user exists by email to link accounts, or just create new
      user = await User.findOne({ email: email });
      if (user) {
        // Link Google ID to existing user
        user.googleId = uid;
        // Optionally update provider flags here if needed
      } else {
        // Create new user
        isNew = true;
        user = new User({
          googleId: uid,
          username: email.split('@')[0], // Create a default username
          name: name || email.split('@')[0],
          email: email,
          avatarUrl: picture,
          provider: 'google'
        });
      }
    } else {
      user.name = name || user.name;
      user.avatarUrl = picture || user.avatarUrl;
    }

    await user.save();

    // 3. Issue the standard JWT cookie
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'fallback_secret_dev_only',
      { expiresIn: '7d' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    const safeUser = user.toObject ? user.toObject() : { ...user };
    delete safeUser.accessToken;

    res.json({ message: 'Login successful', user: safeUser, isNew });

  } catch (error) {
    console.error('Firebase Google Auth Error:', error.message);
    res.status(401).json({ error: 'Authentication failed' });
  }
};

