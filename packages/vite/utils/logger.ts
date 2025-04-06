import log, { LogLevelDesc } from 'loglevel';

// Set the default log level (can be dynamically updated)
log.setLevel((process.env.LOG_LEVEL || 'info') as LogLevelDesc);

// Export the logger
export const logger = log;

// Enable debug mode dynamically
export const enableDebugMode = () => {
  log.setLevel('debug');
  console.info('Debug mode enabled');
};

// Disable debug mode
export const disableDebugMode = () => {
  log.setLevel('info');
  console.info('Debug mode disabled');
};