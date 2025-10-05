// apps/web/src/auth/SignInView.tsx
import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export function SignInView({ onSwitchMode }: { onSwitchMode: () => void }) {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [working, setWorking] = useState<boolean>(false);

  async function signIn() {
    if (!email || !password) {
      window.alert('Enter email and password');
      return;
    }
    setWorking(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setWorking(false);
    if (error) window.alert(`Sign in failed: ${error.message}`);
  }

  return (
    <div className="flex flex-col gap-3">
      <img
        src="/servota-logo.png"
        alt="Servota"
        className="w-[220px] h-auto self-center mb-3"
        onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')}
      />
      <div className="text-[16px] text-center mb-2">Sign in</div>

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!working) void signIn();
        }}
      >
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
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.currentTarget.value)}
          className="w-full box-border border border-[#d1d5db] rounded-[12px] p-3 bg-white"
        />

        {working ? (
          <button
            type="button"
            disabled
            className="w-full rounded-[12px] py-3 font-extrabold text-white bg-[#111] opacity-80"
          >
            Signing in…
          </button>
        ) : (
          <>
            <button
              type="submit"
              className="w-full rounded-[12px] py-3 font-extrabold text-white bg-[#111]"
            >
              Sign in
            </button>

            <button
              type="button"
              onClick={onSwitchMode}
              className="w-full rounded-[12px] py-3 font-extrabold text-[#111] bg-[#eef1f5]"
            >
              Create an account
            </button>
          </>
        )}
      </form>
    </div>
  );
}

export default SignInView;
