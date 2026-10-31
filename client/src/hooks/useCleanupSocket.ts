import { useEffect, useReducer, useRef, useState } from 'react';
import { jobReducer } from '../utils/jobReducer.ts';
import type { CategoryId, ClientMessage, ServerMessage } from '../../../shared/protocol.ts';

const WS_URL = `ws://${location.host}/ws`;

export function useCleanupSocket() {
  const [connected, setConnected] = useState(false)
  const [job, dispatch] = useReducer(jobReducer, null)

  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => setConnected(true)
    ws.onclose = () => setConnected(false)
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data) as ServerMessage
      dispatch(msg)
    }

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [])

  const send = (msg: ClientMessage) => {
    const ws = wsRef.current
    if (ws?.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify(msg))
  }

  const startJob = (categories: CategoryId[], dryRun: boolean) => {
    send({ type: 'start', categories, dryRun, confirm: 'DELETE' })
  }

  const cancelJob = () => send({ type: 'cancel' })
  return { connected, job, startJob, cancelJob }
}
