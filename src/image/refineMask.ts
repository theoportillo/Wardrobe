/**
 * Limpieza de la máscara que devuelve el modelo. Puro (trabaja sobre arrays) para poder testearlo.
 *
 * 1. Contraste del alfa: lo casi transparente pasa a 0 y lo casi opaco a 255 (menos "neblina").
 * 2. Islas: se quedan solo las manchas grandes (la prenda; o las dos de un par de zapatillas).
 *    Así desaparecen restos del fondo (pliegues de la sábana, una esquina del piso, etc.).
 * 3. Agujeros: huecos chicos dentro de la prenda (estampas o brillos que el modelo "comió") se rellenan.
 * 4. Suavizado de 1 px en el borde para que no quede serruchado.
 */
export interface RefineOptions {
  /** Una isla se conserva si mide al menos esta fracción de la más grande. */
  keepIslandRatio?: number;
  /** Un hueco interno se rellena si mide menos que esta fracción del área de la prenda. */
  fillHoleRatio?: number;
}

export function refineAlpha(alpha: Uint8ClampedArray | Uint8Array, w: number, h: number, opts: RefineOptions = {}): Uint8ClampedArray {
  const keepIslandRatio = opts.keepIslandRatio ?? 0.12;
  const fillHoleRatio = opts.fillHoleRatio ?? 0.15;
  const n = w * h;
  const a = new Uint8ClampedArray(n);

  // 1. Contraste: 0..40 → 0, 215..255 → 255, lineal en el medio.
  for (let i = 0; i < n; i++) {
    const v = alpha[i];
    a[i] = v <= 40 ? 0 : v >= 215 ? 255 : ((v - 40) * 255) / 175;
  }

  const label = new Int32Array(n);
  const queue = new Int32Array(n);

  // Etiqueta componentes 4-conexos de los píxeles que cumplen `inside`.
  const components = (inside: (i: number) => boolean) => {
    label.fill(0);
    const sizes: number[] = [0];
    const touchesBorder: boolean[] = [false];
    for (let start = 0; start < n; start++) {
      if (label[start] || !inside(start)) continue;
      const id = sizes.length;
      let head = 0, tail = 0, size = 0, border = false;
      queue[tail++] = start;
      label[start] = id;
      while (head < tail) {
        const p = queue[head++];
        size++;
        const x = p % w, y = (p - x) / w;
        if (x === 0 || y === 0 || x === w - 1 || y === h - 1) border = true;
        if (x > 0 && !label[p - 1] && inside(p - 1)) { label[p - 1] = id; queue[tail++] = p - 1; }
        if (x < w - 1 && !label[p + 1] && inside(p + 1)) { label[p + 1] = id; queue[tail++] = p + 1; }
        if (y > 0 && !label[p - w] && inside(p - w)) { label[p - w] = id; queue[tail++] = p - w; }
        if (y < h - 1 && !label[p + w] && inside(p + w)) { label[p + w] = id; queue[tail++] = p + w; }
      }
      sizes.push(size);
      touchesBorder.push(border);
    }
    return { sizes, touchesBorder };
  };

  // 2. Islas del primer plano.
  const fg = components((i) => a[i] > 0);
  const biggest = Math.max(0, ...fg.sizes);
  if (biggest === 0) return a; // nada que limpiar: el que llama decide qué hacer con un recorte vacío
  const keep = fg.sizes.map((s) => s >= biggest * keepIslandRatio);
  let fgArea = 0;
  for (let i = 0; i < n; i++) {
    if (a[i] === 0) continue;
    if (!keep[label[i]]) a[i] = 0;
    else fgArea++;
  }

  // 3. Huecos: regiones de fondo que no tocan el borde de la imagen y son chicas.
  const bg = components((i) => a[i] < 128);
  const fill = bg.sizes.map((s, id) => id > 0 && !bg.touchesBorder[id] && s < fgArea * fillHoleRatio);
  for (let i = 0; i < n; i++) if (a[i] < 128 && fill[label[i]]) a[i] = 255;

  // 4. Suavizado 3×3 solo en píxeles de borde.
  const out = new Uint8ClampedArray(a);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const c = a[i];
      if (c === a[i - 1] && c === a[i + 1] && c === a[i - w] && c === a[i + w]) continue;
      out[i] = (a[i - w - 1] + a[i - w] + a[i - w + 1] + a[i - 1] + c + a[i + 1] + a[i + w - 1] + a[i + w] + a[i + w + 1]) / 9;
    }
  }
  return out;
}

/** Arma la imagen final: color de la foto original + alfa refinado (evita bordes oscuros por premultiplicado). */
export function composeCutout(original: Uint8ClampedArray, alpha: Uint8ClampedArray): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(original.length);
  for (let i = 0, p = 0; p < alpha.length; i += 4, p++) {
    out[i] = original[i];
    out[i + 1] = original[i + 1];
    out[i + 2] = original[i + 2];
    out[i + 3] = alpha[p];
  }
  return out;
}
