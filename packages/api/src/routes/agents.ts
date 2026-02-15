import { Router } from 'express';

export const agentsRouter = Router();

agentsRouter.get('/', async (req, res) => {
  const { orchestrator } = req.app.locals;
  
  try {
    const agents = await orchestrator.listAgents();
    res.json({ success: true, agents });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

agentsRouter.post('/', async (req, res) => {
  const { orchestrator } = req.app.locals;
  
  try {
    const agent = await orchestrator.createAgent(req.body);
    res.json({ success: true, agent });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

agentsRouter.get('/:id', async (req, res) => {
  const { orchestrator } = req.app.locals;
  
  try {
    const agent = await orchestrator.getAgent(req.params.id);
    if (!agent) {
      return res.status(404).json({ success: false, error: 'Agent not found' });
    }
    res.json({ success: true, agent });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
