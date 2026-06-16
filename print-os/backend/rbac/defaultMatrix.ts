// =====================================================================
// PRINT OS — RBAC MATRIX V1.0
// Defines default permissions untuk 8 system roles
// Sales TIDAK nampak cost fields — enforced by role-based filtering
// =====================================================================

import type { RbacMatrix, RoleKey, ModuleKey, Action } from '../types/domain';

// ============================
// ACTION TYPE
// ============================
type Actions = {
  [A in Action]?: boolean;
};

// ============================
// OWNER — Full access
// ============================
const OWNER_MATRIX: RbacMatrix = {
  customers: { create: true, view: true, edit: true, approve: true, delete: true, export: true },
  leads: { create: true, view: true, edit: true, approve: true, delete: true, export: true },
  quotations: { create: true, view: true, edit: true, approve: true, delete: true, export: true },
  sales_orders: { create: true, view: true, edit: true, approve: true, delete: true, export: true },
  artworks: { create: true, view: true, edit: true, approve: true, delete: true, export: true },
  production: { create: true, view: true, edit: true, approve: true, delete: true, export: true },
  qc: { create: true, view: true, edit: true, approve: true, delete: true, export: true },
  deliveries: { create: true, view: true, edit: true, approve: true, delete: true, export: true },
  invoices: { create: true, view: true, edit: true, approve: true, delete: true, export: true },
  payments: { create: true, view: true, edit: true, approve: true, delete: true, export: true },
  reports: { view: true, export: true },
  users: { create: true, view: true, edit: true, approve: true, delete: true, export: true },
  settings: { create: true, view: true, edit: true, approve: true, delete: true, export: true },
};

// ============================
// MANAGEMENT — View all, no delete
// ============================
const MANAGEMENT_MATRIX: RbacMatrix = {
  customers: { create: true, view: true, edit: true, approve: true, export: true },
  leads: { create: true, view: true, edit: true, approve: true, export: true },
  quotations: { create: true, view: true, edit: true, approve: true, export: true },
  sales_orders: { create: true, view: true, edit: true, approve: true, export: true },
  artworks: { create: true, view: true, edit: true, export: true },
  production: { create: true, view: true, edit: true, approve: true, export: true },
  qc: { create: true, view: true, edit: true, approve: true, export: true },
  deliveries: { create: true, view: true, edit: true, approve: true, export: true },
  invoices: { create: true, view: true, edit: true, approve: true, export: true },
  payments: { create: true, view: true, edit: true, approve: true, export: true },
  reports: { view: true, export: true },
  users: { view: true },
  settings: { view: true },
};

// ============================
// MANAGER — Department head
// ============================
const MANAGER_MATRIX: RbacMatrix = {
  customers: { create: true, view: true, edit: true, export: true },
  leads: { create: true, view: true, edit: true, export: true },
  quotations: { create: true, view: true, edit: true, approve: true, export: true },
  sales_orders: { create: true, view: true, edit: true, approve: true, export: true },
  artworks: { view: true, edit: true, export: true },
  production: { view: true, edit: true, approve: true, export: true },
  qc: { create: true, view: true, edit: true, approve: true, export: true },
  deliveries: { create: true, view: true, edit: true, approve: true, export: true },
  invoices: { view: true, edit: true, export: true },
  payments: { view: true, export: true },
  reports: { view: true, export: true },
  users: { view: true },
  settings: { view: true },
};

// ============================
// SALES — TIDAK nampak cost/profit
// ============================
const SALES_MATRIX: RbacMatrix = {
  customers: { create: true, view: true, edit: true, export: true },
  leads: { create: true, view: true, edit: true, export: true },
  quotations: { create: true, view: true, edit: true, export: true },
  sales_orders: { create: true, view: true, edit: true, export: true },
  artworks: { view: true },
  invoices: { view: true, create: true }, // boleh view invoice customer, tapi tak nampak cost
  payments: { create: true, view: true },
  reports: { view: true },
};

// ============================
// DESIGNER — Fokus artwork
// ============================
const DESIGNER_MATRIX: RbacMatrix = {
  customers: { view: true },
  sales_orders: { view: true, edit: true },
  artworks: { create: true, view: true, edit: true },
  production: { view: true },
};

// ============================
// PRODUCTION — Fokus production
// ============================
const PRODUCTION_MATRIX: RbacMatrix = {
  customers: { view: true },
  sales_orders: { view: true, edit: true },
  artworks: { view: true },
  production: { view: true, edit: true },
  qc: { create: true, view: true, edit: true },
  deliveries: { view: true, edit: true },
};

// ============================
// SUPPLIER COORDINATOR — Fokus outsource
// ============================
const SUPPLIER_MATRIX: RbacMatrix = {
  customers: { view: true },
  sales_orders: { view: true },
  production: { view: true, edit: true },
  deliveries: { view: true, edit: true },
};

// ============================
// CUSTOMER — Portal sahaja
// ============================
const CUSTOMER_MATRIX: RbacMatrix = {
  sales_orders: { view: true }, // order sendiri sahaja
  artworks: { view: true, approve: true }, // boleh approve artwork sendiri
  deliveries: { view: true },
  invoices: { view: true },
  payments: { create: true, view: true }, // boleh upload payment proof
};

// ============================
// ROLE REGISTRY
// ============================
export const DEFAULT_RBAC: Record<RoleKey, RbacMatrix> = {
  owner: OWNER_MATRIX,
  management: MANAGEMENT_MATRIX,
  manager: MANAGER_MATRIX,
  sales: SALES_MATRIX,
  designer: DESIGNER_MATRIX,
  production: PRODUCTION_MATRIX,
  supplier: SUPPLIER_MATRIX,
  customer: CUSTOMER_MATRIX,
};

export const DEFAULT_ROLE_DEFINITIONS: Array<{
  key: RoleKey;
  name: string;
  description: string;
  is_system: boolean;
}> = [
  {
    key: 'owner',
    name: 'Owner',
    description: 'Pemilik syarikat — akses penuh, nampak semua data termasuk cost & margin',
    is_system: true,
  },
  {
    key: 'management',
    name: 'Management',
    description: 'C-level / GM — boleh approve, view semua, tapi tidak boleh delete master data',
    is_system: true,
  },
  {
    key: 'manager',
    name: 'Manager',
    description: 'Department head — boleh approve operation harian, tidak nampak full cost structure',
    is_system: true,
  },
  {
    key: 'sales',
    name: 'Sales Executive',
    description: 'Urus customer, quotation, order, payment — TIDAK nampak cost, margin, profit',
    is_system: true,
  },
  {
    key: 'designer',
    name: 'Designer',
    description: 'Fokus artwork, revision, approval — TIDAK nampak finance',
    is_system: true,
  },
  {
    key: 'production',
    name: 'Production',
    description: 'Production queue, QC, packing, delivery — TIDAK nampak cost & margin',
    is_system: true,
  },
  {
    key: 'supplier',
    name: 'Supplier Coordinator',
    description: 'Outsource tracking, PO, supplier receive — TIDAK nampak pricing',
    is_system: true,
  },
  {
    key: 'customer',
    name: 'Customer',
    description: 'Portal access — lihat order sendiri, approve artwork, upload payment proof',
    is_system: true,
  },
];

// ============================
// PERMISSION CHECK
// ============================
export function can(
  role: RoleKey,
  module: ModuleKey,
  action: Action
): boolean {
  return DEFAULT_RBAC[role]?.[module]?.[action] === true;
}

// ============================
// ROLE SCOPED FIELD FILTER
// ============================
// Field yang HANYA boleh nampak oleh Owner/Management/Finance
export const COST_SENSITIVE_FIELDS = {
  quotations: ['cost_total', 'gross_profit', 'margin_percent'],
  quotation_items: ['cost_per_unit'],
  sales_orders: ['cost_total', 'gross_profit', 'margin_percent', 'internal_notes'],
  sales_order_items: ['cost_per_unit'],
  payments: ['notes'], // optional hide payment notes for sales
} as const;

export function canSeeCost(role: RoleKey): boolean {
  return ['owner', 'management'].includes(role);
}

export function canSeeMargin(role: RoleKey): boolean {
  return ['owner', 'management', 'manager'].includes(role);
}

export function canSeeProfit(role: RoleKey): boolean {
  return ['owner', 'management'].includes(role);
}

// ============================
// FIELD-LEVEL FILTER HELPER
// ============================
export function filterSensitiveFields<T extends Record<string, any>>(
  data: T,
  module: keyof typeof COST_SENSITIVE_FIELDS,
  role: RoleKey
): T {
  if (canSeeCost(role)) {
    return data; // owner/management nampak semua
  }

  const sensitiveFields = COST_SENSITIVE_FIELDS[module] || [];
  const filtered = { ...data };

  for (const field of sensitiveFields) {
    if (field in filtered) {
      if (field === 'cost_per_unit' || field === 'cost_total') {
        filtered[field] = 0 as any;
      } else if (field === 'gross_profit') {
        filtered[field] = 0 as any;
      } else if (field === 'margin_percent') {
        filtered[field] = 0 as any;
      } else if (field === 'internal_notes') {
        filtered[field] = null as any;
      } else if (field === 'notes' && module === 'payments') {
        filtered[field] = null as any;
      }
    }
  }

  return filtered;
}
