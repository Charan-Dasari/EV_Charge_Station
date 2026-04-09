// ============================================================
// AUTH SERVICE
// Connects to ASP.NET Core Backend (MongoDB)
// ============================================================

const STORAGE_KEY = 'ev_auth_user';
const TOKEN_KEY = 'ev_auth_token';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5150';

export const authService = {

  /** Returns the current user or null */
  getUser() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    } catch {
      return null;
    }
  },

  /** Returns the JWT token or null */
  getToken() {
    return localStorage.getItem(TOKEN_KEY) || null;
  },

  /** Login with email + password */
  async login(email, password) {
    if (!email || !password) {
      return { success: false, error: 'Email and password are required.' };
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        return { success: false, error: `Server error (${response.status}). Please try again later.` };
      }

      if (!response.ok) {
        return { success: false, error: data.message || data.title || 'Login failed.' };
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(data.user));
      localStorage.setItem(TOKEN_KEY, data.token);
      window.dispatchEvent(new Event('storage'));

      return { success: true, user: data.user };
    } catch (err) {
      console.error('Login fetch error:', err);
      return { success: false, error: 'Network error connecting to the server.' };
    }
  },

  googleLogin: async (credential) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential })
      });

      let data;
      try {
        data = await response.json();
      } catch (parseError) {
        return { success: false, error: `Server error (${response.status}). Please try again later.` };
      }

      if (!response.ok) {
        return { success: false, error: data.message || data.title || 'Google Login failed.' };
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(data.user));
      localStorage.setItem(TOKEN_KEY, data.token);
      window.dispatchEvent(new Event('storage'));

      return { success: true, user: data.user };
    } catch (err) {
      console.error('Google login fetch error:', err);
      return { success: false, error: 'Network error connecting to the server.' };
    }
  },

  /** Register */
  async register(name, email, password) {
    if (!name || !email || !password) {
      return { success: false, error: 'All fields are required.' };
    }
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
      });

      const data = await response.json();

      if (!response.ok) {
        return { success: false, error: data.message || 'Registration failed.' };
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(data.user));
      localStorage.setItem(TOKEN_KEY, data.token);
      
      // Trigger event for listeners
      window.dispatchEvent(new Event('storage'));

      return { success: true, user: data.user };
    } catch (err) {
      console.error('Register error:', err);
      return { success: false, error: 'Network error connecting to the server.' };
    }
  },

  /** Logout */
  logout() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TOKEN_KEY);
    window.dispatchEvent(new Event('storage'));
    return { success: true };
  },

  /** Subscribe to auth changes (polls localStorage — fine for demo) */
  onAuthChange(callback) {
    callback(this.getUser());   // immediate call
    const handler = () => callback(this.getUser());
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  },

  /** Check if email exists and is a manual (non-Google) account */
  async checkEmailForReset(email) {
    if (!email) return { success: false, error: 'Email is required.' };
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/check-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await response.json();
      if (!response.ok) return { success: false, error: data.message || 'Email verification failed.' };
      return { success: true };
    } catch (err) {
      return { success: false, error: 'Network error connecting to the server.' };
    }
  },

  /** Reset password for a verified manual account */
  async resetPassword(email, newPassword) {
    if (!email || !newPassword) return { success: false, error: 'All fields are required.' };
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, newPassword })
      });
      const data = await response.json();
      if (!response.ok) return { success: false, error: data.message || 'Password reset failed.' };
      return { success: true };
    } catch (err) {
      return { success: false, error: 'Network error connecting to the server.' };
    }
  },
};
