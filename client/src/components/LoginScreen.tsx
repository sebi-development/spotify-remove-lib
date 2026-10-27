// "?error=login_cancelled" is what the server's /callback redirects to when the user declines on Spotify.
const ERROR_MESSAGES: Record<string, string> = {
  login_cancelled: 'Login was cancelled. You can try again.',
};

export function LoginScreen() {
  const errorCode = new URLSearchParams(location.search).get('error');
  const errorMessage = errorCode ? (ERROR_MESSAGES[errorCode] ?? 'Login failed. Please try again.') : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-2xl font-semibold">Spotify Library Cleaner</h1>
      {errorMessage && (
        <p role="alert" className="rounded border border-danger/30 bg-danger-soft p-3 text-sm text-danger">
          {errorMessage}
        </p>
      )}
      {/* A real link, not fetch(): login is a full-page trip to Spotify and back. */}
      <a
        href="/login"
        className="rounded bg-accent px-4 py-2 text-center font-medium text-ink hover:bg-accent-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-dark"
      >
        Login with Spotify
      </a>
    </main>
  );
}
