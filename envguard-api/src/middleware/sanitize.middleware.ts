import { Request, Response, NextFunction } from 'express';

// Sanitization middleware to enforce Zero-Secrets
export function sanitizeSchemaPayload(req: Request, res: Response, next: NextFunction) {
  const { variables } = req.body;
  
  if (!variables || !Array.isArray(variables)) {
    return next();
  }

  // Very basic heuristic check -- fail on suspicious descriptions which look like secrets
  for (const v of variables) {
    if (v.description && (v.description.includes('=') || v.description.length > 100)) {
       // We won't block it completely in MVP, but we log a warning or could optionally throw
       console.warn(`[WARN] Suspicious metric detected in description for key ${v.key}`);
    }
  }

  next();
}
