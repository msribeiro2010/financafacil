import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export const apiRequest = async (method: string, url: string, data?: any) => {
  try {
    console.log(`[API] Iniciando requisição ${method} para ${url}`);
    const options: any = {
      method,
      headers: {},
      credentials: 'include' // Garantir que cookies de sessão sejam enviados
    };

    if (data) {
      if (data instanceof FormData) {
        options.body = data;
        console.log(`[API] Enviando dados como FormData para ${url}`);
      } else {
        options.headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(data);
        console.log(`[API] Enviando dados como JSON para ${url}:`, data);
      }
    }

    console.log(`[API] Executando fetch para ${url}`);
    const response = await fetch(url, options);
    console.log(`[API] Resposta recebida de ${url}, status: ${response.status}`);

    // Verificar se a resposta foi recebida
    if (!response) {
      throw new Error(`Não foi possível conectar ao servidor: ${url}`);
    }
    
    // Se a resposta não for ok, tentar obter os detalhes do erro
    if (!response.ok) {
      let errorText = '';
      try {
        const errorData = await response.json();
        errorText = errorData.message || response.statusText;
      } catch {
        errorText = await response.text() || response.statusText;
      }
      throw new Error(`Erro ${response.status}: ${errorText}`);
    }

    return response;
} catch (error: any) {
    console.error(`[API] Erro na requisição ${method} para ${url}:`, error);
    throw error;
  }
};

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