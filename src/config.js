const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const pendingSaves = new Map();

const DEFAULT_CONFIG = Object.freeze({
  serverHost: '',
  serverPort: 25565,
  mainBotName: '',
  botOwner: '',
  loginPassword: '',
  songRepository: '',
  reconnectDelayMs: 5000,
  commandPolicy: Object.freeze({
    allowPlay: true,
    allowStop: true,
    allowRide: true
  })
});

function createDefaultConfig() {
  return {
    ...DEFAULT_CONFIG,
    commandPolicy: { ...DEFAULT_CONFIG.commandPolicy }
  };
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateConfig(config) {
  const errors = [];
  if (!isPlainObject(config)) {
    throw new Error('Invalid configuration: configuration must be an object');
  }

  const requiredStrings = ['serverHost', 'mainBotName', 'botOwner', 'loginPassword', 'songRepository'];
  for (const field of requiredStrings) {
    if (typeof config[field] !== 'string') {
      errors.push(`${field} must be a string`);
    } else if (field !== 'loginPassword' && config[field].trim() === '') {
      errors.push(`${field} must not be empty`);
    }
  }

  if (!Number.isInteger(config.serverPort) || config.serverPort < 1 || config.serverPort > 65535) {
    errors.push('serverPort must be an integer between 1 and 65535');
  }

  const reconnectDelayMs = config.reconnectDelayMs ?? DEFAULT_CONFIG.reconnectDelayMs;
  if (!Number.isInteger(reconnectDelayMs) || reconnectDelayMs < 0) {
    errors.push('reconnectDelayMs must be a non-negative integer');
  }

  const commandPolicy = config.commandPolicy ?? DEFAULT_CONFIG.commandPolicy;
  if (!isPlainObject(commandPolicy)) {
    errors.push('commandPolicy must be an object');
  } else {
    for (const field of ['allowPlay', 'allowStop', 'allowRide']) {
      if (typeof commandPolicy[field] !== 'boolean') {
        errors.push(`commandPolicy.${field} must be a boolean`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid configuration: ${errors.join('; ')}`);
  }

  return {
    serverHost: config.serverHost.trim(),
    serverPort: config.serverPort,
    mainBotName: config.mainBotName.trim(),
    botOwner: config.botOwner.trim(),
    loginPassword: config.loginPassword,
    songRepository: config.songRepository.trim(),
    reconnectDelayMs,
    commandPolicy: {
      allowPlay: commandPolicy.allowPlay,
      allowStop: commandPolicy.allowStop,
      allowRide: commandPolicy.allowRide
    }
  };
}

async function loadConfig(configPath) {
  try {
    const raw = await fs.readFile(configPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!isPlainObject(parsed)) {
      throw new Error('Configuration file must contain a JSON object');
    }

    return {
      ...createDefaultConfig(),
      ...parsed,
      commandPolicy: {
        ...DEFAULT_CONFIG.commandPolicy,
        ...parsed.commandPolicy
      }
    };
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }

    const defaults = createDefaultConfig();
    await saveConfig(configPath, defaults);
    return defaults;
  }
}

async function writeConfig(configPath, config) {
  const directory = path.dirname(configPath);
  const basename = path.basename(configPath);
  const tempPath = path.join(directory, `.${basename}.${process.pid}.${randomUUID()}.tmp`);
  const contents = `${JSON.stringify(config, null, 2)}\n`;

  await fs.mkdir(directory, { recursive: true });
  try {
    await fs.writeFile(tempPath, contents, { encoding: 'utf8', mode: 0o600 });
    await fs.rename(tempPath, configPath);
  } catch (error) {
    await fs.rm(tempPath, { force: true }).catch(() => {});
    throw error;
  }
}

function saveConfig(configPath, config) {
  const previous = pendingSaves.get(configPath) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(() => writeConfig(configPath, config));
  pendingSaves.set(configPath, next);
  return next.finally(() => {
    if (pendingSaves.get(configPath) === next) pendingSaves.delete(configPath);
  });
}

function redactConfig(value) {
  if (Array.isArray(value)) {
    return value.map(redactConfig);
  }
  if (!isPlainObject(value)) {
    return value;
  }

  return Object.fromEntries(Object.entries(value).map(([key, nestedValue]) => [
    key,
    key === 'loginPassword' ? '[redacted]' : redactConfig(nestedValue)
  ]));
}

module.exports = {
  DEFAULT_CONFIG,
  loadConfig,
  saveConfig,
  validateConfig,
  redactConfig
};
