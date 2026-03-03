const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = (process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/maidfinder').trim();
  try {
    const conn = await mongoose.connect(uri, {
      directConnection: true,
      serverSelectionTimeoutMS: 10000,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('MongoDB Connection Error:', error.message);
    console.error('Tip: Use mongodb://127.0.0.1:27017/maidfinder for local MongoDB, or MongoDB Atlas for cloud.');
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
};

module.exports = connectDB;
