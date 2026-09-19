import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Download, Square } from "lucide-react";
import { toast, Toaster } from "sonner";
import { collectSteelMidi, createEngine } from "@/lib/audio/engine";
import { encodeSteelMidi } from "@/lib/midi/export";
import { GROOVES, chordAt } from "@/lib/music/grooves";
import { punchList } from "@/lib/music/punch";
import { RECIPES } from "@/lib/music/recipes";
import type { ChairMutes, Groove, PlayMode, Recipe } from "@/lib/music/types";
import { TOTAL_BARS, chairOn } from "@/lib/music/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "steelfour-desk-v1";
const STRING_MIDI = [40, 45, 50, 55, 59, 64];

type Prefs = { grooveId: string; recipeId: string; mutes: ChairMutes };

function loadPrefs(): Prefs | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Prefs) : null;
  } catch {
    return null;
  }
}

function savePrefs(grooveId: string, recipeId: string, mutes: ChairMutes) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ grooveId, recipeId, mutes }));
  } catch {
    /* ignore quota */
  }
}

function nearestString(midi: number): number {
  let best = 0;
  let dist = 99;
  STRING_MIDI.forEach((n, i) => {
    const d = Math.abs(n - midi);
    if (d < dist) {
      dist = d;
      best = i;
    }
  });
  return best;
}

export function DeskApp() {
  const prefs = useMemo(() => loadPrefs(), []);
  const [groove, setGroove] = useState<Groove>(() => {
    const found = GROOVES.find((g) => g.id === prefs?.grooveId);
    return found ?? GROOVES[0]!;
  });
  const [recipe, setRecipe] = useState<Recipe>(() => {
    const found = RECIPES.find((r) => r.id === prefs?.recipeId);
    return found ?? RECIPES[0]!;
  });
  const [mutes, setMutes] = useState<ChairMutes>(
    () => prefs?.mutes ?? { low: false, mid: false, high: false },
  );
  const [status, setStatus] = useState("Seating the steel");
  const [playing, setPlaying] = useState(false);
  const [mode, setMode] = useState<PlayMode | null>(null);
  const [bar, setBar] = useState<number | null>(null);
  const [bouncing, setBouncing] = useState(false);
  const [lit, setLit] = useState<number[]>(() => Array.from({ length: STRING_MIDI.length }, () => 0));
  const engineRef = useRef<ReturnType<typeof createEngine> | null>(null);

  useEffect(() => {
    const engine = createEngine();
    engineRef.current = engine;
    const unsub = engine.subscribe({
      onBar: setBar,
      onPlaying: (nextPlaying, nextMode) => {
        setPlaying(nextPlaying);
        setMode(nextMode);
      },
      onStatus: setStatus,
      onHit: (midi) => {
        const idx = nearestString(midi);
        setLit((prev) => {
          const next = [...prev];
          next[idx] = 1;
          return next;
        });
        window.setTimeout(() => {
          setLit((prev) => {
            const next = [...prev];
            next[idx] = Math.min(next[idx] ?? 0, 0.18);
            return next;
          });
        }, 160);
      },
    });
    void engine.preload();
    return () => {
      unsub();
      engine.stop();
    };
  }, []);

  useEffect(() => {
    savePrefs(groove.id, recipe.id, mutes);
    engineRef.current?.setMutes(mutes);
  }, [groove.id, recipe.id, mutes]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
      if (event.key === "a" || event.key === "A") {
        event.preventDefault();
        void engineRef.current?.play("dry", groove, recipe);
      } else if (event.key === "b" || event.key === "B" || event.key === " ") {
        event.preventDefault();
        void engineRef.current?.play("steel", groove, recipe);
      } else if (event.key === "4") {
        event.preventDefault();
        void engineRef.current?.play("solo", groove, recipe);
      } else if (event.key === "l" || event.key === "L") {
        event.preventDefault();
        setMutes((m) => ({ ...m, low: !m.low }));
      } else if (event.key === "m" || event.key === "M") {
        event.preventDefault();
        setMutes((m) => ({ ...m, mid: !m.mid }));
      } else if (event.key === "h" || event.key === "H") {
        event.preventDefault();
        setMutes((m) => ({ ...m, high: !m.high }));
      } else if (event.key === "Escape") {
        event.preventDefault();
        engineRef.current?.stop();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [groove, recipe]);

  const punch = punchList(groove, recipe);
  const steelEvents = collectSteelMidi(groove, recipe, mutes).length;

  async function copyPunch() {
    try {
      await navigator.clipboard.writeText(punch);
      toast("Punch list copied");
    } catch {
      toast("Select the punch list and copy");
    }
  }

  async function downloadWav() {
    const engine = engineRef.current;
    if (!engine) return;
    setBouncing(true);
    try {
      const blob = await engine.bounceSteel(groove, recipe);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `steelfour-${groove.id}-${recipe.id}.wav`;
      a.click();
      URL.revokeObjectURL(url);
      toast("Four-bar steel WAV ready");
    } catch (err) {
      console.error(err);
      toast("Could not bounce the steel");
    } finally {
      setBouncing(false);
    }
  }

  function downloadMidi() {
    const blob = encodeSteelMidi(groove, recipe, mutes);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `steelfour-${groove.id}-${recipe.id}.mid`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Steel MIDI ready");
  }

  return (
    <div className="min-h-dvh bg-bg text-fg">
      <Toaster
        theme="dark"
        position="top-center"
        toastOptions={{
          className: "border-line bg-surface text-fg",
        }}
      />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 pb-36 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-start gap-4">
            <Mark />
            <div>
              <p className="text-xs font-medium tracking-widest text-muted uppercase">
                workinwithai
              </p>
              <h1 className="font-display text-4xl leading-tight tracking-tight italic sm:text-5xl">
                SteelFour
              </h1>
              <p className="mt-1 max-w-lg text-sm text-muted">
                Four bars of live steel-string so the verse has a bed. Boom-chick,
                travis, open strum. No oscillators.
              </p>
            </div>
          </div>
          <p className="font-mono text-xs text-subtle tabular-nums">{status}</p>
        </header>

        <NeckField lit={lit} playing={playing} />

        <section className="rounded-xl border border-line bg-surface p-4 sm:p-5">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-medium text-muted">Pocket</h2>
            <p className="font-mono text-xs text-subtle">4 bars · L boom · M inner · H treble</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Array.from({ length: TOTAL_BARS }, (_, i) => {
              const ch = chordAt(groove, i);
              const active = playing && bar === i;
              const low = chairOn(recipe, i, "low") && !mutes.low;
              const mid = chairOn(recipe, i, "mid") && !mutes.mid;
              const high = chairOn(recipe, i, "high") && !mutes.high;
              const needed = low || mid || high;
              return (
                <div
                  key={i}
                  className={cn(
                    "flex min-h-24 flex-col justify-between rounded-md border px-3 py-3 transition-[border-color,background-color] duration-150",
                    needed ? "border-steel/40 bg-steel/10" : "border-line bg-surface-2",
                    active && "border-accent bg-accent text-accent-fg",
                  )}
                >
                  <span
                    className={cn(
                      "font-mono text-xs tabular-nums",
                      active ? "text-accent-fg" : needed ? "text-steel" : "text-subtle",
                    )}
                  >
                    {i + 1}
                  </span>
                  <span className="font-display text-2xl leading-none">{ch.symbol}</span>
                  <span
                    className={cn(
                      "mt-1 flex gap-2 font-mono text-xs",
                      active ? "text-accent-fg/80" : "text-subtle",
                    )}
                  >
                    <ChairDot on={low} label="L" />
                    <ChairDot on={mid} label="M" />
                    <ChairDot on={high} label="H" />
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border border-line bg-surface p-4 sm:p-5">
          <h2 className="mb-3 text-sm font-medium text-muted">Registers</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            <ChairToggle
              label="Boom"
              kbd="L"
              blurb="Bass strings. The 1 and 3."
              on={!mutes.low}
              onClick={() => setMutes((m) => ({ ...m, low: !m.low }))}
            />
            <ChairToggle
              label="Inner"
              kbd="M"
              blurb="Middle strings of the strum"
              on={!mutes.mid}
              onClick={() => setMutes((m) => ({ ...m, mid: !m.mid }))}
            />
            <ChairToggle
              label="Treble"
              kbd="H"
              blurb="High string, hammer, fill"
              on={!mutes.high}
              onClick={() => setMutes((m) => ({ ...m, high: !m.high }))}
            />
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-6">
            <Picker
              label="Groove"
              items={GROOVES.map((g) => ({
                id: g.id,
                title: g.name,
                meta: `${g.bpm} BPM · ${g.key}`,
                on: groove.id === g.id,
                onClick: () => setGroove(g),
              }))}
            />
            <Picker
              label="Steel recipe"
              items={RECIPES.map((r) => ({
                id: r.id,
                title: r.name,
                meta: r.blurb,
                on: recipe.id === r.id,
                onClick: () => setRecipe(r),
              }))}
            />
          </div>

          <section className="flex flex-col rounded-xl border border-line bg-surface p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-medium text-muted">Punch list</h2>
              <Button variant="ghost" size="sm" onClick={() => void copyPunch()}>
                <Copy className="size-3.5" />
                Copy
              </Button>
            </div>
            <pre className="max-h-96 flex-1 overflow-auto whitespace-pre-wrap rounded-md bg-bg p-4 font-mono text-xs leading-relaxed text-fg/90">
              {punch}
            </pre>
            <p className="mt-3 font-mono text-xs text-subtle tabular-nums">
              {steelEvents} live steel events in this stamp
            </p>
          </section>
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/95 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:px-4 sm:py-3">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-1.5 sm:gap-2">
          <Button
            variant={mode === "dry" ? "default" : "outline"}
            size="sm"
            className="sm:h-11 sm:px-4 sm:text-sm"
            onClick={() => void engineRef.current?.play("dry", groove, recipe)}
          >
            A · Dry
          </Button>
          <Button
            variant={mode === "steel" ? "steel" : "outline"}
            size="sm"
            className="sm:h-11 sm:px-4 sm:text-sm"
            onClick={() => void engineRef.current?.play("steel", groove, recipe)}
          >
            B · Steel
          </Button>
          <Button
            variant={mode === "solo" ? "steel" : "outline"}
            size="sm"
            className="sm:h-11 sm:px-4 sm:text-sm"
            onClick={() => void engineRef.current?.play("solo", groove, recipe)}
          >
            4 · Steel only
          </Button>
          <Button variant="ghost" size="sm" className="sm:h-11 sm:px-4 sm:text-sm" onClick={() => engineRef.current?.stop()} aria-label="Stop">
            <Square className="size-3.5 fill-current sm:size-4" />
            Stop
          </Button>
          <div className="ml-auto flex flex-wrap items-center gap-1.5 sm:gap-2">
            <Button variant="outline" size="sm" className="sm:h-11 sm:px-4 sm:text-sm" onClick={downloadMidi}>
              MIDI
            </Button>
            <Button variant="outline" size="sm" className="sm:h-11 sm:px-4 sm:text-sm" onClick={() => void downloadWav()} disabled={bouncing}>
              <Download className="size-3.5 sm:size-4" />
              {bouncing ? "Bouncing" : "WAV steel"}
            </Button>
          </div>
        </div>
      </nav>
    </div>
  );
}

function NeckField({ lit, playing }: { lit: number[]; playing: boolean }) {
  return (
    <section
      className="overflow-hidden rounded-xl border border-line bg-surface px-4 pt-5 pb-3 sm:px-8"
      aria-hidden="true"
    >
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-muted">Strings</h2>
        <p className="font-mono text-xs text-subtle">{playing ? "live" : "seated"}</p>
      </div>
      <div className="flex h-32 flex-col justify-between py-2 sm:h-40">
        {lit.map((amount, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="w-6 font-mono text-[10px] text-subtle tabular-nums">
              {["E", "A", "D", "G", "B", "e"][i]}
            </span>
            <div
              className="h-px flex-1 origin-left rounded-full"
              style={{
                backgroundColor: amount > 0.3 ? "var(--color-accent)" : "var(--color-steel)",
                opacity: 0.28 + amount * 0.72,
                height: i < 3 ? 2 : 1,
                transition:
                  "opacity 150ms cubic-bezier(0.23, 1, 0.32, 1), background-color 150ms",
              }}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function ChairDot({ on, label }: { on: boolean; label: string }) {
  return (
    <span className={cn("inline-flex min-w-3 justify-center", on ? "opacity-100" : "opacity-25")}>
      {label}
    </span>
  );
}

function ChairToggle({
  label,
  kbd,
  blurb,
  on,
  onClick,
}: {
  label: string;
  kbd: string;
  blurb: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-14 rounded-lg border px-4 py-3 text-left transition-[border-color,background-color] duration-150",
        on ? "border-steel/50 bg-steel/15" : "border-line bg-surface-2 text-muted",
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        <span className="font-mono text-xs text-subtle">{kbd}</span>
      </div>
      <p className="mt-0.5 text-xs text-muted">{blurb}</p>
    </button>
  );
}

function Mark() {
  return (
    <svg viewBox="0 0 48 48" className="mt-1 size-12 shrink-0" aria-hidden="true">
      <rect width="48" height="48" rx="12" className="fill-surface-2" />
      <ellipse cx="16" cy="24" rx="7" ry="11" className="stroke-steel" fill="none" strokeWidth="1.5" />
      <path d="M22 16.5 H38" className="stroke-fg" strokeWidth="1.2" />
      <path d="M22 20.5 H38" className="stroke-steel" strokeWidth="1.1" />
      <path d="M22 24.5 H38" className="stroke-fg" strokeWidth="1" />
      <path d="M22 28 H38" className="stroke-steel" strokeWidth="0.9" />
      <path d="M22 31.2 H38" className="stroke-accent" strokeWidth="0.8" />
    </svg>
  );
}

function Picker({
  label,
  items,
}: {
  label: string;
  items: { id: string; title: string; meta: string; on: boolean; onClick: () => void }[];
}) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-medium text-muted">{label}</h2>
      <div className="grid gap-2">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={item.onClick}
            className={cn(
              "min-h-11 rounded-lg border px-4 py-3 text-left transition-[border-color,background-color] duration-150",
              item.on
                ? "border-accent bg-accent text-accent-fg"
                : "border-line bg-surface hover:bg-surface-2",
            )}
          >
            <div className="text-sm font-medium">{item.title}</div>
            <div className={cn("mt-0.5 text-xs", item.on ? "text-accent-fg/80" : "text-muted")}>
              {item.meta}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
