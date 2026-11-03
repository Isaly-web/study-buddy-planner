import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ensureAppAccount } from "@/lib/ensure-app-account";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    // The profile must exist before the pages load their data. Never throws, see the file.
    await ensureAppAccount(supabase, data.user.id);
    return { user: data.user };
  },
  component: () => <Outlet />,
});
