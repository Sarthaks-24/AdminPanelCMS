const { connectMongo } = require('../lib/mongoConnect');

const connectDB = async () => {
  try {
    const conn = await connectMongo(process.env.MONGODB_URI, {
      autoIndex: true,
      maxPoolSize: 10,
    });
    console.log(`[MongoDB] Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`[MongoDB Error] Failed to connect: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
