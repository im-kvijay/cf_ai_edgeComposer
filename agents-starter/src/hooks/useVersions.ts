import { useState, useCallback, useEffect } from 'react';
import { api } from '../api/client';
import type { PlanVersion } from '../types';

interface UseVersionsReturn {
  versions: PlanVersion[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  getVersion: (id: string) => Promise<PlanVersion | null>;
}

export function useVersions(): UseVersionsReturn {
  const [versions, setVersions] = useState<PlanVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await api.getVersions();
      setVersions(result.versions || []);
    } catch (err) {
      console.error('Failed to load versions:', err);
      setError('Failed to load versions');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const getVersion = useCallback(async (id: string): Promise<PlanVersion | null> => {
    try {
      const result = await api.getVersion(id);
      return result.version;
    } catch (err) {
      console.error('Failed to get version:', err);
      return null;
    }
  }, []);

  return { versions, isLoading, error, refresh, getVersion };
}
