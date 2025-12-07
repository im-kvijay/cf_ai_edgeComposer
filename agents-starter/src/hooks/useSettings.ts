import { useState, useCallback, useEffect } from 'react';
import { api } from '../api/client';

interface UseSettingsReturn {
  originUrl: string | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  setOrigin: (url: string) => Promise<boolean>;
  clearOrigin: () => Promise<boolean>;
  refresh: () => Promise<void>;
}

export function useSettings(): UseSettingsReturn {
  const [originUrl, setOriginUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await api.getOrigin();
      setOriginUrl(result.origin);
    } catch (err) {
      console.error('Failed to load origin:', err);
      setError('Failed to load origin settings');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setOrigin = useCallback(async (url: string): Promise<boolean> => {
    try {
      setIsSaving(true);
      setError(null);
      const result = await api.setOrigin(url);
      setOriginUrl(result.origin);
      return true;
    } catch (err) {
      console.error('Failed to set origin:', err);
      setError('Failed to update origin');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const clearOrigin = useCallback(async (): Promise<boolean> => {
    try {
      setIsSaving(true);
      setError(null);
      await api.clearOrigin();
      setOriginUrl(null);
      return true;
    } catch (err) {
      console.error('Failed to clear origin:', err);
      setError('Failed to clear origin');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, []);

  return {
    originUrl,
    isLoading,
    isSaving,
    error,
    setOrigin,
    clearOrigin,
    refresh,
  };
}
