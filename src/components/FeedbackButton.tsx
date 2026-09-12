import { useEffect, useRef, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageSquarePlus, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { submitFeedback } from "@/lib/feedback.functions";
import { APP_VERSION, detectOs, detectDevice } from "@/lib/app-version";

type Category = "bug" | "suggestion" | "question" | "other";

const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_SCREENSHOT_TYPES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);

export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<Category>("other");
  const [stepsToReproduce, setStepsToReproduce] = useState("");
  const [name, setName] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const location = useLocation();
  const submitFn = useServerFn(submitFeedback);

  useEffect(() => {
    if (!screenshot) {
      setScreenshotPreview(null);
      return;
    }
    const url = URL.createObjectURL(screenshot);
    setScreenshotPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [screenshot]);

  function pickScreenshot(file: File | null) {
    if (!file) {
      setScreenshot(null);
      return;
    }
    if (!ALLOWED_SCREENSHOT_TYPES.has(file.type)) {
      toast.error("Bilden måste vara PNG, JPEG eller WebP.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (file.size > MAX_SCREENSHOT_BYTES) {
      toast.error("Bilden är för stor (max 5 MB).");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setScreenshot(file);
  }

  function clearScreenshot() {
    setScreenshot(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function resetForm() {
    setMessage("");
    setCategory("other");
    setStepsToReproduce("");
    setName("");
    setAnonymous(false);
    clearScreenshot();
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const trimmed = message.trim();
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes.user;
      if (!user) throw new Error("Du måste vara inloggad för att skicka feedback.");

      let screenshotPath: string | null = null;
      if (screenshot) {
        const ext =
          (screenshot.name.split(".").pop() || "png").toLowerCase().replace(/[^a-z0-9]/g, "") ||
          "png";
        screenshotPath = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("feedback-screenshots")
          .upload(screenshotPath, screenshot, { upsert: false, contentType: screenshot.type });
        if (upErr) throw new Error(`Kunde inte ladda upp skärmdumpen: ${upErr.message}`);
      }

      const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
      const page_url = typeof window !== "undefined" ? window.location.href : location.pathname;

      return submitFn({
        data: {
          message: trimmed,
          category,
          page_url,
          os: detectOs(ua),
          device: detectDevice(ua),
          app_version: APP_VERSION,
          anonymous,
          reporter_name: !anonymous && name.trim() ? name.trim() : undefined,
          steps_to_reproduce:
            category === "bug" && stepsToReproduce.trim() ? stepsToReproduce.trim() : undefined,
          screenshot_path: screenshotPath,
        },
      });
    },
    onSuccess: () => {
      toast.success("Tack! Din feedback är skickad.");
      resetForm();
      setOpen(false);
    },
    onError: (err) => {
      const msg =
        err instanceof Error ? err.message : "Kunde inte skicka feedback. Försök igen om en stund.";
      toast.error(msg);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (message.trim().length === 0) {
      toast.error("Skriv ett meddelande först.");
      return;
    }
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="fixed bottom-5 right-5 z-40 rounded-full shadow-lg h-12 px-4 gap-2"
          aria-label="Skicka feedback"
        >
          <MessageSquarePlus className="h-4 w-4" />
          <span className="hidden sm:inline">Feedback</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Skicka feedback</DialogTitle>
          <DialogDescription>
            Berätta vad som funkar bra eller mindre bra – vi läser allt.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fb-category">Kategori</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
              <SelectTrigger id="fb-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bug">Bugg</SelectItem>
                <SelectItem value="suggestion">Förslag</SelectItem>
                <SelectItem value="question">Fråga</SelectItem>
                <SelectItem value="other">Annat</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="fb-message">Meddelande</Label>
            <Textarea
              id="fb-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Vad vill du berätta för oss?"
              rows={5}
              maxLength={4000}
              required
            />
          </div>
          {category === "bug" && (
            <div className="space-y-2">
              <Label htmlFor="fb-steps">Steg för att återskapa (valfritt)</Label>
              <Textarea
                id="fb-steps"
                value={stepsToReproduce}
                onChange={(e) => setStepsToReproduce(e.target.value)}
                placeholder="1. Gå till...&#10;2. Klicka på...&#10;3. Se felet"
                rows={3}
                maxLength={4000}
              />
            </div>
          )}
          {!anonymous && (
            <div className="space-y-2">
              <Label htmlFor="fb-name">Namn (valfritt)</Label>
              <Input
                id="fb-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ditt namn"
                maxLength={120}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="fb-screenshot">Skärmdump (valfritt)</Label>
            <input
              ref={fileInputRef}
              id="fb-screenshot"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => pickScreenshot(e.target.files?.[0] ?? null)}
              className="block w-full text-xs file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-xs file:font-medium file:text-primary-foreground hover:file:opacity-90"
            />
            {screenshot && screenshotPreview && (
              <div className="flex items-center gap-3 rounded-md border border-border bg-muted/40 p-2">
                <img
                  src={screenshotPreview}
                  alt="Förhandsvisning"
                  className="h-16 w-16 rounded object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{screenshot.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(screenshot.size / 1024).toFixed(0)} KB
                  </p>
                </div>
                <button
                  type="button"
                  onClick={clearScreenshot}
                  aria-label="Ta bort bild"
                  className="rounded-md p-1 text-muted-foreground hover:bg-background hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
          <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3">
            <Checkbox
              id="fb-anonymous"
              checked={anonymous}
              onCheckedChange={(v) => setAnonymous(v === true)}
            />
            <div className="space-y-1">
              <Label htmlFor="fb-anonymous" className="cursor-pointer">
                Skicka anonymt
              </Label>
              <p className="text-xs text-muted-foreground">
                Vi kopplar inte ärendet till ditt konto och kan inte återkoppla till dig.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={mutation.isPending}
            >
              Avbryt
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Skickar…
                </>
              ) : (
                "Skicka"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
