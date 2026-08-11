import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { analytics } from "./lib/analytics-sdk";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  if (typeof window !== "undefined") {
    router.subscribe("onResolved", ({ toLocation }) => {
      const path = toLocation.pathname + (toLocation.searchStr ?? "");
      analytics.track("page_view", { path });
    });
  }

  return router;
};
