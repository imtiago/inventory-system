import { QueryClient } from "@tanstack/react-query";

/** App-wide singleton, reachable from non-React code (e.g. the 401 interceptor). */
export const queryClient = new QueryClient();
