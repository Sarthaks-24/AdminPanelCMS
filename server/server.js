require('dotenv').config();

const validateEnv = require('./lib/validateEnv');
validateEnv();

const connectDB = require('./config/db');
const app = require('./app');
const { startDeletedSweep } = require('./lib/sweepDeleted');

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[Server] Running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
      startDeletedSweep();
    });
  })
  .catch((error) => {
    console.error(`[Server] Failed to start: ${error.message}`);
    process.exitCode = 1;
  });
