import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function NewClaimPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) redirect("/login");

  return (
    <main style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <header style={{ marginBottom: 16 }}>
        <Link href="/claims" style={{ textDecoration: "none" }}>
          ← Back to claims
        </Link>
        <h1 style={{ fontSize: 24, fontWeight: 600, margin: "12px 0 0" }}>
          Create claim
        </h1>
        <p style={{ margin: "8px 0 0" }}>
          This screen is coming next. For now, it’s a placeholder so navigation
          works.
        </p>
      </header>

      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          padding: 16,
        }}
      >
        <p style={{ marginTop: 0 }}>
          Planned fields (no saving yet):
        </p>
        <ul style={{ marginTop: 8, marginBottom: 0 }}>
          <li>Claim text</li>
          <li>Visibility (private / workspace)</li>
          <li>Review cadence</li>
          <li>Validation mode</li>
        </ul>
      </div>
    </main>
  );
}
