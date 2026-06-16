// =====================================================================
// PRINT OS — Sales Order Card & List
// =====================================================================

import React, { useState } from 'react';
import { useSalesOrders, useSalesOrderActions } from '../hooks/useSalesOrders';
import type { SalesOrder, SOStatus } from '../types/domain';

const STATUS_COLORS: Record<SOStatus, string> = {
  pending_artwork: 'bg-slate-100 text-slate-700',
  design_in_progress: 'bg-purple-100 text-purple-700',
  approval_pending: 'bg-amber-100 text-amber-700',
  artwork_approved: 'bg-emerald-100 text-emerald-700',
  in_production: 'bg-sky-100 text-sky-700',
  qc: 'bg-indigo-100 text-indigo-700',
  packing: 'bg-cyan-100 text-cyan-700',
  ready: 'bg-green-100 text-green-700',
  out_for_delivery: 'bg-blue-100 text-blue-700',
  delivered: 'bg-teal-100 text-teal-700',
  completed: 'bg-emerald-200 text-emerald-900',
  cancelled: 'bg-rose-100 text-rose-700',
};

const STATUS_LABELS: Record<SOStatus, string> = {
  pending_artwork: 'Pending Artwork',
  design_in_progress: 'In Design',
  approval_pending: 'Awaiting Approval',
  artwork_approved: 'Artwork Approved',
  in_production: 'In Production',
  qc: 'QC',
  packing: 'Packing',
  ready: 'Ready',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const STATUS_NEXT: Record<SOStatus, SOStatus[]> = {
  pending_artwork: ['design_in_progress', 'cancelled'],
  design_in_progress: ['approval_pending', 'cancelled'],
  approval_pending: ['artwork_approved', 'design_in_progress', 'cancelled'],
  artwork_approved: ['in_production'],
  in_production: ['qc'],
  qc: ['packing', 'in_production'],
  packing: ['ready'],
  ready: ['out_for_delivery', 'delivered'],
  out_for_delivery: ['delivered'],
  delivered: ['completed'],
  completed: [],
  cancelled: [],
};

export function SOCard({ so, onAction }: { so: SalesOrder; onAction?: () => void }) {
  const { transition } = useSalesOrderActions();
  const [loading, setLoading] = useState(false);

  const nextStates = STATUS_NEXT[so.status] || [];

  const handleTransition = async (toStatus: SOStatus) => {
    setLoading(true);
    try {
      await transition(so.id, toStatus);
      onAction?.();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-2">
            <div className="font-semibold text-slate-900">{so.so_number}</div>
            {so.rush_order && <span className="text-xs bg-rose-500 text-white px-2 py-0.5 rounded-full font-medium">RUSH</span>}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {so.due_date && `Due: ${new Date(so.due_date).toLocaleDateString('ms-MY')}`}
            {so.production_type && ` • ${so.production_type}`}
            {so.delivery_type && ` • ${so.delivery_type === 'self_collect' ? 'Self Collect' : 'Courier'}`}
          </div>
        </div>
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_COLORS[so.status]}`}>
          {STATUS_LABELS[so.status]}
        </span>
      </div>

      <div className="my-3 space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-500">Total:</span>
          <span className="font-bold text-indigo-600">RM {so.total.toFixed(2)}</span>
        </div>
        {so.paid_amount > 0 && (
          <>
            <div className="flex justify-between">
              <span className="text-slate-500">Paid:</span>
              <span className="text-emerald-600 font-medium">RM {so.paid_amount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Outstanding:</span>
              <span className="text-amber-600 font-medium">RM {so.outstanding_amount.toFixed(2)}</span>
            </div>
          </>
        )}
      </div>

      {nextStates.length > 0 && (
        <div className="flex gap-2 mt-3 flex-wrap">
          {nextStates.map((s) => (
            <button
              key={s}
              onClick={() => handleTransition(s)}
              disabled={loading}
              className="text-xs font-medium px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors disabled:opacity-50"
            >
              → {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SalesOrderList() {
  const { data, loading, refresh } = useSalesOrders({ page_size: 50 });

  if (loading) {
    return <div className="text-center text-slate-500 py-8">Loading sales orders...</div>;
  }

  if (data.length === 0) {
    return (
      <div className="text-center text-slate-400 py-8">
        Tiada sales order.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((so) => (
        <SOCard key={so.id} so={so} onAction={refresh} />
      ))}
    </div>
  );
}

// Alias for consistency
export { SOCard as SalesOrderCard };
