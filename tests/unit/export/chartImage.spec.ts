import { describe, expect, it, vi } from 'vitest';
import { barsSvg, inlineComputedStyles, pngSize } from '../../../src/export/chartImage';

const parse = (markup: string): SVGSVGElement =>
  new DOMParser().parseFromString(markup, 'image/svg+xml')
    .documentElement as unknown as SVGSVGElement;

describe('inlineComputedStyles', () => {
  const markup =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"><path class="line" d="M0 0L10 10"/><text class="tick">1</text></svg>';

  it('writes the computed (resolved) colours into the clone, so no var(--…) is left for the image to resolve', () => {
    const original = parse(markup);
    const clone = original.cloneNode(true) as SVGSVGElement;
    const computed: Record<string, Record<string, string>> = {
      path: { fill: 'none', stroke: 'rgb(190, 4, 193)', 'stroke-width': '2px' },
      text: { fill: 'rgb(111, 79, 112)', 'font-size': '11px', 'font-family': 'Roboto' },
    };

    inlineComputedStyles(original, clone, (element) => ({
      getPropertyValue: (name: string) => computed[element.tagName.toLowerCase()]?.[name] ?? '',
    }));

    expect(clone.querySelector('path')!.getAttribute('style')).toContain(
      'stroke: rgb(190, 4, 193)',
    );
    expect(clone.querySelector('path')!.getAttribute('style')).toContain('stroke-width: 2px');
    expect(clone.querySelector('text')!.getAttribute('style')).toContain('fill: rgb(111, 79, 112)');
    expect(new XMLSerializer().serializeToString(clone)).not.toContain('var(--');
    expect(original.querySelector('path')!.getAttribute('style')).toBeNull();
  });

  it('leaves out a property the element does not have', () => {
    const original = parse(markup);
    const clone = original.cloneNode(true) as SVGSVGElement;

    inlineComputedStyles(original, clone, () => ({ getPropertyValue: () => '' }));

    expect(clone.querySelector('path')!.getAttribute('style')).toBeNull();
  });
});

describe('pngSize', () => {
  it('is the viewBox at twice the resolution', () => {
    expect(
      pngSize(parse('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 320"/>'), 2),
    ).toEqual({
      width: 1280,
      height: 640,
    });
  });

  it('falls back to the width and height attributes without a viewBox', () => {
    expect(
      pngSize(parse('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="100"/>'), 2),
    ).toEqual({
      width: 600,
      height: 200,
    });
  });
});

describe('barsSvg', () => {
  const colours = {
    fill: 'rgb(1, 2, 3)',
    muted: 'rgb(9, 9, 9)',
    text: 'rgb(0, 0, 0)',
    track: 'rgb(200, 200, 200)',
  };
  const rows = [
    { label: 'Alpha', valueText: '€30.00 · 50.0 %', share: 50, kind: 'item' as const },
    { label: 'Others', valueText: '€30.00 · 50.0 %', share: 25, kind: 'others' as const },
  ];

  it('draws one labelled bar per row, the longest filling the track, with literal colours only', () => {
    const svg = barsSvg(rows, colours);
    const markup = new XMLSerializer().serializeToString(svg);

    expect(svg.querySelectorAll('rect[data-bar]')).toHaveLength(2);
    expect(markup).not.toContain('var(--');
    expect(svg.querySelectorAll('text')).toHaveLength(4); // label and value of each row
    const widths = Array.from(svg.querySelectorAll('rect[data-bar]')).map((rect) =>
      Number(rect.getAttribute('width')),
    );
    expect(widths[1]).toBeCloseTo(widths[0]! / 2, 1);
    expect(svg.querySelector('rect[data-bar]')!.getAttribute('fill')).toBe('rgb(1, 2, 3)');
    expect(svg.querySelectorAll('rect[data-bar]')[1]!.getAttribute('fill')).toBe('rgb(9, 9, 9)');
  });

  it('keeps the labels as text', () => {
    const svg = barsSvg([{ ...rows[0]!, label: 'A & <B>' }], colours);

    expect(svg.querySelector('text')!.textContent).toBe('A & <B>');
    expect(svg.querySelectorAll('B')).toHaveLength(0);
  });

  it('is built with DOM calls, not parsed from a string (the admin requires Trusted Types)', () => {
    const parse = vi.spyOn(DOMParser.prototype, 'parseFromString');

    const svg = barsSvg(rows, colours);

    expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg');
    expect(parse).not.toHaveBeenCalled();
    parse.mockRestore();
  });
});
