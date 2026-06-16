// =====================================================================
// PRINT OS — Quotation Hooks
// =====================================================================

import { useState, useEffect, useCallback } from 'react';
import {
  listQuotations,
  getQuotation,
  createQuotation,
  updateQuotation,
  transitionQuotation,
  convertQuotationToSO,
} from '../services/quotationApi';
import type { Quotation, QuotationStatus, Uuid } from '../types/domain';
import type { CreateQuotationInput, UpdateQuotationInput, ListQuotationFilters } from '../services/quotationApi';

export function useQuotations(filters: ListQuotationFilters = {}) {
  const [data, setData] = useState<Quotation[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const result = await listQuotations(filters);
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

export function useQuotation(id: Uuid | null) {
  const [data, setData] = useState<(Quotation & { items: any[] }) | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const result = await getQuotation(id);
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

export function useQuotationActions() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const create = useCallback(async (input: CreateQuotationInput) => {
    setLoading(true);
    try {
      const result = await createQuotation(input);
      setError(null);
      return result;
    } catch (e: any) {
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const update = useCallback(async (id: Uuid, input: UpdateQuotationInput) => {
    setLoading(true);
    try {
      const result = await updateQuotation(id, input);
      setError(null);
      return result;
    } catch (e: any) {
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const transition = useCallback(async (id: Uuid, toStatus: QuotationStatus, reason?: string) => {
    setLoading(true);
    try {
      const result = await transitionQuotation(id, toStatus, reason);
      setError(null);
      return result;
    } catch (e: any) {
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const convert = useCallback(async (id: Uuid) => {
    setLoading(true);
    try {
      const soId = await convertQuotationToSO(id);
      setError(null);
      return soId;
    } catch (e: any) {
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return { create, update, transition, convert, loading, error };
}
