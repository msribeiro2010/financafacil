import { QueryClient } from "@tanstack/react-query";

// Create a client
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => {
        const [url] = queryKey as [string];

        try {
          console.log(`Fetching data from ${url}`);
          const response = await fetch(url, {
            credentials: 'include',
          });

          if (!response.ok) {
            throw new Error(`API error: ${response.status} ${response.statusText}`);
          }

          return response.json();
        } catch (error) {
          console.error(`Error fetching ${url}:`, error);
          throw error;
        }
      },
    },
  }
});

export async function apiRequest(method: string, url: string, data?: any): Promise<Response> {
  const headers: HeadersInit = {};
  let body: any = undefined;

  if (data) {
    if (data instanceof FormData) {
      // FormData não precisa de Content-Type, o navegador define automaticamente com boundary
      body = data;
      console.log(`Enviando FormData para ${method} ${url}`);

      // Log para depuração
      for (const pair of data.entries()) {
        console.log(`FormData contém campo: ${pair[0]} = ${pair[1]}`);
      }
    } else {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(data);
      console.log(`Enviando JSON para ${method} ${url}: ${body}`);
    }
  }

  console.log(`Iniciando requisição ${method} para ${url}`);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body,
      credentials: 'same-origin'
    });

    console.log(`Resposta ${method} ${url}: status=${response.status}`);

    if (response.ok) {
      console.log(`Requisição ${method} ${url} bem-sucedida:`, response.status);
    } else {
      console.error(`Erro na requisição ${method} ${url}:`, response.status);
      try {
        const errorText = await response.text();
        console.error(`Detalhes do erro: ${errorText}`);
      } catch (e) {
        console.error(`Não foi possível ler o corpo da resposta de erro`);
      }
    }

    return response;
  } catch (error) {
    console.error(`Exceção na requisição ${method} ${url}:`, error);
    throw error;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";

export async function apiQueryWithAuth(
  userId: number,
  endpoint: string,
  options: { on401?: UnauthorizedBehavior } = {}
) {
  const { on401 = "throw" } = options;
  try {
    const response = await fetch(endpoint);

    if (response.status === 401) {
      if (on401 === "returnNull") {
        console.log(`401 Unauthorized accessing ${endpoint}, returning null`);
        return null;
      } else {
        throw new Error(`401 Unauthorized accessing ${endpoint}`);
      }
    }

    return await response.json();
  } catch (error) {
    console.error(`Error fetching ${endpoint}:`, error);
    throw error;
  }
}