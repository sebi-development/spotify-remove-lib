import { useEffect, useReducer, useState } from 'react';
import type { ServerMessage } from '../../../shared/protocol.ts';
import { jobReducer } from '../utils/jobReducer.ts';

export function useCleanupSocket() {
  const [connected, setConnected] = useState(false)
  const [job, dispatch] = useReducer(jobReducer, null)  // null = no job yet

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
      dispatch(msg)
    }
    return () => {
      ws.close()
      setConnected(false)
    }
  }, [])
  return { connected }
}

