import { Router } from 'express';
import passport from '../services/auth.service';

const router = Router();
const FRONTEND_URL = process.env.VITE_FRONTEND_URL || 'http://localhost:5173';

router.get('/github', passport.authenticate('github', { scope: ['user:email'] }));

router.get(
  '/github/callback',
  passport.authenticate('github', { failureRedirect: `${FRONTEND_URL}/login` }),
  (req, res) => {
    // Successful authentication, redirect to dashboard.
    res.redirect(`${FRONTEND_URL}/dashboard`);
  }
);

router.get('/me', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  res.json({ user: req.user });
});

router.post('/logout', (req: any, res, next) => {
  req.logout((err: any) => {
    if (err) { return next(err); }
    res.json({ success: true });
  });
});

export default router;
