import { useEffect, useState } from "react";

type AuthState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; user: { id: string; displayName: string } };

export function useAuth() {
  const [auth, setAuth] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/me')
        if (!res.ok) return setAuth({ status: 'anonymous' });
        const user = await (res.json()) as { id: string, displayName: string }
        setAuth({ status: 'authenticated', user })
      } catch {
        setAuth({ status: 'anonymous' })
      }
    }
    load()
  }, [])


  const logout = async () => {
    await fetch('/logout', { method: 'POST' })
    setAuth({ status: 'anonymous' })
  }

  return { auth, logout };
}