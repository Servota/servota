import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // Next types this as read-only in some contexts, but it is writable in route handlers / server actions.
          cookiesToSet.forEach(({ name, value, options }) => {
            const mutableCookieStore = cookieStore as unknown as {
  set: (name: string, value: string, options?: unknown) => void;
};

mutableCookieStore.set(name, value, options);
          });
        },
      },
    },
  );
}
