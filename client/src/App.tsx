import { useAuth } from './hooks/useAuth.ts';
import { LoginScreen } from './components/LoginScreen.tsx';
import { Dashboard } from './components/Dashboard.tsx';

export function App() {
  const { auth, logout } = useAuth();

  if (auth.status === 'loading') return <p>Loading…</p>;
  if (auth.status === 'anonymous') return <LoginScreen />;

  return <Dashboard user={auth.user} onLogout={logout} />;
}