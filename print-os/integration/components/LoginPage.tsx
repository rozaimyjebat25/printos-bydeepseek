// =====================================================================
// PRINT OS — Login Page (Updated dengan Demo Credentials)
// Drop-in untuk Replit App.tsx
// =====================================================================

import React, { useState } from 'react';
import { useAuth } from '../context/PrintOSContext';
import { LogIn, User, Lock, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';

export function LoginPage() {
  const { signIn, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('owner@srcreative.my');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCredentials, setShowCredentials] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signIn(email, password);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (loginEmail: string) => {
    setEmail(loginEmail);
    setPassword('PrintOS2026!');
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedEmail(label);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-500">Loading...</div>
      </div>
    );
  }

  // 6 MVP demo credentials
  const demoCredentials = [
    { role: 'Owner', email: 'owner@srcreative.my', desc: 'Full access · sees cost & profit', icon: '👑', color: 'amber' },
    { role: 'Management', email: 'management@srcreative.my', desc: 'All operations · sees cost & margin', icon: '📊', color: 'sky' },
    { role: 'Sales Executive', email: 'sales@srcreative.my', desc: 'CRM + Quotation · no cost visibility', icon: '💼', color: 'indigo' },
    { role: 'Designer', email: 'designer@srcreative.my', desc: 'Artwork only · no finance', icon: '🎨', color: 'pink' },
    { role: 'Production', email: 'production@srcreative.my', desc: 'Job queue + QC · no cost', icon: '🏭', color: 'emerald' },
    { role: 'Finance', email: 'finance@srcreative.my', desc: 'Invoice + Payment + Reports', icon: '💰', color: 'green' },
    { role: 'Customer', email: 'customer@example.com', desc: 'Portal · own orders only', icon: '🛒', color: 'slate' },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl text-white text-2xl font-bold mb-4 shadow-lg">
            P
          </div>
          <h1 className="text-3xl font-bold text-slate-900">PRINT OS</h1>
          <p className="text-slate-500 mt-1">SR Creative Sdn Bhd</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="mb-5">
            <h2 className="text-xl font-bold text-slate-900">Welcome back</h2>
            <p className="text-sm text-slate-500">Enter your staff credentials to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                  placeholder="you@company.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                'Signing in...'
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Sign In
                </>
              )}
            </button>
          </form>
        </div>

        {/* Demo Credentials Section */}
        <div className="mt-4 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <button
            onClick={() => setShowCredentials(!showCredentials)}
            className="w-full px-6 py-3 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
          >
            <div>
              <div className="text-sm font-semibold text-slate-900">View Demo Credentials</div>
              <div className="text-xs text-slate-500">Click any role to quick-login (password: PrintOS2026!)</div>
            </div>
            {showCredentials ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>

          {showCredentials && (
            <div className="border-t border-slate-200 p-3 space-y-1.5 max-h-96 overflow-y-auto">
              {demoCredentials.map((cred) => (
                <button
                  key={cred.email}
                  onClick={() => quickLogin(cred.email)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors text-left group"
                >
                  <div className="text-2xl">{cred.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-900">{cred.role}</div>
                    <div className="text-xs text-slate-500 truncate">{cred.email}</div>
                    <div className="text-xs text-slate-400">{cred.desc}</div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(cred.email, cred.email);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-slate-200 rounded transition-all"
                    title="Copy email"
                  >
                    {copiedEmail === cred.email ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                    )}
                  </button>
                </button>
              ))}
              <div className="pt-2 mt-2 border-t border-slate-100 text-xs text-slate-500 px-2">
                💡 Default password: <code className="px-1.5 py-0.5 bg-slate-100 rounded font-mono text-slate-700">PrintOS2026!</code>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          PRINT OS V1.0 · Multi-tenant SaaS for Printing Industry
        </p>
      </div>
    </div>
  );
}
