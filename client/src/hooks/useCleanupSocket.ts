import { useEffect, useState } from 'react';
import type { ServerMessage } from '../../../shared/protocol.ts';

export function useCleanupSocket() {
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const ws = new WebSocket(`ws://${location.host}/ws`)
    ws.onopen = () => {
      setConnected(true)
      console.log('opened');
    } 
    ws.onclose = () => {
      setConnected(false)
      console.log('closed');
    } 
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data) as ServerMessage
      console.log(msg);
    }
    return () => {
      ws.close()
      setConnected(false)
    }
  }, [])
  return { connected }
}

