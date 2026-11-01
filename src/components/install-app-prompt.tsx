import { useEffect, useState } from "react";
import { Share, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import {
  detectInstallPlatform,
  dismissInstallPrompt,
  isInstallPromptDismissed,
  isMarkedInstalled,
  isRunningInstalled,
  markInstalled,
  type BeforeInstallPromptEvent,
  type InstallPlatform,
} from "@/lib/pwa-install";

/**
 * Dismissible banner shown inside the logged-in app. Uses the native install
 * prompt where the browser offers one, otherwise short manual instructions.
 * There are no App Store / Google Play listings, so no store links.
 * Hidden when already installed or dismissed.
 */
export function InstallAppPrompt() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState<InstallPlatform>("desktop");
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isRunningInstalled() || isMarkedInstalled() || isInstallPromptDismissed()) return;
    setPlatform(detectInstallPlatform(navigator.userAgent, navigator.maxTouchPoints));
    setVisible(true);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      markInstalled();
      setVisible(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!visible) return null;

  // Desktop browsers without a native prompt (Firefox, Safari) have no simple
  // install flow worth explaining, so stay quiet there.
  if (!deferred && platform === "desktop") return null;

  const dismiss = () => {
    dismissInstallPrompt();
    setVisible(false);
  };

  const install = async () => {
    if (!deferred) return;
    const prompt = deferred;
    setDeferred(null);
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") markInstalled();
    setVisible(false);
  };

  return (
    <section
      aria-label={t("install_app.title")}
      className="relative mb-4 flex items-start gap-3 rounded-2xl border border-border bg-card p-4 pr-10 shadow-sm"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
        <Smartphone className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="font-serif text-base font-semibold">{t("install_app.title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {deferred
            ? t("install_app.description")
            : platform === "ios"
              ? t("install_app.ios_steps")
              : t("install_app.android_steps")}
          {!deferred && platform === "ios" && (
            <Share className="ml-1 inline h-3.5 w-3.5 align-text-bottom" aria-hidden="true" />
          )}
        </p>
        {deferred && (
          <Button size="sm" className="mt-3" onClick={install}>
            {t("install_app.install_button")}
          </Button>
        )}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t("install_app.dismiss")}
        className="absolute right-2 top-2 rounded-full p-2 text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </section>
  );
}
