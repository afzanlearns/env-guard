import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { query } from '../db';

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  // 1. Check Session (Frontend Dashboard)
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }

  // 2. Check PAT Token (CLI)
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing session or PAT token' });
  }

  const tokenValue = authHeader.split(' ')[1];
  
  try {
    // Find all tokens (usually we would look up by a token prefix/ID, but simplistic here)
    const { rows } = await query('SELECT * FROM tokens');
    let matchedToken = null;

    for (const tokenRow of rows) {
      if (await bcrypt.compare(tokenValue, tokenRow.token_hash)) {
        matchedToken = tokenRow;
        break;
      }
    }

    if (!matchedToken) {
      return res.status(401).json({ error: 'Unauthorized: Invalid PAT token' });
    }

    // Attach user to req via token user id
    const userRes = await query('SELECT * FROM users WHERE id = $1', [matchedToken.user_id]);
    (req as any).user = userRes.rows[0];
    
    // Update last_used_at flag securely
    await query('UPDATE tokens SET last_used_at = NOW() WHERE id = $1', [matchedToken.id]);

    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error validating auth' });
  }
}
