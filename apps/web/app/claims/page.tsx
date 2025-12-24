import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type MemberClaimRow = {
  claim_id: string;
  visibility: string;
  created_at: string;
  retired_at: string | null;
  current_text: string;
  text_updated_at: string | null;
};

export default async function ClaimsPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) redirect("/login");

  const { data, error } = await supabase
    .from("claims_visible_to_member")
    .select(
      `
      claim_id,
      visibility,
      created_at,
      retired_at,
      current_text,
      text_updated_at
    `
    )
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 12 }}>
          Claims
        </h1>
        <p>We couldn’t load claims right now.</p>
      </main>
    );
  }

  const rows = (data ?? []) as MemberClaimRow[];

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <header style={headerWrap}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 600, margin: 0 }}>Claims</h1>
          <p style={{ marginTop: 8, marginBottom: 0 }}>
            Visible claims in this workspace. (No validation outcomes shown.)
          </p>
        </div>

        <Link href="/claims/new" style={primaryLink}>
          Create claim
        </Link>
      </header>

      {rows.length === 0 ? (
        <p>No claims yet.</p>
      ) : (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={th}>Claim</th>
                <th style={{ ...th, width: 120 }}>Visibility</th>
                <th style={{ ...th, width: 120 }}>Retired</th>
                <th style={{ ...th, width: 180 }}>Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.claim_id}>
                  <td style={td}>{row.current_text}</td>
                  <td style={td}>{row.visibility}</td>
                  <td style={td}>{row.retired_at ? "Yes" : "No"}</td>
                  <td style={td}>
                    {row.text_updated_at
                      ? new Date(row.text_updated_at).toLocaleDateString()
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

const headerWrap: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 16,
  marginBottom: 16,
};

const primaryLink: React.CSSProperties = {
  display: "inline-block",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #111827",
  textDecoration: "none",
};

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 14px",
  borderBottom: "1px solid #e5e7eb",
  fontWeight: 600,
};

const td: React.CSSProperties = {
  padding: "12px 14px",
  borderBottom: "1px solid #f3f4f6",
  verticalAlign: "top",
};
