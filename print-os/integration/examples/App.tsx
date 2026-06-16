// =====================================================================
// PRINT OS — Complete Example App
// Drop-in code untuk Replit — copy paste dalam App.tsx
// =====================================================================

import React, { useState } from 'react';
import { PrintOSProvider, usePrintOS, LoginPage } from './index';
import { DashboardGrid } from './components/KPITile';
import { QuotationList, QuotationForm } from './components/QuotationForm';
import { SalesOrderList } from './components/SalesOrderCard';
import { useDashboard, useRepeatPredictions } from './hooks/useDashboard';

type Tab = 'dashboard' | 'quotations' | 'sales_orders' | 'predictions';

function PrintOSApp() {
  const { user, company, profile, signOut, loading } = usePrintOS();
  const [tab, setTab] = useState<Tab>('dashboard');
  const [showQuotationForm, setShowQuotationForm] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-500">Loading PRINT OS...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">
                P
              </div>
              <div>
                <div className="font-semibold text-slate-900">{company?.name || 'PRINT OS'}</div>
                <div className="text-xs text-slate-500">{profile?.full_name || user.email}</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                {profile ? 'Owner' : 'Loading...'}
              </span>
              <button
                onClick={signOut}
                className="text-sm text-slate-600 hover:text-slate-900"
              >
                Sign out
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 -mb-px">
            {([
              { key: 'dashboard', label: 'Dashboard', icon: '📊' },
              { key: 'quotations', label: 'Quotations', icon: '📝' },
              { key: 'sales_orders', label: 'Sales Orders', icon: '📦' },
              { key: 'predictions', label: 'Repeat Orders', icon: '🔁' },
            ] as { key: Tab; label: string; icon: string }[]).map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.key
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="mr-1.5">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {tab === 'dashboard' && <DashboardTab />}
        {tab === 'quotations' && (
          <QuotationsTab
            showForm={showQuotationForm}
            setShowForm={setShowQuotationForm}
          />
        )}
        {tab === 'sales_orders' && <SalesOrdersTab />}
        {tab === 'predictions' && <PredictionsTab />}
      </main>
    </div>
  );
}

function DashboardTab() {
  const { dashboard, loading } = useDashboard();
  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-6">Dashboard</h2>
      <DashboardGrid dashboard={dashboard} loading={loading} />
    </div>
  );
}

function QuotationsTab({ showForm, setShowForm }: { showForm: boolean; setShowForm: (b: boolean) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Quotations</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          {showForm ? '← Back' : '+ New Quotation'}
        </button>
      </div>

      {showForm ? (
        <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-2xl">
          <h3 className="text-lg font-semibold mb-4">New Quotation</h3>
          <QuotationForm
            onSuccess={() => setShowForm(false)}
            onCancel={() => setShowForm(false)}
          />
        </div>
      ) : (
        <QuotationList />
      )}
    </div>
  );
}

function SalesOrdersTab() {
  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-6">Sales Orders</h2>
      <SalesOrderList />
    </div>
  );
}

function PredictionsTab() {
  const { data, loading } = useRepeatPredictions();

  return (
    <div>
      <h2 className="text-2xl font-bold text-slate-900 mb-2">Repeat Order Predictions</h2>
      <p className="text-sm text-slate-500 mb-6">Pelanggan yang mungkin akan order lagi</p>

      {loading ? (
        <div className="text-center text-slate-500 py-8">Loading predictions...</div>
      ) : data.length === 0 ? (
        <div className="text-center text-slate-400 py-8">Tiada prediction. Perlu lebih banyak data order.</div>
      ) : (
        <div className="grid gap-3">
          {data.map((p) => {
            const urgencyColors: Record<string, string> = {
              high: 'border-rose-300 bg-rose-50',
              medium: 'border-amber-300 bg-amber-50',
              low: 'border-slate-200 bg-white',
            };
            return (
              <div
                key={p.customer_id}
                className={`p-4 rounded-xl border-2 ${urgencyColors[p.urgency]}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-900">{p.customer_name}</div>
                    <div className="text-sm text-slate-600">
                      Last order: {p.last_product} ({p.days_since_last} hari lalu)
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500">Predicted in</div>
                    <div className="text-2xl font-bold text-slate-900">
                      {p.predicted_due_in <= 0 ? '🔔 NOW' : `${p.predicted_due_in}d`}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Wrap everything with Provider
export default function App() {
  return (
    <PrintOSProvider>
      <PrintOSApp />
    </PrintOSProvider>
  );
}
