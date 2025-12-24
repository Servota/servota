export default function LoginPage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  return (
    <main style={{ padding: 24, maxWidth: 420 }}>
      <h1>Login</h1>

      <form
        action="/login/submit"
        method="post"
        style={{ display: 'grid', gap: 12 }}
      >
        <label style={{ display: 'grid', gap: 6 }}>
          <span>Email</span>
          <input name="email" type="email" autoComplete="email" required />
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          <span>Password</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>

        <button type="submit">Sign in</button>

        {searchParams?.error ? (
          <p style={{ margin: 0 }}>{searchParams.error}</p>
        ) : null}
      </form>
    </main>
  );
}
