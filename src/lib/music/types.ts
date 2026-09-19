export type Bar = {
  symbol: string;
  piano: number[];
  bass: number;
  guitar: number[];
};

export type Groove = {
  id: string;
  name: string;
  bpm: number;
  key: string;
  scale: number[];
  pocket: Bar[];
};

export type ChairId = "low" | "mid" | "high";

export type SteelFeel =
  | "boom-chick"
  | "open-strum"
  | "travis"
  | "folk-8ths"
  | "chuck"
  | "hammer"
  | "last-fill"
  | "camp";

export type Recipe = {
  id: string;
  name: string;
  blurb: string;
  lowFrom: number;
  midFrom: number;
  highFrom: number;
  feel: SteelFeel;
};

export type PlayMode = "dry" | "steel" | "solo";

export type ChairMutes = {
  low: boolean;
  mid: boolean;
  high: boolean;
};

export const STEPS = 16;
export const TOTAL_BARS = 4;

export function chairOn(recipe: Recipe, barIndex: number, chair: ChairId): boolean {
  if (chair === "low") return barIndex >= recipe.lowFrom;
  if (chair === "mid") return barIndex >= recipe.midFrom;
  return barIndex >= recipe.highFrom;
}
