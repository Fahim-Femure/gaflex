import { lazy } from 'react';

// three.js is large: load the scenes only on screens that draw them.
export const PlayerScene = lazy(() => import('./PlayerScene').then((m) => ({ default: m.PlayerScene })));
export const TableScene = lazy(() => import('./TableScene').then((m) => ({ default: m.TableScene })));
