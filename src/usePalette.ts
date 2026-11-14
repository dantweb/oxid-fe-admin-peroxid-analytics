import { computed, onBeforeUnmount, onMounted, ref, type ComputedRef } from 'vue';
import { parseColour, slicePalette, toCss, type PaletteEnv, type Rgb } from './series/palette';

/** Used when the page cannot be asked (no browser styles): the colours of the classic light theme. */
const FALLBACK: PaletteEnv = { base: [36, 113, 163], background: [255, 255, 255] };

/** What a token resolves to on the page: a probe element takes the token as its colour, the browser resolves it. */
function resolveToken(token: string, fallback: Rgb): Rgb {
  const probe = document.createElement('span');
  probe.style.color = `var(${token})`;
  probe.hidden = true;
  document.body.append(probe);
  const resolved = parseColour(getComputedStyle(probe).color);
  probe.remove();
  return resolved ?? fallback;
}

/** The brand colour and the surface of the page as the theme in force defines them. */
function readPaletteEnv(): PaletteEnv {
  return {
    base: resolveToken('--oxfe-color-primary', FALLBACK.base),
    background: resolveToken('--oxfe-color-surface', FALLBACK.background),
  };
}

export interface ChartColours {
  /** one colour per ranked item, in order (`rgb()`) */
  slices: string[];
  others: string;
  slicesRgb: Rgb[];
  othersRgb: Rgb;
}

/**
 * The colours of the slices of a chart, from the theme tokens and recomputed when the theme changes (the theme is a
 * `data-theme` attribute or a stylesheet link of the document). The pie, its legend and the PDF all read the same colours.
 */
export function usePalette(count: () => number): ComputedRef<ChartColours> {
  const theme = ref(0);
  let observer: MutationObserver | null = null;
  onMounted(() => {
    observer = new MutationObserver(() => (theme.value += 1));
    observer.observe(document.documentElement, { attributes: true });
    observer.observe(document.head, { attributes: true, childList: true, subtree: true });
  });
  onBeforeUnmount(() => observer?.disconnect());
  return computed(() => {
    void theme.value;
    const palette = slicePalette(count(), true, readPaletteEnv());
    return {
      slices: palette.slices.map(toCss),
      others: toCss(palette.others),
      slicesRgb: palette.slices,
      othersRgb: palette.others,
    };
  });
}
