import { fetch } from "expo/fetch";
import { QueryClient, QueryFunction } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const AUTH_TOKEN_KEY = "gobharat_auth_token";

let cachedToken: string | null = null;

export async function setAuthToken(token: string | null): Promise<void> {
  cachedToken = token;

  if (token) {
    await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
  } else {
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
  }
}

export async function getAuthToken(): Promise<string | null> {
  if (cachedToken) {
    return cachedToken;
  }

  try {
    cachedToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  } catch {}

  return cachedToken;
}

export async function clearAuthToken(): Promise<void> {
  cachedToken = null;
  await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
}

/**
 * Returns the API base URL.
 *
 * Web:
 * Uses the current website origin.
 *
 * Android / iOS:
 * Uses EXPO_PUBLIC_API_URL or EXPO_PUBLIC_DOMAIN.
 *
 * IMPORTANT:
 * The returned URL always ends with "/".
 * Example:
 * https://go-bharat.onrender.com/
 */
export function getApiUrl(): string {
  // Hosted web application
  if (
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    window.location?.origin
  ) {
    return `${window.location.origin.replace(/\/+$/, "")}/`;
  }

  // Native Android / iOS
  const configured =
    process.env.EXPO_PUBLIC_API_URL ||
    process.env.EXPO_PUBLIC_DOMAIN;

  if (!configured) {
    throw new Error(
      "EXPO_PUBLIC_API_URL or EXPO_PUBLIC_DOMAIN is not set"
    );
  }

  const baseUrl = /^https?:\/\//i.test(configured)
    ? configured
    : `https://${configured}`;

  // Always return exactly one trailing slash
  return `${baseUrl.replace(/\/+$/, "")}/`;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getAuthToken();

  if (token) {
    return {
      Authorization: `Bearer ${token}`,
    };
  }

  return {};
}

async function handle401Logout(): Promise<void> {
  try {
    await clearAuthToken();

    const { router } = require("expo-router");

    router.replace("/auth");
  } catch {}
}

async function throwIfResNotOk(res: Response): Promise<void> {
  if (!res.ok) {
    if (res.status === 401) {
      await handle401Logout();
    }

    const text =
      (await res.text()) ||
      res.statusText ||
      "Request failed";

    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  route: string,
  data?: unknown
): Promise<Response> {
  const baseUrl = getApiUrl();

  // Handles both:
  // "api/example"
  // "/api/example"
  const cleanRoute = route.replace(/^\/+/, "");

  const url = new URL(cleanRoute, baseUrl);

  const authHeaders = await getAuthHeaders();

  const headers: Record<string, string> = {
    ...authHeaders,
    ...(data !== undefined
      ? {
          "Content-Type": "application/json",
        }
      : {}),
  };

  const res = await fetch(url.toString(), {
    method,
    headers,
    body:
      data !== undefined
        ? JSON.stringify(data)
        : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);

  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";

export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const baseUrl = getApiUrl();

    const route = queryKey
      .join("/")
      .replace(/^\/+/, "");

    const url = new URL(route, baseUrl);

    const authHeaders = await getAuthHeaders();

    const res = await fetch(url.toString(), {
      credentials: "include",
      headers: authHeaders,
    });

    if (
      unauthorizedBehavior === "returnNull" &&
      res.status === 401
    ) {
      return null;
    }

    await throwIfResNotOk(res);

    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({
        on401: "throw",
      }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: 2,
    },

    mutations: {
      retry: false,
    },
  },
});
