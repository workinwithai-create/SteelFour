import type { Groove, Recipe } from "./types";
import { chairOn, TOTAL_BARS } from "./types";

export function punchList(groove: Groove, recipe: Recipe): string {
  const bars = Array.from({ length: TOTAL_BARS }, (_, i) => {
    const ch = groove.pocket[i]!;
    const low = chairOn(recipe, i, "low") ? "low" : "—";
    const mid = chairOn(recipe, i, "mid") ? "mid" : "—";
    const high = chairOn(recipe, i, "high") ? "high" : "—";
    return `  ${i + 1}. ${ch.symbol.padEnd(4)}  ${low.padEnd(5)} ${mid.padEnd(5)} ${high}`;
  }).join("\n");

  return `SteelFour punch list
${groove.name} · ${groove.bpm} BPM · ${groove.key} · ${recipe.name}

The problem: generators dump a beat and a vocal. The verse has no guitar.
ChickFour mutes an electric. NeedThree plants nylon with eggs and a pad.
SteelFour seats a live steel-string — boom-chick, travis, open strum — so
the vocal has a bed.

The move: ${recipe.blurb}

Four-bar pocket (drop the steel on the existing verse — do not write a new form)
bar  chord  low    mid    high
${bars}

Feel: ${recipe.feel}

Live chairs only — FluidR3 acoustic guitar steel (gleitz GM) plus PreEight
kit / piano / bass. No oscillators. Audio never leaves the tab.

Distinct from ChickFour (muted electric chicka), NeedThree (nylon / eggs / pad),
HarpFour (concert harp), OpenFour (intro walk-in), RimFour (rim-click pocket),
PivotFour (turnaround). SteelFour is the open steel-string verse bed.

Bounce the WAV of the steel chairs and drop it on the four bars of the unfinished
verse. Keep the dry pocket. A loops. B plays four and stops.`;
}
