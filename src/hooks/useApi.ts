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

class HttpError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'HttpError';
  }
}

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const error = await res.json();
    return error?.error || error?.message || res.statusText || 'An error occurred';
  } catch {
    try {
      const text = await res.text();
      return text || res.statusText || 'An error occurred';
    } catch {
      return res.statusText || 'An error occurred';
    }
  }
}

const fetcher = (url: string, token?: string) =>
  fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  }).then(async (res) => {
    if (!res.ok) {
      const message = await parseErrorMessage(res);
      throw new HttpError(message, res.status);
    }
    try {
      return await res.json();
    } catch (e) {
      // No JSON body, return null-ish shape
      return null as any;
    }
  });

export function useApi<T>(
  url?: string | null, 
  options: { 
    refreshInterval?: number;
    revalidateOnFocus?: boolean;
    retryOnError?: boolean;
  } = {}
) {
  const { token, logout } = useAuth();
  
  const { data, error, mutate, isLoading } = useSWR<ApiResponse<T>, Error>(
    url ? [url, token] : null,
    ([url, token]: [string, string | null]) => fetcher(url, token || undefined),
    {
      refreshInterval: options.refreshInterval || 0,
      revalidateOnFocus: options.revalidateOnFocus ?? true,
      shouldRetryOnError: options.retryOnError ?? true,
      errorRetryCount: 3,
      errorRetryInterval: 5000,
      onError: (err) => {
        if (err instanceof HttpError && err.status === 401) {
          logout();
        }
      },
    }
  );

  const apiCall = async <R>(
    callUrl: string,
    callOptions: {
      method?: string;
      body?: any;
    } = {}
  ): Promise<R> => {
    try {
      const result = await apiCallStandalone<R>(callUrl, {
        ...callOptions,
        token: token || undefined,
      });
      return result.data;
    } catch (err) {
      if (err instanceof HttpError && err.status === 401) {
        logout();
      }
      throw err;
    }
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
    let errorMessage = response.statusText || 'An error occurred';
    try {
      const error = await response.json();
      errorMessage = error?.error || error?.message || errorMessage;
    } catch {
      try {
        const text = await response.text();
        if (text) errorMessage = text;
      } catch {
        // ignore — body already consumed or unavailable
      }
    }
    throw new HttpError(errorMessage, response.status);
  }

  try {
    return await response.json();
  } catch (e) {
    return null as any;
  }
}

