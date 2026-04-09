import fs from 'fs';
import path from 'path';

const CACHE_DIR = '.envguard';
const CACHE_FILE = 'schema.json';

function getCachePath() {
  return path.join(process.cwd(), CACHE_DIR, CACHE_FILE);
}

export function readCache() {
  const cachePath = getCachePath();
  try {
    const raw = fs.readFileSync(cachePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export function writeCache(schema) {
  const cacheDir = path.join(process.cwd(), CACHE_DIR);
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  
  const cachePath = getCachePath();
  fs.writeFileSync(cachePath, JSON.stringify(schema, null, 2), 'utf8');
}
