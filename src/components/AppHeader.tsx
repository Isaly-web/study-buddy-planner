import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { BookOpenCheck, BarChart3, LogOut, MessageSquare } from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useTranslation } from "@/lib/i18n";

export function AppHeader() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }
  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <Link to="/dashboard" className="flex items-center gap-2 font-semibold">
          <BookOpenCheck className="h-5 w-5 text-primary" />
          Studieplan
        </Link>
        <div className="flex items-center gap-1">
          <LanguageSwitcher />
          <Link to="/stats">
            <Button variant="ghost" size="sm">
              <BarChart3 className="h-4 w-4" />
              <span className="ml-1.5 hidden sm:inline">{t("stats")}</span>
            </Button>
          </Link>
          <Link to="/feedback">
            <Button variant="ghost" size="sm">
              <MessageSquare className="h-4 w-4" />
              <span className="ml-1.5 hidden sm:inline">{t("feedback")}</span>
            </Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="h-4 w-4" />
            <span className="ml-1.5 hidden sm:inline">{t("logout")}</span>
          </Button>
        </div>
      </div>
    </header>
  );
}