# Mi Armario

PWA personal para catalogar ropa con fotos (fondo quitado en el navegador) y recibir ideas de outfits. Sin backend: todo vive en IndexedDB del celular.

## Desarrollo

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # tests del motor de outfits
npm run build      # genera dist/
npm run preview    # sirve dist/ con service worker, para probar la PWA
```

Para probar en el celular en la misma red: `npm run dev -- --host` y abrí la IP que muestra. Ojo: la cámara y el service worker
requieren HTTPS fuera de `localhost`, así que para la prueba real conviene deployar.

## Estructura

| Carpeta | Qué hay |
| --- | --- |
| `src/db/` | IndexedDB (`idb`). Stores: `items` (metadatos), `images` (blobs `id:full`, `id:thumb`, `id:orig`), `outfits`, `meta`. |
| `src/image/` | Redimensionado, extracción de color, recorte de fondo en un Web Worker (`@imgly/background-removal`). |
| `src/engine/` | `suggestOutfit(items, opts)`: motor de reglas puro y testeado. Reemplazable por IA con la misma firma. |
| `src/screens/` | Armario, Agregar, Outfit, Stats (incluye respaldo). |
| `src/backup.ts` | Exportar / importar `.zip` con `data.json` + imágenes. |

## Deploy a Vercel

**Opción A: desde GitHub (recomendada, se redeploya sola con cada push)**

1. Subí la carpeta a un repo de GitHub.
2. En [vercel.com/new](https://vercel.com/new) importá el repo. Vercel detecta Vite solo
   (Build: `npm run build`, Output: `dist`). Deploy.

**Opción B: desde la terminal**

```bash
npm i -g vercel
vercel          # primera vez: te loguea y crea el proyecto
vercel --prod
```

`vercel.json` ya configura el fallback a `index.html` y que `sw.js` no se cachee (para que las actualizaciones lleguen).

## Instalar en el celular

**Android (Chrome):** abrí la URL de Vercel → menú ⋮ → *Instalar app* (o *Agregar a la pantalla principal*).
Instalada, Chrome suele concederle almacenamiento persistente.

**iPhone (Safari):** abrí la URL → botón Compartir → *Agregar a inicio*. Tiene que ser Safari.
En iOS el almacenamiento persistente no está garantizado: exportá respaldos seguido.

La primera vez que agregues una prenda se baja el modelo de recorte (~90 MB, mejor con wifi).
Después queda cacheado y funciona sin internet.

## Notas

- Licencia de `@imgly/background-removal`: AGPL. Para uso personal no hay problema; si algún día se publica como producto, revisar.
- Marrón se trata como neutro (además de negro, blanco, gris, beige, azul marino y denim).
- "Usé este outfit" bloquea esa base (arriba+abajo+calzado) por 7 días en las sugerencias.
