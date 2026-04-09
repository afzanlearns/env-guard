import fs from 'fs';

/**
 * Parses a .env file and strips out all values.
 * Only returns the keys.
 * 
 * @param {string} filePath - Path to the .env file
 * @returns {Array<{key: string}>} Array of objects containing only the key names
 */
export function parseEnvFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const lines = raw.split('\n');

    return lines
      .filter(line => {
        const trimmed = line.trim();
        // Ignore empty lines and comments
        return trimmed && !trimmed.startsWith('#');
      })
      .map(line => {
        // Handle "export KEY=value" cases
        line = line.replace(/^export\s+/, '');
        
        const eqIndex = line.indexOf('=');
        // If no '=' is found, just use the whole line as key (though invalid .env)
        const key = eqIndex !== -1 ? line.substring(0, eqIndex).trim() : line.trim();
        
        // VALUE IS INTENTIONALLY DISCARDED HERE
        // No hash, no truncation, no nothing
        return { key };
      });
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error('ERR_NO_ENV_FILE');
    }
    throw error;
  }
}
