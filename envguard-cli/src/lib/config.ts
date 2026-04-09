import fs from 'fs';
import path from 'path';

const CONFIG_DIR = '.envguard';
const CONFIG_FILE = 'config.json';

function getConfigPath() {
  return path.join(process.cwd(), CONFIG_DIR, CONFIG_FILE);
}

export function readConfig() {
  const configPath = getConfigPath();
  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export function writeConfig(config) {
  const configDir = path.join(process.cwd(), CONFIG_DIR);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  
  const configPath = getConfigPath();
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
}
