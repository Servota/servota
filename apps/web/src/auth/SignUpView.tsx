// apps/web/src/auth/SignUpView.tsx
import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export function SignUpView({ onSwitchMode }: { onSwitchMode: () => void }) {
  const [firstName, setFirstName] = useState<string>('');
  const [lastName, setLastName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirm, setConfirm] = useState<string>('');
  const [working, setWorking] = useState<boolean>(false);

  async function signUp() {
    const fn = firstName.trim();
    const ln = lastName.trim();
    const em = email.trim();

    if (!fn || !ln || !em || !password || !confirm) {
      window.alert('Please fill first name, last name, email, and both password fields.');
      return;
    }
    if (password !== confirm) {
      window.alert('Passwords do not match. Please re-enter your password.');
      return;
    }

    try {
      setWorking(true);
      const { error } = await supabase.auth.signUp({
        email: em,
        password,
        options: { data: { first_name: fn, last_name: ln } },
      });

      if (error) {
        window.alert(`Sign up failed: ${error.message}`);
        return;
      }

      window.alert(
        'Check your email. We sent you a confirmation link. After confirming, return here to sign in.'
      );
      onSwitchMode();
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <img
        src="/servota-logo.png"
        alt="Servota"
        className="w-[220px] h-auto self-center mb-3"
        onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')}
      />
      <div className="text-[16px] text-center mb-2">Create account</div>

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!working) void signUp();
        }}
      >
        <input
          placeholder="First name"
          value={firstName}
          onChange={(e) => setFirstName(e.currentTarget.value)}
          className="w-full box-border border border-[#d1d5db] rounded-[12px] p-3 bg-white"
        />
        <input
          placeholder="Last name"
          value={lastName}
          onChange={(e) => setLastName(e.currentTarget.value)}
          className="w-full box-border border border-[#d1d5db] rounded-[12px] p-3 bg-white"
        />
        <input
          type="email"
          placeholder="Email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
          className="w-full box-border border border-[#d1d5db] rounded-[12px] p-3 bg-white"
        />
        <input
          type="password"
          placeholder="Password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.currentTarget.value)}
          className="w-full box-border border border-[#d1d5db] rounded-[12px] p-3 bg-white"
        />
        <input
          type="password"
          placeholder="Confirm password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.currentTarget.value)}
          className="w-full box-border border border-[#d1d5db] rounded-[12px] p-3 bg-white"
        />

        {working ? (
          <button
            type="button"
            disabled
            className="w-full rounded-[12px] py-3 font-extrabold text-white bg-[#111] opacity-80"
          >
            Creating account…
          </button>
        ) : (
          <>
            <button
              type="submit"
              className="w-full rounded-[12px] py-3 font-extrabold text-white bg-[#111]"
            >
              Sign up
            </button>

            <button
              type="button"
              onClick={onSwitchMode}
              className="w-full rounded-[12px] py-3 font-extrabold text-[#111] bg-[#eef1f5]"
            >
              Back to sign in
            </button>
          </>
        )}
      </form>
    </div>
  );
}

export default SignUpView;
