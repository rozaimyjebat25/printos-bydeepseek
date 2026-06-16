// =====================================================================
// PRINT OS — Dashboard Hook
// =====================================================================

import { useState, useEffect, useCallback } from 'react';
import {
  getOwnerDashboard,
  getTransactionCaptureRate,
  getWorkflowCompletion,
  getRevenueTrend,
  getTopCustomers,
  predictRepeatOrders,
} from '../services/dashboardApi';
import type { OwnerDashboard, TopCustomer, RepeatPrediction, RevenueTrendPoint } from '../services/dashboardApi';

export function useDashboard() {
  const [dashboard, setDashboard] = useState<OwnerDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getOwnerDashboard();
      setDashboard(data);
      setError(null);
    } catch (e: any) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60000); // refresh every 60s
    return () => clearInterval(interval);
  }, [refresh]);

  return { dashboard, loading, error, refresh };
}

export function useRevenueTrend(period: { start: string; end: string }, groupBy: 'day' | 'week' | 'month' = 'day') {
  const [data, setData] = useState<RevenueTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const result = await getRevenueTrend(period, groupBy);
        setData(result);
        setError(null);
      } catch (e: any) {
        setError(e);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period.start, period.end, groupBy]);

  return { data, loading, error };
}

export function useTopCustomers(limit = 10) {
  const [data, setData] = useState<TopCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const result = await getTopCustomers(limit);
        setData(result);
        setError(null);
      } catch (e: any) {
        setError(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [limit]);

  return { data, loading, error };
}

export function useRepeatPredictions() {
  const [data, setData] = useState<RepeatPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const result = await predictRepeatOrders();
      setData(result);
      setError(null);
    } catch (e: any) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
