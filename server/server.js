const { mode } = require('./config/loadEnv');

const validateEnv = require('./lib/validateEnv');
const { warnings } = validateEnv();
for (const warning of warnings) console.warn(`[Config] ${warning}`);

const connectDB = require('./config/db');
const app = require('./app');
const { startDeletedSweep } = require('./lib/sweepDeleted');

const PORT = process.env.PORT || 5000;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[Server] Running on port ${PORT} in ${mode} mode`);
      startDeletedSweep();
    });
  })
  .catch((error) => {
    console.error(`[Server] Failed to start: ${error.message}`);
    process.exitCode = 1;
  });
