import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import { openClawRouter } from './routes/openclaw.js';
import { healthRouter } from './routes/health.js';
import { agentsRouter } from './routes/agents.js';
import { OpenClawClient } from './openclaw/client.js';
import { AgentOrchestrator } from './orchestrator/index.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize OpenClaw client
const openClawClient = new OpenClawClient({
  gatewayUrl: process.env.OPENCLAW_GATEWAY_URL || 'ws://localhost:18789',
  token: process.env.OPENCLAW_GATEWAY_TOKEN,
  httpUrl: process.env.OPENCLAW_HTTP_URL || 'http://localhost:18789'
});

// Initialize orchestrator
const orchestrator = new AgentOrchestrator(openClawClient, io);

// Make available to routes
app.locals.openClawClient = openClawClient;
app.locals.orchestrator = orchestrator;
app.locals.io = io;

// Routes
app.use('/health', healthRouter);
app.use('/api/openclaw', openClawRouter);
app.use('/api/agents', agentsRouter);

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log(`[WebSocket] Client connected: ${socket.id}`);
  
  socket.on('disconnect', () => {
    console.log(`[WebSocket] Client disconnected: ${socket.id}`);
  });
  
  socket.on('subscribe:agent', (agentId: string) => {
    socket.join(`agent:${agentId}`);
    console.log(`[WebSocket] ${socket.id} subscribed to agent:${agentId}`);
  });
});

// Connect to OpenClaw
await openClawClient.connect();

// Start orchestrator
await orchestrator.start();

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`[API] Server running on port ${PORT}`);
  console.log(`[OpenClaw] Connected to ${openClawClient.config.gatewayUrl}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[API] SIGTERM received, shutting down gracefully...');
  await orchestrator.stop();
  await openClawClient.disconnect();
  httpServer.close(() => {
    console.log('[API] Server closed');
    process.exit(0);
  });
});
