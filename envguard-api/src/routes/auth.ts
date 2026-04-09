import { Router } from 'express';

const router = Router();

router.get('/github', (req, res) => {
  res.send('Redirecting to Github OAuth...');
});

router.get('/github/callback', (req, res) => {
  res.send('Github OAuth Callback');
});

export default router;
