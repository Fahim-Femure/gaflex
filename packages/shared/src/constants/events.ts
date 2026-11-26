export const EVENTS = {
  // client -> server
  ROOM_CREATE: 'room:create',
  ROOM_JOIN: 'room:join',
  ROOM_PEEK: 'room:peek',
  ROOM_JOIN_TABLE: 'room:join_table',
  ROOM_LEAVE: 'room:leave',
  ROOM_DISBAND: 'room:disband',
  MEMBER_KICK: 'member:kick',
  SEAT_TAKE: 'seat:take',
  SEAT_LEAVE: 'seat:leave',
  GAME_START: 'game:start',
  GAME_PLAY: 'game:play',
  GAME_SKIP: 'game:skip',
  ROUND_NEXT: 'round:next',
  SESSION_RESUME: 'session:resume',
  // server -> client
  ROOM_STATE: 'room:state',
  GAME_PLAYER_VIEW: 'game:player_view',
  GAME_TABLE_VIEW: 'game:table_view',
  GAME_EVENT: 'game:event',
  ERROR: 'error',
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];
