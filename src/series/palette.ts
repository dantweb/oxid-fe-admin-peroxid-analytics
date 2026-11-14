/**
 * The colours of the slices of a pie (and of its legend, on screen and in the PDF). They come from the theme tokens: the
 * brand colour gives the first hue, the page surface decides how light the slices are. The hues are 9 steps of 40
 * degrees taken in an order that puts neighbours far apart; the same 9 hues come again in three more lightness tiers,
 * which gives 36 colours that differ pairwise. Every colour is moved in lightness until it holds 3:1 against the
 * background (WCAG 1.4.11). "Others" is a neutral grey. Past 36 slices the colours repeat in order; the legend names
 * every slice, so a colour never carries a meaning alone. Pure arithmetic: tested without a browser.
 */
export type Rgb = [number, number, number];

export interface PaletteEnv {
  /** the brand colour (`--oxfe-color-primary`), as the page resolves it */
  base: Rgb;
  /** the surface the chart sits on (`--oxfe-color-surface`) */
  background: Rgb;
}

export interface SlicePalette {
  slices: Rgb[];
  others: Rgb;
}

const HUES = 9;
const TIERS = 4;
export const PALETTE_SIZE = HUES * TIERS;
/** Takes the hues in steps of 4 (of 9): neighbours are 160 degrees apart and every hue comes once. */
const HUE_ORDER_STEP = 4;
const HUE_SPACING = 40;
const CHROMA = 0.15;
const MIN_CONTRAST = 3.05;
const FALLBACK_HUE = 250;
const GREY_CHROMA = 0.02;
const LIGHT_BACKGROUND_LUMINANCE = 0.4;

/** Lightness (OKLab) of the four tiers, all inside what holds 3:1 against the background. */
const TIER_LIGHTNESS = {
  light: [0.5, 0.6, 0.42, 0.66],
  dark: [0.78, 0.68, 0.88, 0.58],
} as const;
const OTHERS_LIGHTNESS = { light: 0.58, dark: 0.7 } as const;

const channel = (value: number): number => {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const encode = (linear: number): number => {
  const c = linear <= 0.0031308 ? linear * 12.92 : 1.055 * linear ** (1 / 2.4) - 0.055;
  return c;
};

function relativeLuminance([r, g, b]: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(first: Rgb, second: Rgb): number {
  const [light, dark] = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a);
  return (light! + 0.05) / (dark! + 0.05);
}

type Lab = [number, number, number];

function toOklab([r, g, b]: Rgb): Lab {
  const [lr, lg, lb] = [channel(r), channel(g), channel(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** Linear sRGB of an OKLab colour; a channel outside 0 to 1 means the colour is outside the sRGB gamut. */
function toLinear([lightness, a, b]: Lab): [number, number, number] {
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const inGamut = (linear: number[]): boolean => linear.every((c) => c >= -0.0005 && c <= 1.0005);
const toRgb = (linear: number[]): Rgb =>
  linear.map((c) => Math.round(255 * Math.min(1, Math.max(0, encode(Math.max(0, c)))))) as Rgb;

/** The OKLab distance of two colours: about 0.02 is just visible, 0.1 and more is plainly different. */
export function deltaE(first: Rgb, second: Rgb): number {
  const [a, b] = [toOklab(first), toOklab(second)];
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function fromLightnessChroma(lightness: number, chroma: number, hue: number): Rgb {
  let reduced = chroma;
  const radians = (hue * Math.PI) / 180;
  const at = (c: number): [number, number, number] =>
    toLinear([lightness, c * Math.cos(radians), c * Math.sin(radians)]);
  while (reduced > 0 && !inGamut(at(reduced))) {
    reduced -= 0.005;
  }
  return toRgb(at(Math.max(0, reduced)));
}

/** Moves the lightness away from the background until the colour holds the contrast. */
function withContrast(lightness: number, chroma: number, hue: number, env: PaletteEnv): Rgb {
  const darkBackground = relativeLuminance(env.background) < LIGHT_BACKGROUND_LUMINANCE;
  let at = lightness;
  let colour = fromLightnessChroma(at, chroma, hue);
  while (contrastRatio(colour, env.background) < MIN_CONTRAST && at > 0 && at < 1) {
    at += darkBackground ? 0.01 : -0.01;
    colour = fromLightnessChroma(at, chroma, hue);
  }
  return colour;
}

function baseHue(base: Rgb): number {
  const [, a, b] = toOklab(base);
  if (Math.hypot(a, b) < GREY_CHROMA) {
    return FALLBACK_HUE; // a grey brand colour has no hue to start from
  }
  return ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
}

const sliceColour = (
  index: number,
  env: PaletteEnv,
  hue0: number,
  theme: 'light' | 'dark',
): Rgb => {
  const position = index % PALETTE_SIZE;
  const hue = hue0 + (((position % HUES) * HUE_ORDER_STEP) % HUES) * HUE_SPACING;
  const tier = Math.floor(position / HUES) % TIERS;
  return withContrast(TIER_LIGHTNESS[theme][tier]!, CHROMA, hue, env);
};

/** The colours of `count` slices and of "Others" (always given, so that a legend can use it). */
export function slicePalette(count: number, _hasOthers: boolean, env: PaletteEnv): SlicePalette {
  const theme = relativeLuminance(env.background) < LIGHT_BACKGROUND_LUMINANCE ? 'dark' : 'light';
  const hue0 = baseHue(env.base);
  return {
    slices: Array.from({ length: count }, (_, at) => sliceColour(at, env, hue0, theme)),
    others: withContrast(OTHERS_LIGHTNESS[theme], 0, 0, env),
  };
}

export const toCss = ([r, g, b]: Rgb): string => `rgb(${r}, ${g}, ${b})`;

/** A colour as the page resolved it (`rgb()`, `rgba()`, `#rgb`, `#rrggbb`, `color(srgb …)`); null for anything else. */
export function parseColour(text: string): Rgb | null {
  const value = text.trim().toLowerCase();
  const rgb = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/.exec(value);
  if (rgb !== null) {
    return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  }
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(value);
  if (hex !== null) {
    const digits = hex[1]!.length === 3 ? [...hex[1]!].map((d) => d + d).join('') : hex[1]!;
    return [0, 2, 4].map((at) => Number.parseInt(digits.slice(at, at + 2), 16)) as Rgb;
  }
  const srgb = /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(value);
  if (srgb !== null) {
    return [1, 2, 3].map((at) => Math.round(Number(srgb[at]) * 255)) as Rgb;
  }
  return null;
}
