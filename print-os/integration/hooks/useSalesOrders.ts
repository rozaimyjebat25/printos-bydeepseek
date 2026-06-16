// =====================================================================
// PRINT OS — Sales Order Hooks
// =====================================================================

import { useState, useEffect, useCallback } from 'react';
import {
  listSalesOrders,
  getSalesOrder,
  createSalesOrder,
  updateSalesOrder,
  transitionSO,
} from '../services/salesOrderApi';
import type { SalesOrder, SOStatus, Uuid } from '../types/domain';
import type { CreateSOInput, UpdateSOInput, ListSOFilters } from '../services/salesOrderApi';

export function useSalesOrders(filters: ListSOFilters = {}) {
  const [data, setData] = useState<SalesOrder[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const result = await listSalesOrders(filters);
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

export function useSalesOrder(id: Uuid | null) {
  const [data, setData] = useState<(SalesOrder & { items: any[] }) | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const result = await getSalesOrder(id);
      setData(result);
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

export function useSalesOrderActions() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const create = useCallback(async (input: CreateSOInput) => {
    setLoading(true);
    try {
      const result = await createSalesOrder(input);
      setError(null);
      return result;
    } catch (e: any) {
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const update = useCallback(async (id: Uuid, input: UpdateSOInput) => {
    setLoading(true);
    try {
      const result = await updateSalesOrder(id, input);
      setError(null);
      return result;
    } catch (e: any) {
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const transition = useCallback(async (id: Uuid, toStatus: SOStatus, reason?: string) => {
    setLoading(true);
    try {
      const result = await transitionSO(id, toStatus, reason);
      setError(null);
      return result;
    } catch (e: any) {
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return { create, update, transition, loading, error };
}
