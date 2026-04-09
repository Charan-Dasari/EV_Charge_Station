import React, { useState } from 'react';
import { authService } from '../../services/auth';
import { useGoogleLogin } from '@react-oauth/google';
import './AuthModal.css';

export default function AuthModal({ onClose, onAuth, subtitle }) {
  const [mode, setMode] = useState('login');  // 'login' | 'register' | 'forgot' | 'reset-password'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Forgot / Reset state
  const [resetEmail, setResetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    let result;
    if (mode === 'login') {
      result = await authService.login(email, password);
    } else {
      result = await authService.register(name, email, password);
    }

    setLoading(false);

    if (result.success) {
      onAuth(result.user);
      onClose();
    } else {
      setError(result.error);
    }
  };

  const handleGoogleSuccess = async (tokenResponse) => {
    if (!tokenResponse.access_token) {
      setError('Google Login Failed: Missing token.');
      return;
    }

    setLoading(true);
    try {
      const response = await authService.googleLogin(tokenResponse.access_token);
      if (response.success) {
        onAuth(response.user);
        onClose();
      } else {
        setError(response.error || 'Failed to authenticate via Google.');
      }
    } catch (err) {
      setError('Google Login process failed.');
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = useGoogleLogin({
    onSuccess: handleGoogleSuccess,
    onError: () => setError('Google Login Failed.'),
  });

  const handleCheckEmail = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await authService.checkEmailForReset(resetEmail);
    setLoading(false);
    if (result.success) {
      setMode('reset-password');
    } else {
      setError(result.error);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    const result = await authService.resetPassword(resetEmail, newPassword);
    setLoading(false);
    if (result.success) {
      setResetSuccess(true);
      setTimeout(() => {
        setResetSuccess(false);
        setResetEmail('');
        setNewPassword('');
        setConfirmPassword('');
        setMode('login');
      }, 2000);
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>

        {/* Close */}
        <button className="auth-close" onClick={onClose}>✕</button>

        {/* Logo */}
        <div className="auth-logo">
          <img
            src='/logo-nobg.png'
            alt="Charge Saathi"
            style={{ width: '45px', height: '45px', borderRadius: '12px', objectFit: 'cover', boxShadow: '0 2px 8px rgba(200, 101, 42, 0.25)' }}
          />
          <span className="auth-logo-text">Charge<em>Saathi</em></span>
        </div>

        {/* Optional context hint */}
        {subtitle && (
          <div className="auth-subtitle">
            {subtitle}
          </div>
        )}

        {/* Tab switcher — only for login/register */}
        {(mode === 'login' || mode === 'register') && (
          <div className="auth-tabs">
            <button
              className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
              onClick={() => { setMode('login'); setError(''); }}
            >
              Sign In
            </button>
            <button
              className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
              onClick={() => { setMode('register'); setError(''); }}
            >
              Create Account
            </button>
          </div>
        )}

        {/* Main login/register form — hidden in forgot/reset modes */}
        {(mode === 'login' || mode === 'register') && (
          <form className="auth-form" onSubmit={handleSubmit}>

            {mode === 'register' && (
              <div className="auth-field">
                <label>Full Name</label>
                <input
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
              </div>
            )}

            <div className="auth-field">
              <label>Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            <div className="auth-field">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label style={{ margin: 0 }}>Password</label>
                {mode === 'login' && (
                  <span
                    style={{ fontSize: '12px', color: '#16a34a', cursor: 'pointer', fontWeight: 600 }}
                    onClick={() => { setResetEmail(''); setError(''); setMode('forgot'); }}
                  >
                    Forgot Password?
                  </span>
                )}
              </div>
              <div className="auth-pass-wrap">
                <input
                  type={showPass ? 'text' : 'password'}
                  placeholder="Min. 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  className="auth-pass-toggle"
                  onClick={() => setShowPass(!showPass)}
                >
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            {error && <div className="auth-error">⚠️ {error}</div>}

            <button className="auth-submit" type="submit" disabled={loading}>
              {loading ? 'Please wait…' : mode === 'login' ? '⚡ Sign In' : '🚀 Create Account'}
            </button>

          </form>
        )}

        {(mode === 'login' || mode === 'register') && (
          <p className="auth-switch">
            {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
            <button
              className="auth-switch-btn"
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
            >
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        )}

        {/* ── FORGOT PASSWORD ── */}
        {mode === 'forgot' && (
          <form className="auth-form" onSubmit={handleCheckEmail}>
            <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px', textAlign: 'center' }}>
              Enter your registered email to continue.
            </p>
            <div className="auth-field">
              <label>Email</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
            {error && <div className="auth-error">⚠️ {error}</div>}
            <button className="auth-submit" type="submit" disabled={loading}>
              {loading ? 'Checking…' : 'Continue →'}
            </button>
            <button
              type="button"
              className="auth-switch-btn"
              style={{ display: 'block', margin: '12px auto 0', fontSize: '13px' }}
              onClick={() => { setError(''); setMode('login'); }}
            >
              ← Back to Sign In
            </button>
          </form>
        )}

        {/* ── RESET PASSWORD ── */}
        {mode === 'reset-password' && (
          <form className="auth-form" onSubmit={handleResetPassword}>
            {resetSuccess ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>✅</div>
                <div style={{ fontWeight: 700, color: '#16a34a', fontSize: '15px' }}>Password updated!</div>
                <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '6px' }}>Redirecting to Sign In…</div>
              </div>
            ) : (
              <>
                <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '16px', textAlign: 'center' }}>
                  Set a new password for <strong>{resetEmail}</strong>
                </p>
                <div className="auth-field">
                  <label>New Password</label>
                  <div className="auth-pass-wrap">
                    <input
                      type={showNewPass ? 'text' : 'password'}
                      placeholder="Min. 6 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                    <button type="button" className="auth-pass-toggle" onClick={() => setShowNewPass(!showNewPass)}>
                      {showNewPass ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>
                <div className="auth-field">
                  <label>Confirm Password</label>
                  <div className="auth-pass-wrap">
                    <input
                      type={showNewPass ? 'text' : 'password'}
                      placeholder="Re-enter new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                  </div>
                </div>
                {error && <div className="auth-error">⚠️ {error}</div>}
                <button className="auth-submit" type="submit" disabled={loading}>
                  {loading ? 'Updating…' : '🔒 Update Password'}
                </button>
                <button
                  type="button"
                  className="auth-switch-btn"
                  style={{ display: 'block', margin: '12px auto 0', fontSize: '13px' }}
                  onClick={() => { setError(''); setMode('forgot'); }}
                >
                  ← Back
                </button>
              </>
            )}
          </form>
        )}

        {/* Social Login Options — only on login/register */}
        {(mode === 'login' || mode === 'register') && (
          <>
            <div className="auth-social-divider">
              <span>or continue with</span>
            </div>
            <div className="auth-social-buttons">
              <button type="button" className="auth-social-btn" onClick={() => loginWithGoogle()}>
                <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Continue with Google
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
