import { useState } from 'react';
import { Boxes, Lock, Mail, KeyRound, ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient.js';

export default function AuthCard() {
  const [mode, setMode] = useState('sign-in'); // 'sign-in' | 'reset-request' | 'reset-otp'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  const resetFeedback = () => {
    setError(null);
    setMessage(null);
  };

  async function handleSignIn(e) {
    e.preventDefault();
    resetFeedback();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError(error.message);
  }

  async function handleRequestOtp(e) {
    e.preventDefault();
    resetFeedback();
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email });
    setLoading(false);
    if (error) setError(error.message);
    else {
      setMessage('A 6-digit code has been sent to your email.');
      setMode('reset-otp');
    }
  }

  async function handleVerifyOtpAndReset(e) {
    e.preventDefault();
    resetFeedback();
    setLoading(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'email',
    });
    if (verifyError) {
      setLoading(false);
      setError(verifyError.message);
      return;
    }
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    setLoading(false);
    if (updateError) setError(updateError.message);
    else {
      setMessage('Password updated. You are now signed in.');
      setMode('sign-in');
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-4">
      <div className="w-full max-w-md glass-panel p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2.5 rounded-xl bg-indigo-soft border border-indigo-accent/40">
            <Boxes className="w-6 h-6 text-indigo-accent" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">StockSense</h1>
            <p className="text-xs text-slate-500">Inventory Management System</p>
          </div>
        </div>

        {mode === 'sign-in' && (
          <form onSubmit={handleSignIn} className="space-y-4">
            <h2 className="text-white font-semibold text-xl mb-1">Welcome back</h2>
            <p className="text-sm text-slate-500 mb-4">Sign in to your warehouse workspace.</p>

            <Field icon={Mail} type="email" placeholder="you@company.com" value={email} onChange={setEmail} />
            <Field icon={Lock} type="password" placeholder="Password" value={password} onChange={setPassword} />

            {error && <Alert kind="error" text={error} />}
            {message && <Alert kind="success" text={message} />}

            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              Sign In
            </button>

            <button
              type="button"
              onClick={() => { resetFeedback(); setMode('reset-request'); }}
              className="text-xs text-indigo-accent hover:underline w-full text-center block"
            >
              Forgot password? Use a one-time code
            </button>
          </form>
        )}

        {mode === 'reset-request' && (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <h2 className="text-white font-semibold text-xl mb-1">Reset with OTP</h2>
            <p className="text-sm text-slate-500 mb-4">
              We'll email a 6-digit one-time code to verify it's you.
            </p>

            <Field icon={Mail} type="email" placeholder="you@company.com" value={email} onChange={setEmail} />

            {error && <Alert kind="error" text={error} />}

            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              Send Code
            </button>

            <button
              type="button"
              onClick={() => { resetFeedback(); setMode('sign-in'); }}
              className="text-xs text-slate-500 hover:text-slate-300 w-full text-center block"
            >
              Back to sign in
            </button>
          </form>
        )}

        {mode === 'reset-otp' && (
          <form onSubmit={handleVerifyOtpAndReset} className="space-y-4">
            <h2 className="text-white font-semibold text-xl mb-1">Enter your code</h2>
            <p className="text-sm text-slate-500 mb-4">
              Check <span className="text-slate-300">{email}</span> for the 6-digit code, then set a new password.
            </p>

            <Field icon={KeyRound} type="text" placeholder="6-digit code" value={otp} onChange={setOtp} />
            <Field icon={Lock} type="password" placeholder="New password" value={newPassword} onChange={setNewPassword} />

            {error && <Alert kind="error" text={error} />}
            {message && <Alert kind="success" text={message} />}

            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              Verify &amp; Update Password
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({ icon: Icon, type, placeholder, value, onChange }) {
  return (
    <div className="relative">
      <Icon className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
      <input
        type={type}
        required
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-field pl-9"
      />
    </div>
  );
}

function Alert({ kind, text }) {
  const isError = kind === 'error';
  return (
    <div
      className={`text-xs px-3 py-2 rounded-lg border ${
        isError
          ? 'bg-crimson-soft text-crimson-bad border-crimson-bad/30'
          : 'bg-emerald-soft text-emerald-pill border-emerald-pill/30'
      }`}
    >
      {text}
    </div>
  );
}
