import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export const apiRequest = async (method: string, url: string, data?: any) => {
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  };

  if (data) {
    if (data instanceof FormData) {
      console.log("Enviando como FormData", method, url);
      options.headers = {};  // Permitir que o navegador defina Content-Type com boundary
      options.body = data;
    } else if (typeof data === 'object') {
      console.log("Enviando como JSON", method, url, data);
      options.body = JSON.stringify(data);
    } else {
      console.log("Enviando como texto", method, url, data);
      options.body = String(data);
    }
  }

  try {
    const response = await fetch(url, options);

    // Log para depuração
    if (!response.ok) {
      console.error(`Erro na requisição ${method} ${url}:`, response.status, response.statusText);
    }

    return response;
  } catch (error) {
    console.error(`Falha na requisição ${method} ${url}:`, error);
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey[0] as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});