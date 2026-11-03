import { Link } from "@tanstack/react-router";
import { APP_NAME, SUPPORT_MAILTO } from "@/lib/app-config";
import { useTranslation } from "@/lib/i18n";

// Foundation footer: the same three links in every Isaly app (privacy, terms, support).
// App-specific links should not be added here. The bottom padding keeps the links clear of the
// fixed feedback button.
export function SiteFooter() {
  const { t } = useTranslation();
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 pb-20 pt-6 text-xs text-muted-foreground">
        <span>
          © {new Date().getFullYear()} Isaly · {APP_NAME}
        </span>
        <nav aria-label={t("footer_legal")} className="flex flex-wrap gap-x-4 gap-y-2">
          <Link to="/privacy" className="hover:text-foreground hover:underline">
            {t("footer_privacy")}
          </Link>
          <Link to="/terms" className="hover:text-foreground hover:underline">
            {t("footer_terms")}
          </Link>
          <a href={SUPPORT_MAILTO} className="hover:text-foreground hover:underline">
            {t("footer_support")}
          </a>
        </nav>
      </div>
    </footer>
  );
}
