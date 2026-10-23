import { WebSocketServer } from 'ws';
import { WebSocket } from 'ws';
import type { IncomingMessage, Server } from 'http';
import { config } from './config.ts';
import { getAccessToken, getSession } from './features/auth/sessions.ts';
import { parseCookie } from 'cookie'
import { cancelJob, getJobState, startJob, subscribe } from './features/jobs/jobs.ts';
import { ClientMessageSchema, type ServerMessage } from '../shared/protocol.ts';

const HEARTBEAT_MS = 30_000
// List of sockets to each session on the server
const socketsBySid = new Map<string, Set<WebSocket>>();

export function attachWebSocket(server: Server): void {
  const wss = new WebSocketServer({ noServer: true })
  // sockets that answered the last ping
  const alive = new WeakSet<WebSocket>()

  server.on('upgrade', (req, soc, head) => {
    if (req.url !== '/ws') return soc.destroy()
    if (req.headers.origin !== `http://127.0.0.1:${config.PORT}`) return soc.destroy()

    const sid = parseCookie(req.headers.cookie ?? '').sid
    if (!sid || !getSession(sid)) return soc.destroy()
    wss.handleUpgrade(req, soc, head, (ws) => {
      wss.emit('connection', ws, sid);
    })
  })

  const aliveInterval = setInterval(() => {
    for (const client of wss.clients) {
      if (!alive.has(client)) {
        client.terminate()
        continue
      }
      alive.delete(client)
      client.ping()
    }
  }, HEARTBEAT_MS);

  wss.on('close', () => clearInterval(aliveInterval))

  wss.on('connection', (ws: WebSocket, sid: string) => {
    let sockets = socketsBySid.get(sid)

    if (!sockets) {
      sockets = new Set();
      socketsBySid.set(sid, sockets)
    }
    sockets.add(ws)

    const snapshot: ServerMessage = { type: 'snapshot', job: getJobState(sid) }
    const sendError = (message: string) => {
      const msg: ServerMessage = { type: 'error', message };
      ws.send(JSON.stringify(msg));
    };
    alive.add(ws) // mark as alive on new connection

    ws.send(JSON.stringify(snapshot))
    ws.on('error', (err) => console.error('ws error:', err))

    ws.on('pong', () => {
      alive.add(ws) // mark alive
    })

    ws.on('message', (data) => {
      // Gate 1
      let parsed: unknown
      try {
        parsed = JSON.parse(data.toString())
      } catch (error) {
        return sendError('Invalid JSON');
      }
      // Gate 2
      const result = ClientMessageSchema.safeParse(parsed)
      if (!result.success) return sendError('Invalid message')

      // Gate 3
      const msg = result.data
      switch (msg.type) {
        case 'start':
          try {
            startJob(sid, () => getAccessToken(sid), { categories: msg.categories, dryRun: msg.dryRun })
          } catch (error) {
            // If startjob has started it will reach this branch 
            sendError('A job is already running')
          }
          break;
        case 'cancel':
          cancelJob(sid)
          break;
      }
    })

    const unsubscribe = subscribe(sid, (msg) => ws.send(JSON.stringify(msg)))
    ws.on('close', () => {
      unsubscribe()
      sockets.delete(ws) // delete current socket from session → (1 tab)
      if (sockets.size === 0) socketsBySid.delete(sid); // last tab gone → remove the row
    })
  })
}

export function closeSessionSockets(sid: string) : void {
  const sockets = socketsBySid.get(sid)
  if(!sockets) return
  for(const socket of sockets) {
    socket.close(1008, 'Logged out') // 1008 = policy violation; tells the client NOT to reconnect
  }
}