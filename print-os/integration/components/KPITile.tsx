// =====================================================================
// PRINT OS — KPI Tile Component
// =====================================================================

import React from 'react';

type Variant = 'default' | 'success' | 'warning' | 'danger' | 'info';

export function KPITile({
  label,
  value,
  unit = '',
  variant = 'default',
  change,
  icon,
  loading,
}: {
  label: string;
  value: number | string;
  unit?: string;
  variant?: Variant;
  change?: { value: number; positive: boolean };
  icon?: string;
  loading?: boolean;
}) {
  const variantColors: Record<Variant, string> = {
    default: 'border-slate-200 bg-white',
    success: 'border-emerald-200 bg-emerald-50',
    warning: 'border-amber-200 bg-amber-50',
    danger: 'border-rose-200 bg-rose-50',
    info: 'border-sky-200 bg-sky-50',
  };

  const valueColor: Record<Variant, string> = {
    default: 'text-slate-900',
    success: 'text-emerald-700',
    warning: 'text-amber-700',
    danger: 'text-rose-700',
    info: 'text-sky-700',
  };

  return (
    <div className={`rounded-xl border-2 p-4 ${variantColors[variant]} transition-all`}>
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</span>
        {icon && <span className="text-lg">{icon}</span>}
      </div>
      {loading ? (
        <div className="h-9 bg-slate-200 rounded animate-pulse" />
      ) : (
        <div className="flex items-baseline gap-1">
          <span className={`text-3xl font-bold ${valueColor[variant]}`}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </span>
          {unit && <span className="text-sm text-slate-500">{unit}</span>}
        </div>
      )}
      {change && (
        <div className={`text-xs mt-1 ${change.positive ? 'text-emerald-600' : 'text-rose-600'}`}>
          {change.positive ? '↑' : '↓'} {Math.abs(change.value)}%
        </div>
      )}
    </div>
  );
}

export function DashboardGrid({ dashboard, loading }: { dashboard: any; loading?: boolean }) {
  if (!dashboard) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-24 bg-slate-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* TODAY */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">📅 Hari Ini</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KPITile label="Order Baru" value={dashboard.today.new_orders} icon="📦" loading={loading} />
          <KPITile
            label="Revenue"
            value={`RM ${dashboard.today.revenue.toLocaleString()}`}
            variant="success"
            icon="💰"
            loading={loading}
          />
          <KPITile label="Pending Artwork" value={dashboard.today.pending_artwork} variant="warning" icon="🎨" loading={loading} />
          <KPITile label="In Production" value={dashboard.today.in_production} variant="info" icon="🏭" loading={loading} />
          <KPITile label="Awaiting Delivery" value={dashboard.today.awaiting_delivery} variant="info" icon="🚚" loading={loading} />
        </div>
      </div>

      {/* MONTH */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">📊 Bulan Ini</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KPITile
            label="Revenue"
            value={`RM ${dashboard.month.total_revenue.toLocaleString()}`}
            variant="success"
            icon="💵"
            loading={loading}
          />
          <KPITile
            label="Profit"
            value={`RM ${dashboard.month.total_profit.toLocaleString()}`}
            variant="success"
            icon="📈"
            loading={loading}
          />
          <KPITile
            label="Margin"
            value={dashboard.month.margin_percent}
            unit="%"
            variant="info"
            icon="📐"
            loading={loading}
          />
          <KPITile
            label="Completion Rate"
            value={dashboard.month.completion_rate}
            unit="%"
            variant="default"
            icon="✅"
            loading={loading}
          />
        </div>
      </div>

      {/* OUTSTANDING & PRODUCTION */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">💳 Outstanding</h3>
          <div className="grid grid-cols-2 gap-3">
            <KPITile
              label="Total"
              value={`RM ${dashboard.outstanding.total.toLocaleString()}`}
              variant="warning"
              loading={loading}
            />
            <KPITile
              label="Overdue"
              value={`RM ${dashboard.outstanding.overdue.toLocaleString()}`}
              variant="danger"
              loading={loading}
            />
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-3">🏭 Production</h3>
          <div className="grid grid-cols-3 gap-3">
            <KPITile label="Queue" value={dashboard.production.queue} variant="info" loading={loading} />
            <KPITile label="Overdue" value={dashboard.production.overdue} variant="danger" loading={loading} />
            <KPITile label="QC Pending" value={dashboard.production.qc_pending} variant="warning" loading={loading} />
          </div>
        </div>
      </div>

      {/* 5 KPI */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">🎯 5 Core KPI</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KPITile
            label="Transaction Capture"
            value={dashboard.kpi.transaction_capture}
            unit="%"
            variant={dashboard.kpi.transaction_capture >= 95 ? 'success' : 'warning'}
          />
          <KPITile
            label="Order Coverage"
            value={dashboard.kpi.order_coverage}
            unit="%"
            variant="success"
          />
          <KPITile
            label="Workflow Completion"
            value={dashboard.kpi.workflow_completion}
            unit="%"
            variant={dashboard.kpi.workflow_completion >= 80 ? 'success' : 'warning'}
          />
          <KPITile
            label="Owner Dependency"
            value={dashboard.kpi.owner_dependency}
            unit="%"
            variant={dashboard.kpi.owner_dependency <= 30 ? 'success' : 'warning'}
          />
          <KPITile
            label="Profit Visibility"
            value={dashboard.kpi.profit_visibility}
            unit="%"
            variant={dashboard.kpi.profit_visibility >= 80 ? 'success' : 'warning'}
          />
        </div>
      </div>
    </div>
  );
}
