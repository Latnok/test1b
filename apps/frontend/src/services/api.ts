const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

const getDefaultApiBaseUrl = () => {
  if (typeof window === "undefined") {
    return "http://localhost:4000/api/v1";
  }

  if (window.location.port === "5173" || window.location.port === "4173") {
    return `${window.location.protocol}//${window.location.hostname}:4000/api/v1`;
  }

  return "/api/v1";
};

export const API_BASE_URL = configuredBaseUrl && configuredBaseUrl.length > 0 ? configuredBaseUrl : getDefaultApiBaseUrl();

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
