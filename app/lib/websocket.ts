import type { EncryptedPayload, MessageResponse } from '../types';

export class MessageSocket {
  private ws: WebSocket | null = null;
  private token: string;
  private onMessage: (msg: MessageResponse) => void;
  private onConnect: () => void;
  private onDisconnect: () => void;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private messageQueue: Array<{ to: string; payload: EncryptedPayload }> = [];
  private isConnected = false;

  constructor(
    token: string,
    onMessage: (msg: MessageResponse) => void,
    onConnect?: () => void,
    onDisconnect?: () => void
  ) {
    this.token = token;
    this.onMessage = onMessage;
    this.onConnect = onConnect || (() => {});
    this.onDisconnect = onDisconnect || (() => {});
  }

  get connected() {
    return this.isConnected;
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) return;

    try {
      this.ws = new WebSocket(`wss://whisperbox.koyeb.app/ws?token=${this.token}`);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.onConnect();
        while (this.messageQueue.length > 0) {
          const item = this.messageQueue.shift()!;
          this.send(item.to, item.payload);
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const msg = data.data || data;
          if (data.event === 'message.receive' || data.type === 'message.receive' || msg.from_user_id) {
            this.onMessage(msg);
          }
        } catch (e) {
          console.error('[WS] Parse error:', e);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.onDisconnect();
        this.reconnectTimer = setTimeout(() => this.connect(), 5000);
      };

      this.ws.onerror = () => {
        this.isConnected = false;
      };
    } catch (e) {
      console.error('[WS] Connection error:', e);
    }
  }

  send(to: string, payload: EncryptedPayload): boolean {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        event: 'message.send',
        to,
        payload,
      }));
      return true;
    }
    this.messageQueue.push({ to, payload });
    return false;
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this.isConnected = false;
  }
}