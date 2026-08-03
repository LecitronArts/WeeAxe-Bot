const { redactConfig } = require('./config');

function createLogger(emit) {
  if (typeof emit !== 'function') {
    throw new TypeError('emit must be a function');
  }

  function log(level, message, context = {}) {
    emit({
      type: 'log',
      level,
      message: String(message),
      timestamp: new Date().toISOString(),
      context: redactConfig(context)
    });
  }

  return {
    log,
    debug: (message, context) => log('debug', message, context),
    info: (message, context) => log('info', message, context),
    warn: (message, context) => log('warn', message, context),
    error: (message, context) => log('error', message, context)
  };
}

module.exports = { createLogger };
