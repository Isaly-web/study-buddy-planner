import { useEffect, useRef, useState } from "react";
import { createParser } from "eventsource-parser";
import { Button } from "@/components/ui/button";
import { Loader2, Pause, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { track } from "@/lib/analytics";

type State = "idle" | "loading" | "playing" | "paused" | "done" | "error";

export function PodcastPlayer({ text, intro }: { text: string; intro?: string }) {
  const [state, setState] = useState<State>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const playheadRef = useRef(0);
  const pendingRef = useRef<Uint8Array>(new Uint8Array(0));

  useEffect(() => () => stop(), []);

  const stop = () => {
    try {
      abortRef.current?.abort();
    } catch {}
    try {
      ctxRef.current?.close();
    } catch {}
    ctxRef.current = null;
    abortRef.current = null;
    playheadRef.current = 0;
    pendingRef.current = new Uint8Array(0);
  };

  const play = async () => {
    if (state === "playing") {
      await ctxRef.current?.suspend();
      setState("paused");
      return;
    }
    if (state === "paused" && ctxRef.current) {
      await ctxRef.current.resume();
      setState("playing");
      return;
    }

    setState("loading");
    setMessage(null);
    track("podcast_played", { text_length: text.length });
    // Städa upp eventuell tidigare context (annars läcker vi en suspended AudioContext).
    stop();
    const ctx = new AudioContext({ sampleRate: 24000 });
    ctxRef.current = ctx;
    if (ctx.state === "suspended") await ctx.resume().catch(() => {});
    playheadRef.current = 0;
    pendingRef.current = new Uint8Array(0);

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error("no session");

      const res = await fetch("/api/lesson-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: intro ? `${intro}\n\n${text}` : text }),
        signal: abort.signal,
      });
      if (!res.ok || !res.body) throw new Error(`status ${res.status}`);
      setState("playing");

      const feed = (bytes: Uint8Array) => {
        const merged = new Uint8Array(pendingRef.current.length + bytes.length);
        merged.set(pendingRef.current);
        merged.set(bytes, pendingRef.current.length);
        const usable = merged.length - (merged.length % 2);
        pendingRef.current = merged.slice(usable);
        if (!usable) return;
        const samples = new Int16Array(merged.buffer, 0, usable / 2);
        const floats = Float32Array.from(samples, (s) => s / 32768);
        const buffer = ctx.createBuffer(1, floats.length, 24000);
        buffer.copyToChannel(floats, 0);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        if (playheadRef.current === 0) playheadRef.current = ctx.currentTime + 0.05;
        else playheadRef.current = Math.max(playheadRef.current, ctx.currentTime);
        source.start(playheadRef.current);
        playheadRef.current += buffer.duration;
      };

      const parser = createParser({
        onEvent(ev) {
          let payload: { type?: string; audio?: string };
          try {
            payload = JSON.parse(ev.data);
          } catch {
            return;
          }
          if (payload.type !== "speech.audio.delta" || !payload.audio) return;
          const binary = atob(payload.audio);
          const arr = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
          feed(arr);
        },
      });

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        parser.feed(value);
      }
      // Behåll "paused" om användaren pausade under buffringen – annars förlorar vi platsen.
      setState((s) => (s === "paused" ? s : "done"));
    } catch (err: any) {
      if (abort.signal.aborted) return;
      setState("error");
      setMessage("Kunde inte spela upp ljudet.");
    }
  };

  return (
    <div className="rounded-md border bg-background p-2">
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={play} disabled={state === "loading"}>
          {state === "loading" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : state === "playing" ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
          {state === "playing" ? "Paus" : state === "paused" ? "Fortsätt" : state === "done" ? "Spela igen" : "Spela"}
        </Button>
        <span className="text-xs text-muted-foreground">
          {state === "loading"
            ? "Genererar mikropodd…"
            : state === "playing"
              ? "Spelar…"
              : state === "done"
                ? "Klart"
                : state === "error"
                  ? (message ?? "Fel")
                  : "Mikropodd"}
        </span>
      </div>
    </div>
  );
}