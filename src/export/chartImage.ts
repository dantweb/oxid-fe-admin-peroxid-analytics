/**
 * A chart as a PNG for the PDF: the SVG of the page is cloned, the colours it takes from theme tokens (`var(--oxfe-…)`)
 * are written into the clone as the computed, resolved values (an SVG drawn as an image cannot see the page's CSS), and
 * the result is drawn on a canvas at twice the resolution. The bars of a ranking are HTML, not SVG: `barsSvg` draws the
 * same bars as an SVG from colours the page has resolved.
 */
export interface ChartPng {
  dataUrl: string;
  width: number;
  height: number;
}

interface StyleReader {
  getPropertyValue(name: string): string;
}

/** What an SVG needs to look the same as on the page. */
const PROPERTIES = [
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-linejoin',
  'stroke-linecap',
  'opacity',
  'font-family',
  'font-size',
  'font-weight',
  'text-anchor',
];

const DEFAULT_SCALE = 2;
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

/** Writes the computed value of each property of every element of `original` into the same element of `clone`. */
export function inlineComputedStyles(
  original: Element,
  clone: Element,
  styleOf: (element: Element) => StyleReader = (element) => getComputedStyle(element),
): void {
  const from = [original, ...Array.from(original.querySelectorAll('*'))];
  const to = [clone, ...Array.from(clone.querySelectorAll('*'))];
  from.forEach((element, at) => {
    const style = styleOf(element);
    const declarations = PROPERTIES.map((name) => [name, style.getPropertyValue(name)] as const)
      .filter(([, value]) => value !== '')
      .map(([name, value]) => `${name}: ${value}`);
    if (declarations.length > 0) {
      to[at]!.setAttribute('style', declarations.join('; '));
    }
  });
}

/** The size of the PNG: the viewBox (or width and height) times the scale. */
export function pngSize(svg: Element, scale: number): { width: number; height: number } {
  const box = (svg.getAttribute('viewBox') ?? '').split(/[\s,]+/).map(Number);
  const [width, height] =
    box.length === 4 && box.every(Number.isFinite)
      ? [box[2]!, box[3]!]
      : [Number(svg.getAttribute('width')), Number(svg.getAttribute('height'))];
  return { width: Math.round(width! * scale), height: Math.round(height! * scale) };
}

export interface BarColours {
  fill: string;
  muted: string;
  text: string;
  track: string;
}

export interface BarImageRow {
  label: string;
  valueText: string;
  share: number;
  kind: 'item' | 'others';
}

const BAR_WIDTH = 900;
const BAR_ROW = 34;
const BAR_PAD = 12;

/** The bars of a ranking as an SVG: a label above each bar, the value and share at its right end. Literal colours only.
 * Built with DOM calls: peroxid-admin requires Trusted Types, so no markup string is parsed. */
export function barsSvg(rows: readonly BarImageRow[], colours: BarColours): SVGSVGElement {
  const widest = Math.max(...rows.map((row) => row.share), 0);
  const trackWidth = BAR_WIDTH - 2 * BAR_PAD;
  const height = BAR_PAD * 2 + rows.length * BAR_ROW;
  const svg = svgElement('svg', {
    viewBox: `0 0 ${BAR_WIDTH} ${height}`,
    width: BAR_WIDTH,
    height,
  });
  rows.forEach((row, at) => {
    const top = BAR_PAD + at * BAR_ROW;
    const width = widest > 0 ? (row.share / widest) * trackWidth : 0;
    const fill = row.kind === 'others' ? colours.muted : colours.fill;
    const text = { 'font-size': 12, 'font-family': 'sans-serif', fill: colours.text, y: top + 11 };
    svg.append(
      svgText(row.label, { ...text, x: BAR_PAD }),
      svgText(row.valueText, {
        ...text,
        x: BAR_WIDTH - BAR_PAD,
        'font-weight': 'bold',
        'text-anchor': 'end',
      }),
      svgElement('rect', {
        x: BAR_PAD,
        y: top + 16,
        width: trackWidth,
        height: 10,
        rx: 3,
        fill: colours.track,
      }),
      svgElement('rect', {
        'data-bar': '',
        x: BAR_PAD,
        y: top + 16,
        width,
        height: 10,
        rx: 3,
        fill,
      }),
    );
  });
  return svg;
}

function svgElement<K extends keyof SVGElementTagNameMap>(
  name: K,
  attributes: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NAMESPACE, name);
  for (const [key, value] of Object.entries(attributes)) {
    element.setAttribute(key, String(value));
  }
  return element;
}

function svgText(content: string, attributes: Record<string, string | number>): SVGTextElement {
  const text = svgElement('text', attributes);
  text.textContent = content;
  return text;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('the chart could not be drawn as an image'));
    image.src = url;
  });
}

/** The background the chart sits on: the first opaque one up the tree, else white. */
function backgroundOf(element: Element): string {
  for (let node: Element | null = element; node !== null; node = node.parentElement) {
    const colour = getComputedStyle(node).backgroundColor;
    if (colour !== '' && colour !== 'transparent' && colour !== 'rgba(0, 0, 0, 0)') {
      return colour;
    }
  }
  return '#ffffff';
}

/** Draws an SVG of the page as a PNG at `scale` times its size, on the colour of the page behind it. */
export async function svgToPng(svg: SVGSVGElement, scale = DEFAULT_SCALE): Promise<ChartPng> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  inlineComputedStyles(svg, clone);
  const { width, height } = pngSize(svg, scale);
  clone.setAttribute('xmlns', SVG_NAMESPACE);
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  const markup = new XMLSerializer().serializeToString(clone);
  const image = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (context === null) {
    throw new Error('no canvas');
  }
  context.fillStyle = backgroundOf(svg);
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  return { dataUrl: canvas.toDataURL('image/png'), width, height };
}

/** The bars of a ranking as a PNG: drawn as SVG from the colours the page resolved, then like any chart. */
export async function barsToPng(
  rows: readonly BarImageRow[],
  colours: BarColours,
  scale = DEFAULT_SCALE,
): Promise<ChartPng> {
  const svg = barsSvg(rows, colours);
  document.body.append(svg); // in the page's document, so that it is measured and styled like any element
  try {
    return await svgToPng(svg, scale);
  } finally {
    svg.remove();
  }
}
