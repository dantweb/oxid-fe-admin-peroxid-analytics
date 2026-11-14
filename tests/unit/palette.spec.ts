import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  deltaE,
  parseColour,
  PALETTE_SIZE,
  slicePalette,
  toCss,
  type PaletteEnv,
  type Rgb,
} from '../../src/series/palette';

/** The theme tokens of PEROXID light and dark as the palette reads them: the brand colour and the page surface. */
const LIGHT: PaletteEnv = { base: [190, 4, 193], background: [255, 255, 255] };
const DARK: PaletteEnv = { base: [242, 156, 244], background: [39, 26, 40] };
const MIN_DISTANCE = 0.06; // OKLab distance: two slices this far apart are told apart at a glance
const MIN_CONTRAST = 3; // WCAG 1.4.11, a graphic against its background

describe('parseColour', () => {
  it.each([
    ['rgb(190, 4, 193)', [190, 4, 193]],
    ['rgba(1, 2, 3, 0.5)', [1, 2, 3]],
    ['#be04c1', [190, 4, 193]],
    [' #BE04C1 ', [190, 4, 193]],
    ['#fff', [255, 255, 255]],
    ['color(srgb 1 0.5 0)', [255, 128, 0]],
  ])('reads %s', (text, rgb) => {
    expect(parseColour(text)).toEqual(rgb);
  });

  it('is null for what it cannot read (transparent, a keyword, nothing)', () => {
    expect(parseColour('transparent')).toBeNull();
    expect(parseColour('red')).toBeNull();
    expect(parseColour('')).toBeNull();
  });
});

describe('contrastRatio and deltaE', () => {
  it('knows black on white (21) and a colour against itself (1)', () => {
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 1);
    expect(contrastRatio([10, 20, 30], [10, 20, 30])).toBeCloseTo(1, 5);
  });

  it('is 0 for the same colour and larger for colours that differ more', () => {
    expect(deltaE([10, 20, 30], [10, 20, 30])).toBe(0);
    expect(deltaE([255, 0, 0], [0, 0, 255])).toBeGreaterThan(deltaE([255, 0, 0], [250, 10, 10]));
  });
});

describe.each([
  ['light', LIGHT],
  ['dark', DARK],
])('slicePalette on the %s theme', (_name, env) => {
  const palette = slicePalette(20, true, env);
  const all: Rgb[] = [...palette.slices, palette.others];

  it('gives 20 slices and "Others" a colour each', () => {
    expect(palette.slices).toHaveLength(20);
    expect(all).toHaveLength(21);
  });

  it('every colour differs clearly from every other, pairwise', () => {
    const closest = Math.min(...all.flatMap((a, i) => all.slice(i + 1).map((b) => deltaE(a, b))));

    expect(closest).toBeGreaterThanOrEqual(MIN_DISTANCE);
  });

  it('every colour holds 3:1 against the background', () => {
    for (const colour of all) {
      expect(contrastRatio(colour, env.background)).toBeGreaterThanOrEqual(MIN_CONTRAST);
    }
  });

  it('neighbouring slices are well apart, not just different', () => {
    for (let at = 1; at < palette.slices.length; at += 1) {
      expect(deltaE(palette.slices[at - 1]!, palette.slices[at]!)).toBeGreaterThanOrEqual(0.1);
    }
  });

  it('"Others" is a neutral grey', () => {
    const [r, g, b] = palette.others;

    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThanOrEqual(3);
  });
});

describe('slicePalette rules', () => {
  it('starts at the hue of the brand colour', () => {
    const first = slicePalette(1, false, LIGHT).slices[0]!;
    const [r, g, b] = first;

    expect(r).toBeGreaterThan(g); // magenta-ish, like the base
    expect(b).toBeGreaterThan(g);
  });

  it('is the same for the same input, and has no "Others" colour when there is no others slice', () => {
    expect(slicePalette(5, true, LIGHT)).toEqual(slicePalette(5, true, LIGHT));
    expect(slicePalette(5, false, LIGHT).others).toEqual(slicePalette(5, true, LIGHT).others);
  });

  it('a shorter list is the beginning of a longer one: a slice keeps its colour when N grows', () => {
    expect(slicePalette(5, false, DARK).slices).toEqual(
      slicePalette(20, false, DARK).slices.slice(0, 5),
    );
  });

  it('the palette has 36 distinct colours (9 hues in 4 lightness tiers); after that the colours repeat in order', () => {
    const palette = slicePalette(40, true, LIGHT);

    expect(PALETTE_SIZE).toBe(36);
    expect(new Set(palette.slices.slice(0, PALETTE_SIZE).map(toCss)).size).toBe(PALETTE_SIZE);
    expect(palette.slices[PALETTE_SIZE]).toEqual(palette.slices[0]);
    expect(palette.slices[39]).toEqual(palette.slices[3]);
  });

  it('works with a grey brand colour and a background it cannot read', () => {
    const grey = slicePalette(8, true, { base: [128, 128, 128], background: [255, 255, 255] });

    expect(grey.slices).toHaveLength(8);
    expect(new Set(grey.slices.map(toCss)).size).toBe(8);
  });

  it('writes a colour as css', () => {
    expect(toCss([190, 4, 193])).toBe('rgb(190, 4, 193)');
  });
});
