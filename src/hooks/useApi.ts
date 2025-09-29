import useSWR, { KeyedMutator } from 'swr';
import { useAuth } from '@/contexts/AuthContext';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

interface ApiError {
  error: string;
}

const fetcher = (url: string, token?: string) => 
  fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  }).then(async (res) => {
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'An error occurred');
    }
    return res.json();
  });

export function useApi<T>(
  url?: string | null, 
  options: { 
    refreshInterval?: number;
    revalidateOnFocus?: boolean;
    retryOnError?: boolean;
  } = {}
) {
  const { token } = useAuth();
  
  const { data, error, mutate, isLoading } = useSWR<ApiResponse<T>, Error>(
    url ? [url, token] : null,
    ([url, token]: [string, string | null]) => fetcher(url, token || undefined),
    {
      refreshInterval: options.refreshInterval || 0,
      revalidateOnFocus: options.revalidateOnFocus ?? true,
      shouldRetryOnError: options.retryOnError ?? true,
      errorRetryCount: 3,
      errorRetryInterval: 5000,
    }
  );

  const apiCall = async <R>(
    callUrl: string,
    callOptions: {
      method?: string;
      body?: any;
    } = {}
  ): Promise<R> => {
    const result = await apiCallStandalone<R>(callUrl, {
      ...callOptions,
      token: token || undefined,
    });
    return result.data;
  };

  return {
    data: data?.data,
    error,
    mutate,
    isLoading,
    isError: !!error,
    apiCall,
  };
}

export async function apiCallStandalone<T>(
  url: string,
  options: {
    method?: string;
    body?: any;
    token?: string;
  } = {}
): Promise<ApiResponse<T>> {
  const { method = 'GET', body, token } = options;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'An error occurred');
  }

  return response.json();
}

