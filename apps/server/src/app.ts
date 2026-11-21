import { createServer, type Server as HttpServer } from 'node:http';
import express from 'express';
import { Server as IoServer } from 'socket.io';
import { GameService, type GameServiceOptions } from './game/GameService';
import { RoomManager } from './rooms/RoomManager';
import { registerHandlers } from './socket/handlers';

export type GameServer = {
  httpServer: HttpServer;
  io: IoServer;
  manager: RoomManager;
  game: GameService;
  close: () => Promise<void>;
};

export type GameServerOptions = {
  corsOrigin: string | string[] | true;
  manager?: RoomManager;
  game?: GameServiceOptions;
  /** Pause before each automatic pass (default 900 ms). */
  passDelayMs?: number;
  /** How often expired members and idle rooms are swept. */
  sweepIntervalMs?: number;
};

export function createGameServer(options: GameServerOptions): GameServer {
  const app = express();
  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  const httpServer = createServer(app);
  const io = new IoServer(httpServer, { cors: { origin: options.corsOrigin } });
  const manager = options.manager ?? new RoomManager();
  const game = new GameService(manager, options.game);

  const { sweep, dispose } = registerHandlers(io, manager, game, { passDelayMs: options.passDelayMs });
  const timer = setInterval(sweep, options.sweepIntervalMs ?? 10_000);
  timer.unref();

  return {
    httpServer,
    io,
    manager,
    game,
    close: () =>
      new Promise<void>((resolve) => {
        clearInterval(timer);
        dispose();
        io.close(() => resolve());
      }),
  };
}
