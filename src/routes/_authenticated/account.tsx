import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { deleteMyData } from "@/lib/account";
import { resetAppAccountBootstrap } from "@/lib/ensure-app-account";
import { useTranslation } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({ meta: [{ title: "Konto – Studieplan" }] }),
  component: AccountPage,
});

function AccountPage() {
  const { t } = useTranslation();
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    setBusy(true);
    try {
      await deleteMyData(supabase, user.id);
      resetAppAccountBootstrap();
      toast.success(t("account_deleted"));
      navigate({ to: "/" });
    } catch {
      toast.error(t("account_delete_failed"));
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t("account")}</h1>
        <Card className="p-5">
          <h2 className="font-semibold">{t("account_email")}</h2>
          <p className="mt-1 text-muted-foreground">{user.email}</p>
        </Card>
        <Card className="space-y-3 border-destructive/40 p-5">
          <h2 className="font-semibold">{t("account_delete_title")}</h2>
          <p className="text-sm text-muted-foreground">{t("account_delete_body")}</p>
          <p className="text-sm">
            <Link to="/privacy" className="underline">
              {t("account_privacy_link")}
            </Link>
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={busy}>
                {t("account_delete_button")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("account_confirm_title")}</AlertDialogTitle>
                <AlertDialogDescription>{t("account_confirm_body")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete}>
                  {t("account_confirm_button")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </Card>
      </main>
    </div>
  );
}
