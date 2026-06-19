import React, { useState } from 'react';
import { useAuth } from '../context/PrintOSContext';
import { LogIn, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';

const roles = [
  { role: 'Owner', email: 'owner@srcreative.my', desc: 'Full access · sees cost & profit', icon: '👑', color: '#C4956A' },
  { role: 'Management', email: 'management@srcreative.my', desc: 'Operations · sees cost & margin', icon: '📊', color: '#7A8B99' },
  { role: 'Sales Executive', email: 'sales@srcreative.my', desc: 'CRM + Quotation · cost hidden', icon: '💼', color: '#8B7D72' },
  { role: 'Designer', email: 'designer@srcreative.my', desc: 'Artwork only · no finance', icon: '🎨', color: '#C49A8B' },
  { role: 'Production', email: 'production@srcreative.my', desc: 'Job queue + QC · no cost', icon: '🏭', color: '#9AAF8B' },
  { role: 'Finance', email: 'finance@srcreative.my', desc: 'Invoice + Payment + Reports', icon: '💰', color: '#7A9E7A' },
  { role: 'Customer', email: 'customer@example.com', desc: 'Portal · own orders only', icon: '🛒', color: '#8B8B8B' },
];

export function LoginPage() {
  const { signIn, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('owner@srcreative.my');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCredentials, setShowCredentials] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [activeRole, setActiveRole] = useState<string | null>(null);

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
    setActiveRole(loginEmail);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedEmail(label);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  if (authLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8F4F0' }}>
        <div style={{ color: '#8B7D72', fontFamily: 'serif', fontSize: '1.125rem' }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #F8F4F0 0%, #EDE6DE 50%, #E8E0D6 100%)',
      padding: '16px',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            background: 'linear-gradient(135deg, #C4956A, #A67B54)',
            borderRadius: '16px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
            boxShadow: '0 4px 20px rgba(196, 149, 106, 0.25)',
          }}>
            <span style={{ color: 'white', fontSize: '28px', fontWeight: 700, fontFamily: "'DM Serif Display', Georgia, serif", fontStyle: 'italic' }}>P</span>
          </div>
          <h1 style={{
            fontSize: '28px',
            fontWeight: 600,
            color: '#2D2A24',
            fontFamily: "'DM Serif Display', Georgia, serif",
            letterSpacing: '-0.02em',
            margin: 0,
          }}>PRINT OS</h1>
          <p style={{ color: '#8B7D72', fontSize: '13px', marginTop: '4px' }}>SR Creative Sdn Bhd</p>
        </div>

        {/* Login Card */}
        <div style={{
          background: 'white',
          borderRadius: '20px',
          border: '1px solid #E8E0D6',
          boxShadow: '0 2px 16px rgba(45, 42, 36, 0.06)',
          padding: '28px',
        }}>
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{
              fontSize: '20px',
              fontWeight: 600,
              color: '#2D2A24',
              fontFamily: "'DM Serif Display', Georgia, serif",
              margin: '0 0 4px',
            }}>Welcome back</h2>
            <p style={{ fontSize: '13px', color: '#8B7D72', margin: 0 }}>Enter your staff credentials</p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#8B7D72', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</label>
              <div style={{ position: 'relative' }}>
                <svg style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#C4B5A0' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 36px',
                    border: '1.5px solid #E8E0D6',
                    borderRadius: '12px',
                    fontSize: '14px',
                    color: '#2D2A24',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = '#C4956A'; e.target.style.boxShadow = '0 0 0 3px rgba(196,149,106,0.12)'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#E8E0D6'; e.target.style.boxShadow = 'none'; }}
                  placeholder="you@company.com"
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#8B7D72', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <svg style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', color: '#C4B5A0' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px 10px 36px',
                    border: '1.5px solid #E8E0D6',
                    borderRadius: '12px',
                    fontSize: '14px',
                    color: '#2D2A24',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                  }}
                  onFocus={(e) => { e.target.style.borderColor = '#C4956A'; e.target.style.boxShadow = '0 0 0 3px rgba(196,149,106,0.12)'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#E8E0D6'; e.target.style.boxShadow = 'none'; }}
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div style={{ padding: '12px', background: '#FDF0EE', border: '1px solid #E8C8C0', borderRadius: '12px', color: '#8B4A3E', fontSize: '13px' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '11px',
                background: loading ? '#C4B5A0' : 'linear-gradient(135deg, #C4956A, #A67B54)',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                fontSize: '14px',
                fontWeight: 500,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.25s',
                boxShadow: '0 4px 16px rgba(196, 149, 106, 0.25)',
              }}
              onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(196, 149, 106, 0.35)'; } }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(196, 149, 106, 0.25)'; }}
            >
              <LogIn size={16} />
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        {/* Demo Credentials */}
        <div style={{
          marginTop: '12px',
          background: 'white',
          borderRadius: '20px',
          border: '1px solid #E8E0D6',
          boxShadow: '0 2px 16px rgba(45, 42, 36, 0.06)',
          overflow: 'hidden',
        }}>
          <button
            onClick={() => setShowCredentials(!showCredentials)}
            style={{
              width: '100%',
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#F8F4F0'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: '#2D2A24' }}>Demo Credentials</div>
              <div style={{ fontSize: '11px', color: '#8B7D72', marginTop: '1px' }}>Tap any role to quick-login</div>
            </div>
            {showCredentials ? <ChevronUp size={16} color="#C4B5A0" /> : <ChevronDown size={16} color="#C4B5A0" />}
          </button>

          {showCredentials && (
            <div style={{ borderTop: '1px solid #E8E0D6', padding: '8px 12px 12px', maxHeight: '340px', overflowY: 'auto' }}>
              {roles.map((cred) => (
                <button
                  key={cred.email}
                  onClick={() => quickLogin(cred.email)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px',
                    border: activeRole === cred.email ? '1.5px solid #C4956A' : '1.5px solid transparent',
                    borderRadius: '14px',
                    background: activeRole === cred.email ? '#F8F4F0' : 'transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.2s',
                    marginBottom: '4px',
                  }}
                  onMouseEnter={(e) => { if (activeRole !== cred.email) { e.currentTarget.style.background = '#F8F4F0'; } }}
                  onMouseLeave={(e) => { if (activeRole !== cred.email) { e.currentTarget.style.background = 'transparent'; } }}
                >
                  <span style={{ fontSize: '22px' }}>{cred.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#2D2A24' }}>{cred.role}</div>
                    <div style={{ fontSize: '11px', color: '#8B7D72', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cred.email}</div>
                    <div style={{ fontSize: '10px', color: '#C4B5A0' }}>{cred.desc}</div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(cred.email, cred.email);
                    }}
                    style={{
                      padding: '6px',
                      border: 'none',
                      background: 'transparent',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      opacity: 0,
                      transition: 'opacity 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    className="copy-btn"
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#E8E0D6'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    {copiedEmail === cred.email ? <Check size={13} color="#5A9E7A" /> : <Copy size={13} color="#8B7D72" />}
                  </button>
                </button>
              ))}
              <div style={{ padding: '10px 4px 4px', borderTop: '1px solid #F0EBE5', marginTop: '2px', fontSize: '11px', color: '#8B7D72', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>💡</span>
                <span>Default password:</span>
                <code style={{ padding: '2px 8px', background: '#F8F4F0', borderRadius: '6px', fontSize: '11px', color: '#2D2A24', fontFamily: 'monospace' }}>PrintOS2026!</code>
              </div>
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: '10px', color: '#C4B5A0', marginTop: '20px', letterSpacing: '0.05em' }}>
          PRINT OS V1.0 — Multi-tenant SaaS for Printing Industry
        </p>
      </div>
    </div>
  );
}
