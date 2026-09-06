const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('MONGODB_URI environment variable is required in production.');
    }
    console.warn('MONGODB_URI not provided. Attempting connection to local mongodb://localhost:27017/optimus');
  }

  const targetUri = uri || 'mongodb://localhost:27017/optimus';
  const timeoutMs = parseInt(process.env.MONGODB_TIMEOUT_MS, 10) || 5000;

  try {
    const conn = await mongoose.connect(targetUri, {
      serverSelectionTimeoutMS: timeoutMs
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    if (error.name === 'MongooseServerSelectionError') {
      console.error(`MongoDB Connection Error: Server selection timed out after ${timeoutMs}ms.`);
      console.error('Please verify that your database host is running and that your current IP address is whitelisted in Atlas Network Access: https://www.mongodb.com/docs/atlas/security-whitelist/');
    } else {
      console.error(`Error connecting to MongoDB: ${error.message}`);
    }
    throw error;
  }
};

const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
  } catch (err) {
    // Ignore disconnect error on exit
  }
};

module.exports = connectDB;
module.exports.connectDB = connectDB;
module.exports.disconnectDB = disconnectDB;

