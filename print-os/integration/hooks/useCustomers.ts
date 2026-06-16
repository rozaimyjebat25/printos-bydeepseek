// =====================================================================
// PRINT OS — Customer Hook
// =====================================================================

import { useState, useEffect, useCallback } from 'react';
import { listCustomers } from '../services/dashboardApi';
import type { Customer } from '../types/domain';

export function useCustomers(filters: { search?: string; industry_tag?: string; page?: number; page_size?: number } = {}) {
  const [data, setData] = useState<Customer[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const result = await listCustomers(filters);
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
