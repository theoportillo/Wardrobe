import { describe, expect, it } from 'vitest';
import { refineAlpha } from './refineMask';

const W = 100, H = 100;
function mask(draw: (x: number, y: number) => number) {
  const a = new Uint8ClampedArray(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) a[y * W + x] = draw(x, y);
  return a;
}
const at = (a: Uint8ClampedArray, x: number, y: number) => a[y * W + x];
const inRect = (x: number, y: number, x0: number, y0: number, x1: number, y1: number) => x >= x0 && x < x1 && y >= y0 && y < y1;

describe('refineAlpha', () => {
  it('borra islas chicas del fondo y conserva la prenda', () => {
    const a = mask((x, y) => (inRect(x, y, 20, 20, 80, 80) || inRect(x, y, 2, 2, 6, 6) ? 255 : 0));
    const r = refineAlpha(a, W, H);
    expect(at(r, 50, 50)).toBe(255);
    expect(at(r, 4, 4)).toBe(0);
  });

  it('conserva dos piezas parecidas (un par de zapatillas)', () => {
    const a = mask((x, y) => (inRect(x, y, 10, 30, 40, 70) || inRect(x, y, 60, 30, 90, 70) ? 255 : 0));
    const r = refineAlpha(a, W, H);
    expect(at(r, 25, 50)).toBe(255);
    expect(at(r, 75, 50)).toBe(255);
  });

  it('rellena agujeros chicos dentro de la prenda pero no huecos grandes', () => {
    const small = mask((x, y) => (inRect(x, y, 20, 20, 80, 80) && !inRect(x, y, 48, 48, 52, 52) ? 255 : 0));
    expect(at(refineAlpha(small, W, H), 50, 50)).toBe(255);
    const big = mask((x, y) => (inRect(x, y, 10, 10, 90, 90) && !inRect(x, y, 30, 30, 70, 70) ? 255 : 0));
    expect(at(refineAlpha(big, W, H), 50, 50)).toBe(0);
  });

  it('limpia la neblina semitransparente', () => {
    const a = mask((x, y) => (inRect(x, y, 20, 20, 80, 80) ? 250 : 30));
    const r = refineAlpha(a, W, H);
    expect(at(r, 50, 50)).toBe(255);
    expect(at(r, 5, 50)).toBe(0);
  });

  it('suaviza solo el borde', () => {
    const r = refineAlpha(mask((x, y) => (inRect(x, y, 20, 20, 80, 80) ? 255 : 0)), W, H);
    const edge = at(r, 20, 50);
    expect(edge).toBeGreaterThan(0);
    expect(edge).toBeLessThan(255);
    expect(at(r, 21, 50)).toBe(255);
  });
});
