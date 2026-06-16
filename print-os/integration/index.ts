// =====================================================================
// PRINT OS — Integration Package V1.0
// Drop-in package untuk Replit / React apps
// =====================================================================

/**
 * Setup:
 * 1. Copy folder ini ke root project Replit anda
 * 2. Install: `npm install @supabase/supabase-js`
 * 3. Set env variables:
 *    VITE_SUPABASE_URL=https://ddvytkgskhegfjytwpqz.supabase.co
 *    VITE_SUPABASE_ANON_KEY=<your-anon-key>
 * 4. Wrap app dengan <PrintOSProvider>
 *
 * Usage:
 *    import { useAuth, useDashboard, useQuotations } from './integration';
 *
 *    function MyComponent() {
 *      const { user, company, role, signIn, signOut } = useAuth();
 *      const { dashboard, loading } = useDashboard();
 *      return <div>{dashboard?.today.new_orders}</div>;
 *    }
 */

export { PrintOSProvider, useAuth, usePrintOS } from './context/PrintOSContext';
export { useQuotations, useQuotation } from './hooks/useQuotations';
export { useSalesOrders, useSalesOrder } from './hooks/useSalesOrders';
export { useProduction, useProductionJob } from './hooks/useProduction';
export { useCustomers } from './hooks/useCustomers';
export { useDashboard } from './hooks/useDashboard';

export { QuotationForm, QuotationCard } from './components/QuotationForm';
export { SalesOrderCard, SOCard } from './components/SalesOrderCard';
export { KPITile, DashboardGrid } from './components/KPITile';
export { LoginPage } from './components/LoginPage';

export {
  createQuotation,
  updateQuotation,
  transitionQuotation,
  convertQuotationToSO,
  listQuotations,
  getQuotation,
} from './services/quotationApi';
export {
  createSalesOrder,
  updateSalesOrder,
  transitionSO,
  listSalesOrders,
  getSalesOrder,
} from './services/salesOrderApi';
export {
  transitionProductionJob,
  listProductionJobs,
  createQCRecord,
  transitionQC,
  transitionDelivery,
  detectBottlenecks,
} from './services/productionApi';
export {
  getOwnerDashboard,
  getTransactionCaptureRate,
  getOrderCoverage,
  getWorkflowCompletion,
  getRevenueTrend,
  getTopCustomers,
  predictRepeatOrders,
} from './services/dashboardApi';

export { getSupabaseClient, signIn, signOut, getCurrentUser } from './utils/supabase';
export type {
  Company,
  Branch,
  User,
  Customer,
  Quotation,
  QuotationItem,
  SalesOrder,
  SalesOrderItem,
  ProductionJob,
  QCRecord,
  Delivery,
  Invoice,
  Payment,
  RoleKey,
  PlanType,
  SOStatus,
  QuotationStatus,
  ProductionStatus,
  DeliveryStatus,
  QCStatus,
  InvoiceStatus,
  ArtworkLifecycleStatus,
  LeadStatus,
  IndustryTag,
  CustomerType,
  OwnerDashboard,
} from './types/domain';
