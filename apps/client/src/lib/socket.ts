import { io, type Socket } from 'socket.io-client';
import type { Ack } from '@gaflex/shared';

export type ClientAck<T> = Ack<T> | { ok: false; error: 'TIMEOUT' };

/** Default to the same host on port 3001 so phones on the LAN reach the dev server. */
// Env values pasted from editors can carry a BOM or spaces; a BOM makes the URL parse as host "https".
const configured = String(import.meta.env.VITE_SERVER_URL ?? '').replace(/^\uFEFF/, '').trim();
const SERVER_URL = configured || `${window.location.protocol}//${window.location.hostname}:3001`;

let socket: Socket | null = null;

export function getSocket(): Socket {
  socket ??= io(SERVER_URL, { transports: ['websocket', 'polling'] });
  return socket;
}

export async function request<T>(event: string, payload: unknown = {}): Promise<ClientAck<T>> {
  try {
    return await getSocket().timeout(5000).emitWithAck(event, payload);
  } catch {
    return { ok: false, error: 'TIMEOUT' };
  }
}
