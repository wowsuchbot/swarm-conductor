import { Router } from 'express';

export const healthRouter = Router();

healthRouter.get('/', async (req, res) => {
  const { openClawClient } = req.app.locals;
  
  try {
    const openClawHealth = openClawClient.isConnected()
      ? await openClawClient.getHealth().catch(() => ({ status: 'error' }))
      : { status: 'disconnected' };

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        api: 'healthy',
        openclaw: openClawHealth.status || 'disconnected'
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
