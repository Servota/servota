import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>StillTrue</h1>
      <p>Signed in as: {user.email ?? user.id}</p>

      <form action="/logout" method="post" style={{ marginTop: 16 }}>
        <button type="submit">Logout</button>
      </form>
    </main>
  );
}
