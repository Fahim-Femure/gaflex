import { afterEach, describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { io as connectClient, type Socket } from 'socket.io-client';
import { createGameServer, type GameServer } from '../app';

let server: GameServer | null = null;
let client: Socket | null = null;

afterEach(async () => {
  client?.disconnect();
  client = null;
  await server?.close();
  server = null;
});

async function start(): Promise<string> {
  server = createGameServer({ corsOrigin: '*' });
  await new Promise<void>((resolve) => server!.httpServer.listen(0, resolve));
  const { port } = server.httpServer.address() as AddressInfo;
  return `http://localhost:${port}`;
}

describe('game server', () => {
  it('answers GET /health with ok', async () => {
    const url = await start();
    const res = await fetch(`${url}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('accepts a Socket.IO connection', async () => {
    const url = await start();
    client = connectClient(url, { transports: ['websocket'] });
    await new Promise<void>((resolve, reject) => {
      client!.on('connect', () => resolve());
      client!.on('connect_error', reject);
    });
    expect(client.connected).toBe(true);
  });
});
