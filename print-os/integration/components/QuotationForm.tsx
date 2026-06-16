// =====================================================================
// PRINT OS — Quotation Form & Card
// =====================================================================

import React, { useState } from 'react';
import { useAuth } from '../context/PrintOSContext';
import { useCustomers } from '../hooks/useCustomers';
import { useQuotationActions, useQuotations } from '../hooks/useQuotations';
import type { Quotation, QuotationStatus } from '../types/domain';

const STATUS_COLORS: Record<QuotationStatus, string> = {
  draft: 'bg-slate-100 text-slate-700',
  sent: 'bg-sky-100 text-sky-700',
  approved: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-rose-100 text-rose-700',
  expired: 'bg-amber-100 text-amber-700',
  converted: 'bg-indigo-100 text-indigo-700',
};

const STATUS_NEXT: Record<QuotationStatus, QuotationStatus[]> = {
  draft: ['sent', 'rejected'],
  sent: ['approved', 'rejected'],
  approved: ['converted'],
  rejected: ['draft'],
  expired: ['draft'],
  converted: [],
};

export function QuotationCard({ quotation, onAction }: {
  quotation: Quotation;
  onAction?: () => void;
}) {
  const { transition } = useQuotationActions();
  const [loading, setLoading] = useState(false);

  const nextStates = STATUS_NEXT[quotation.status] || [];

  const handleTransition = async (toStatus: QuotationStatus) => {
    setLoading(true);
    try {
      await transition(quotation.id, toStatus);
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
          <div className="font-semibold text-slate-900">{quotation.quotation_no}</div>
          <div className="text-xs text-slate-500">
            {new Date(quotation.created_at).toLocaleDateString('ms-MY')}
          </div>
        </div>
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_COLORS[quotation.status]}`}>
          {quotation.status}
        </span>
      </div>

      <div className="my-3 space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-500">Subtotal:</span>
          <span className="font-medium">RM {quotation.subtotal.toFixed(2)}</span>
        </div>
        {quotation.tax_amount > 0 && (
          <div className="flex justify-between">
            <span className="text-slate-500">Tax:</span>
            <span className="font-medium">RM {quotation.tax_amount.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between pt-1 border-t border-slate-100">
          <span className="text-slate-700 font-medium">Total:</span>
          <span className="font-bold text-indigo-600">RM {quotation.total.toFixed(2)}</span>
        </div>
      </div>

      {nextStates.length > 0 && (
        <div className="flex gap-2 mt-3">
          {nextStates.map((s) => (
            <button
              key={s}
              onClick={() => handleTransition(s)}
              disabled={loading}
              className="flex-1 text-xs font-medium px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors disabled:opacity-50"
            >
              → {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function QuotationForm({ onSuccess, onCancel }: {
  onSuccess?: (q: Quotation) => void;
  onCancel?: () => void;
}) {
  const { data: customers } = useCustomers();
  const { create } = useQuotationActions();
  const [loading, setLoading] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [items, setItems] = useState<Array<{
    product_name: string;
    product_category: string;
    quantity: number;
    unit: string;
    unit_price: number;
  }>>([
    { product_name: '', product_category: 'banner', quantity: 1, unit: 'pcs', unit_price: 0 },
  ]);

  const addItem = () => {
    setItems([...items, { product_name: '', product_category: 'banner', quantity: 1, unit: 'pcs', unit_price: 0 }]);
  };

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, field: string, value: any) => {
    const updated = [...items];
    (updated[idx] as any)[field] = value;
    setItems(updated);
  };

  const total = items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) {
      alert('Sila pilih customer');
      return;
    }
    setLoading(true);
    try {
      const result = await create({
        customer_id: customerId,
        items: items.filter((i) => i.product_name && i.unit_price > 0),
      });
      onSuccess?.(result);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Customer</label>
        <select
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          required
          className="w-full px-3 py-2 border border-slate-300 rounded-lg"
        >
          <option value="">-- Pilih Customer --</option>
          {customers.data.map((c) => (
            <option key={c.id} value={c.id}>{c.name} {c.company_name ? `(${c.company_name})` : ''}</option>
          ))}
        </select>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-slate-700">Items</label>
          <button type="button" onClick={addItem} className="text-xs text-indigo-600 hover:underline">
            + Tambah Item
          </button>
        </div>

        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="grid grid-cols-12 gap-2 items-center p-2 bg-slate-50 rounded-lg">
              <input
                type="text"
                placeholder="Product name"
                value={item.product_name}
                onChange={(e) => updateItem(idx, 'product_name', e.target.value)}
                className="col-span-4 px-2 py-1.5 text-sm border border-slate-300 rounded"
              />
              <select
                value={item.product_category}
                onChange={(e) => updateItem(idx, 'product_category', e.target.value)}
                className="col-span-2 px-2 py-1.5 text-sm border border-slate-300 rounded"
              >
                <option value="banner">Banner</option>
                <option value="sticker">Sticker</option>
                <option value="kad_kahwin">Kad Kahwin</option>
                <option value="business_card">Business Card</option>
                <option value="flyer">Flyer</option>
                <option value="other">Lain-lain</option>
              </select>
              <input
                type="number"
                min="1"
                value={item.quantity}
                onChange={(e) => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                className="col-span-1 px-2 py-1.5 text-sm border border-slate-300 rounded"
              />
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Price"
                value={item.unit_price}
                onChange={(e) => updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                className="col-span-3 px-2 py-1.5 text-sm border border-slate-300 rounded"
              />
              <button
                type="button"
                onClick={() => removeItem(idx)}
                className="col-span-2 text-rose-500 hover:text-rose-700 text-sm"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg">
        <span className="text-sm font-medium text-indigo-900">Total</span>
        <span className="text-xl font-bold text-indigo-700">RM {total.toFixed(2)}</span>
      </div>

      <div className="flex gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50">
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Create Quotation'}
        </button>
      </div>
    </form>
  );
}

export function QuotationList() {
  const { data, loading, refresh } = useQuotations({ page_size: 50 });

  if (loading) {
    return <div className="text-center text-slate-500 py-8">Loading quotations...</div>;
  }

  if (data.length === 0) {
    return (
      <div className="text-center text-slate-400 py-8">
        Tiada quotation. Buat yang pertama.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.map((q) => (
        <QuotationCard key={q.id} quotation={q} onAction={refresh} />
      ))}
    </div>
  );
}
