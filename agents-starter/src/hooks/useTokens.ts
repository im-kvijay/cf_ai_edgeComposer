import { useState, useCallback, useEffect } from 'react';
import { api } from '../api/client';
import type { PreviewToken } from '../types';

interface UseTokensReturn {
  tokens: PreviewToken[];
  isLoading: boolean;
  isCreating: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  create: (versionId: string, expiresInSeconds?: number) => Promise<PreviewToken | null>;
  remove: (token: string) => Promise<void>;
  getPreviewUrl: (token: string) => string;
}

export function useTokens(): UseTokensReturn {
  const [tokens, setTokens] = useState<PreviewToken[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await api.getTokens();
      setTokens(result.tokens || []);
    } catch (err) {
      console.error('Failed to load tokens:', err);
      setError('Failed to load tokens');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(async (versionId: string, expiresInSeconds = 86400): Promise<PreviewToken | null> => {
    try {
      setIsCreating(true);
      setError(null);
      const result = await api.createToken(versionId, expiresInSeconds);
      await refresh();
      return result.token;
    } catch (err) {
      console.error('Failed to create token:', err);
      setError('Failed to create token');
      return null;
    } finally {
      setIsCreating(false);
    }
  }, [refresh]);

  const remove = useCallback(async (token: string) => {
    try {
      await api.deleteToken(token);
      await refresh();
    } catch (err) {
      console.error('Failed to delete token:', err);
      setError('Failed to delete token');
    }
  }, [refresh]);

  const getPreviewUrl = useCallback((token: string): string => {
    return `${window.location.origin}/preview/${token}`;
  }, []);

  return {
    tokens,
    isLoading,
    isCreating,
    error,
    refresh,
    create,
    remove,
    getPreviewUrl,
  };
}
