// Using dynamic import or try/catch so if native bindings fail, we can fallback
let keytar;
try {
  keytar = await import('keytar');
} catch (e) {
  // Silent fallback for now, handle in methods
}

import fs from 'fs';
import path from 'path';
import os from 'os';

const SERVICE_NAME = 'envguard';
const ACCOUNT_NAME = 'default';

// Fallback logic for when keytar bindings fail to compile on certain platforms
function getFallbackPath() {
  return path.join(os.homedir(), '.envguard_token_fallback');
}

export async function setToken(token) {
  if (keytar && keytar.setPassword) {
    try {
      await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, token);
      return;
    } catch (err) {
      // Fall through to fallback
    }
  }
  
  // Fallback to file (insecure, but needed for platforms where keytar fails)
  fs.writeFileSync(getFallbackPath(), token, { mode: 0o600 });
}

export async function getToken() {
  if (keytar && keytar.getPassword) {
    try {
      const token = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
      if (token) return token;
    } catch (err) {
      // Fall through to fallback
    }
  }

  // Fallback to file
  try {
    return fs.readFileSync(getFallbackPath(), 'utf8').trim();
  } catch (err) {
    return null;
  }
}

export async function deleteToken() {
  if (keytar && keytar.deletePassword) {
    try {
      await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME);
    } catch (err) {
      // Fall through
    }
  }
  
  try {
    if (fs.existsSync(getFallbackPath())) {
      fs.unlinkSync(getFallbackPath());
    }
  } catch (e) {}
}
