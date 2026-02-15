import WebSocket from 'ws';
import { EventEmitter } from 'events';
import fetch from 'node-fetch';

export interface OpenClawConfig {
  gatewayUrl: string;
  httpUrl: string;
  token?: string;
  reconnectInterval?: number;
}

export interface OpenClawMessage {
  type: string;
  id?: string;
  method?: string;
  params?: any;
  payload?: any;
}

export class OpenClawClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private connected = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pendingRequests = new Map<string, { resolve: Function; reject: Function }>();
  private messageId = 0;

  constructor(public config: OpenClawConfig) {
    super();
    this.config.reconnectInterval = config.reconnectInterval || 5000;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = this.config.token
        ? `${this.config.gatewayUrl}?token=${this.config.token}`
        : this.config.gatewayUrl;

      this.ws = new WebSocket(wsUrl);

      this.ws.on('open', () => {
        console.log('[OpenClaw] WebSocket connected');
        this.connected = true;
        
        // Send connect message
        this.send({
          type: 'connect',
          params: {
            role: 'client',
            version: '1.0.0'
          }
        });

        this.emit('connected');
        resolve();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString()) as OpenClawMessage;
          this.handleMessage(message);
        } catch (error) {
          console.error('[OpenClaw] Failed to parse message:', error);
        }
      });

      this.ws.on('error', (error) => {
        console.error('[OpenClaw] WebSocket error:', error);
        this.emit('error', error);
        reject(error);
      });

      this.ws.on('close', () => {
        console.log('[OpenClaw] WebSocket closed');
        this.connected = false;
        this.emit('disconnected');
        this.scheduleReconnect();
      });
    });
  }

  private handleMessage(message: OpenClawMessage): void {
    // Handle responses to pending requests
    if (message.id && this.pendingRequests.has(message.id)) {
      const { resolve, reject } = this.pendingRequests.get(message.id)!;
      this.pendingRequests.delete(message.id);
      
      if (message.type === 'res') {
        resolve(message.payload);
      } else if (message.type === 'error') {
        reject(new Error(message.payload?.message || 'Unknown error'));
      }
      return;
    }

    // Handle events
    if (message.type === 'event') {
      this.emit('event', message.payload);
      this.emit(`event:${message.payload?.event}`, message.payload);
    }

    // Emit all messages for custom handling
    this.emit('message', message);
  }

  private send(message: OpenClawMessage): void {
    if (!this.ws || !this.connected) {
      throw new Error('WebSocket not connected');
    }
    this.ws.send(JSON.stringify(message));
  }

  async request(method: string, params?: any): Promise<any> {
    const id = `req-${++this.messageId}`;
    
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      
      this.send({
        type: 'req',
        id,
        method,
        params
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request timeout: ${method}`));
        }
      }, 30000);
    });
  }

  async invokeTool(tool: string, args: any = {}, sessionKey?: string): Promise<any> {
    const response = await fetch(`${this.config.httpUrl}/tools/invoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.token && { 'Authorization': `Bearer ${this.config.token}` })
      },
      body: JSON.stringify({
        tool,
        args,
        sessionKey: sessionKey || 'main'
      })
    });

    if (!response.ok) {
      throw new Error(`Tool invocation failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.result;
  }

  async sendAgentMessage(text: string, sessionKey: string = 'main'): Promise<any> {
    return this.request('agent', {
      text,
      sessionKey,
      options: {
        stream: false
      }
    });
  }

  async getHealth(): Promise<any> {
    return this.request('health');
  }

  async getStatus(): Promise<any> {
    return this.request('status');
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    
    console.log(`[OpenClaw] Reconnecting in ${this.config.reconnectInterval}ms...`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch(console.error);
    }, this.config.reconnectInterval);
  }

  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.connected = false;
    this.pendingRequests.clear();
  }

  isConnected(): boolean {
    return this.connected;
  }
}
