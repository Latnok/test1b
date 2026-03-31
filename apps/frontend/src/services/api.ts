const apiHost = typeof window === "undefined" ? "localhost" : window.location.hostname;

export const API_BASE_URL = `http://${apiHost}:4000/api/v1`;

type RequestOptions = RequestInit & {
  query?: Record<string, string | number | undefined | null>;
};

const buildUrl = (path: string, query?: RequestOptions["query"]) => {
  const url = new URL(`${API_BASE_URL}${path}`);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return url.toString();
};

export const request = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const { headers, query, ...rest } = options;
  const response = await fetch(buildUrl(path, query), {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...headers
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
};
