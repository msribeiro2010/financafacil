
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

export const apiRequest = async (
  method: string, 
  url: string, 
  data?: any
): Promise<Response> => {
  const options: RequestInit = {
    method,
    credentials: 'include',
    headers: {}
  };

  if (data) {
    if (data instanceof FormData) {
      // FormData: não definir Content-Type para que o navegador defina com boundary correto
      console.log(`Enviando FormData para ${method} ${url}`);
      options.body = data;
    } else {
      // JSON: definir Content-Type adequado
      console.log(`Enviando JSON para ${method} ${url}`, data);
      options.headers = {
        ...options.headers,
        'Content-Type': 'application/json',
      };
      options.body = JSON.stringify(data);
    }
  }

  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      console.error(`Erro na requisição ${method} ${url}:`, response.status, response.statusText);
    } else {
      console.log(`Requisição ${method} ${url} bem-sucedida:`, response.status);
    }
    
    return response;
  } catch (error) {
    console.error(`Falha na requisição ${method} ${url}:`, error);
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
