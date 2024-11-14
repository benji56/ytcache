// logger.js
const { createLogger, format, transports } = require('winston');

const logger = createLogger({
  level: 'info', // Beállíthatod a minimális naplózási szintet
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }), // Stack trace megjelenítése hibák esetén
    format.splat(),
    format.json()
  ),
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.printf(({ timestamp, level, message, stack }) => {
          return `[${timestamp}] ${level}: ${stack || message}`;
        })
      ),
    }),
    // Ha szeretnél fájlba is naplózni:
    // new transports.File({ filename: 'app.log' }),
  ],
});

module.exports = logger;
