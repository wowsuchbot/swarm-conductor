import { Router } from 'express';
import { z } from 'zod';

export const openClawRouter = Router();

const MessageSchema = z.object({
  text: z.string().min(1),
  sessionKey: z.string().optional().default('main')
});

const ToolInvokeSchema = z.object({
  tool: z.string(),
  args: z.record(z.any()).optional().default({}),
  sessionKey: z.string().optional().default('main')
});

openClawRouter.post('/message', async (req, res) => {
  const { openClawClient } = req.app.locals;
  
  try {
    const { text, sessionKey } = MessageSchema.parse(req.body);
    const result = await openClawClient.sendAgentMessage(text, sessionKey);
    
    res.json({
      success: true,
      result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

openClawRouter.post('/tool/invoke', async (req, res) => {
  const { openClawClient } = req.app.locals;
  
  try {
    const { tool, args, sessionKey } = ToolInvokeSchema.parse(req.body);
    const result = await openClawClient.invokeTool(tool, args, sessionKey);
    
    res.json({
      success: true,
      result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

openClawRouter.get('/status', async (req, res) => {
  const { openClawClient } = req.app.locals;
  
  try {
    const status = await openClawClient.getStatus();
    
    res.json({
      success: true,
      status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
