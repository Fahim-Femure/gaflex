import { createGameServer } from './app';

const port = Number(process.env.PORT ?? 3001);
// Production must set CORS_ORIGIN. Unset (local dev): reflect any origin so phones on the LAN can connect.
const corsOrigin = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true;

const { httpServer } = createGameServer({ corsOrigin });

httpServer.listen(port, () => {
  console.log(`[gaflex-server] listening on http://localhost:${port}`);
});
