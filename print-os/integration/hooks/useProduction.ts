// =====================================================================
// PRINT OS — Production / QC / Delivery Hooks
// =====================================================================

import { useState, useEffect, useCallback } from 'react';
import {
  listProductionJobs,
  transitionProductionJob,
  createQCRecord,
  transitionQC,
  transitionDelivery,
  detectBottlenecks,
} from '../services/productionApi';
import type {
  ProductionJob,
  ProductionStatus,
  QCStatus,
  DeliveryStatus,
  Uuid,
} from '../types/domain';
import type { ListProductionFilters } from '../services/productionApi';

export function useProduction(filters: ListProductionFilters = {}) {
  const [data, setData] = useState<ProductionJob[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const result = await listProductionJobs(filters);
      setData(result.data);
      setCount(result.count);
      setError(null);
    } catch (e: any) {
      setError(e);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, count, loading, error, refresh };
}

export function useProductionJob(id: Uuid | null) {
  const [data, setData] = useState<ProductionJob | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const supabase = (await import('../utils/supabase')).getSupabaseClient();
      const { data: job, error: e } = await supabase
        .from('production_jobs')
        .select('*')
        .eq('id', id)
        .single();
      if (e) throw e;
      setData(job as ProductionJob);
      setError(null);
    } catch (e: any) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

export function useProductionActions() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const transition = useCallback(async (
    id: Uuid,
    toStatus: ProductionStatus,
    options?: { reason?: string; operator_id?: Uuid; scheduled_at?: string }
  ) => {
    setLoading(true);
    try {
      const result = await transitionProductionJob(id, toStatus, options);
      setError(null);
      return result;
    } catch (e: any) {
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const createQC = useCallback(async (input: {
    production_job_id: Uuid;
    checklist: Record<string, any>;
    defects?: string[];
    notes?: string;
    photos?: string[];
  }) => {
    setLoading(true);
    try {
      const result = await createQCRecord(input);
      setError(null);
      return result;
    } catch (e: any) {
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const transitionQCHandler = useCallback(async (
    qcId: Uuid,
    toStatus: QCStatus,
    options?: { reason?: string; notes?: string; defects?: string[] }
  ) => {
    setLoading(true);
    try {
      const result = await transitionQC(qcId, toStatus, options);
      setError(null);
      return result;
    } catch (e: any) {
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const transitionDeliveryHandler = useCallback(async (
    id: Uuid,
    toStatus: DeliveryStatus,
    options?: { reason?: string; tracking_no?: string; courier_name?: string; picked_up_by_name?: string }
  ) => {
    setLoading(true);
    try {
      const result = await transitionDelivery(id, toStatus, options);
      setError(null);
      return result;
    } catch (e: any) {
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    transition,
    createQC,
    transitionQC: transitionQCHandler,
    transitionDelivery: transitionDeliveryHandler,
    loading,
    error,
  };
}

export function useBottlenecks() {
  const [data, setData] = useState({
    waiting_schedule: 0,
    overdue: 0,
    qc_pending: 0,
    stuck_in_production: 0,
  });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const result = await detectBottlenecks();
      setData(result);
    } catch (e) {
      // Silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60000); // refresh every 60s
    return () => clearInterval(interval);
  }, [refresh]);

  return { data, loading, refresh };
}
