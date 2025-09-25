// apps/web/src/member/MyDetails.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { getBrowserSupabaseClient } from '@servota/shared';

export default function MyDetails() {
  const supabase = useMemo(() => getBrowserSupabaseClient(), []);

  const [loading, setLoading] = useState(true);
  const [savingName, setSavingName] = useState(false);
  const [changingEmail, setChangingEmail] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');

  // load current user details
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.warn('Unable to load profile', error.message);
        setLoading(false);
        return;
      }
      const u = data.user;
      if (!u) {
        setLoading(false);
        return;
      }
      if (!mounted) return;
      setFirstName(String(u.user_metadata?.first_name ?? ''));
      setLastName(String(u.user_metadata?.last_name ?? ''));
      setEmail(String(u.email ?? ''));
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [supabase]);

  const saveName = async () => {
    const fn = firstName.trim();
    const ln = lastName.trim();
    if (!fn || !ln) {
      alert('Please enter both first and last name.');
      return;
    }
    setSavingName(true);

    // 1. update auth metadata
    const { error: authErr } = await supabase.auth.updateUser({
      data: { first_name: fn, last_name: ln },
    });
    if (authErr) {
      setSavingName(false);
      alert(`Update failed: ${authErr.message}`);
      return;
    }

    // 2. mirror into public.profiles
    const { data: userData, error: getErr } = await supabase.auth.getUser();
    if (getErr || !userData.user) {
      setSavingName(false);
      alert(`Update failed: ${getErr?.message ?? 'No auth user'}`);
      return;
    }
    const userId = userData.user.id;
    const full = `${fn} ${ln}`.trim();
    const { error: profErr } = await supabase.from('profiles').upsert(
      [
        {
          user_id: userId,
          first_name: fn,
          last_name: ln,
          full_name: full,
          display_name: full,
          updated_at: new Date().toISOString(),
        },
      ],
      { onConflict: 'user_id' }
    );
    setSavingName(false);
    if (profErr) {
      alert(`Name saved to auth, but profile failed: ${profErr.message}`);
      return;
    }
    alert('Your name has been updated.');
  };

  const changeEmail = async () => {
    const em = email.trim();
    if (!em) {
      alert('Please enter a valid email.');
      return;
    }
    setChangingEmail(true);
    const { error } = await supabase.auth.updateUser({ email: em });
    setChangingEmail(false);
    if (error) {
      alert(`Email change failed: ${error.message}`);
      return;
    }
    alert('We sent a confirmation link to the new address. Open it to complete the change.');
  };

  if (loading) {
    return <div className="sv-meta mt-2">Loading your details…</div>;
  }

  return (
    <section className="sv-page">
      <div className="sv-card p-4">
        <h2 className="sv-h1">My Details</h2>
        <p className="sv-meta">
          Update your name and email. Changing email will require you to confirm via a link sent to
          the new address.
        </p>
      </div>

      {/* Name */}
      <div className="sv-card p-4 mt-3 space-y-2">
        <h3 className="font-bold text-[#111]">Name</h3>
        <input
          placeholder="First name"
          value={firstName}
          onChange={(e) => setFirstName(e.currentTarget.value)}
          className="border rounded-[10px] px-3 py-2 w-full"
        />
        <input
          placeholder="Last name"
          value={lastName}
          onChange={(e) => setLastName(e.currentTarget.value)}
          className="border rounded-[10px] px-3 py-2 w-full"
        />
        <button
          className="sv-btn"
          type="button"
          onClick={saveName}
          disabled={savingName}
          aria-busy={savingName}
        >
          {savingName ? 'Saving…' : 'Save Name'}
        </button>
      </div>

      {/* Email */}
      <div className="sv-card p-4 mt-3 space-y-2">
        <h3 className="font-bold text-[#111]">Email</h3>
        <input
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
          className="border rounded-[10px] px-3 py-2 w-full"
        />
        <button
          className="sv-btn-ghost"
          type="button"
          onClick={changeEmail}
          disabled={changingEmail}
          aria-busy={changingEmail}
        >
          {changingEmail ? 'Changing…' : 'Change Email'}
        </button>
        <p className="sv-meta">You may be signed out after confirming the new email.</p>
      </div>
    </section>
  );
}
