// ---------------------------------------------------------------------------
// PbfVectorTileLayer — رندر تایل‌های برداری (Vector Tiles) روی Leaflet
// ---------------------------------------------------------------------------
// تایل‌ها توسط scripts/build_vtiles.py از لایه‌های iran.pbf ساخته می‌شوند و در
// public/data/pbf/vtiles/{z}/{x}/{y}.json.gz قرار دارند. هر تایل شامل همهٔ
// لایه‌های موضوعی است و مختصات داخل آن با شبکهٔ ۴۰۹۶ کوآنتیزه و به‌صورت دلتا
// کدگذاری شده‌اند (فشرده با gzip). این لایه تایل را fetch، gzip را باز و روی
// یک canvas مستقل برای هر تایل می‌کشد — درست مثل رندررهای وکتور تایل.
import L from 'leaflet';

export interface VtFeatureLine {
  t: string;
  n?: string;
  r?: string;
  /** تک‌ران: آرایهٔ صاف دلتا [x0,y0,dx,dy,...] — چند ران: آرایه‌ای از همین‌ها */
  c: number[] | number[][];
}
export interface VtFeaturePoint {
  t: string;
  n?: string;
  p?: string;
  /** [x, y] کوآنتیزه در شبکهٔ ۴۰۹۶ */
  c: [number, number];
}
export interface VtFeaturePoly {
  t: string;
  n?: string;
  /** [حلقه] — حلقه آرایهٔ صاف دلتا */
  c: number[][];
}

export interface VtThemeStyles {
  line?: (f: { t: string }) => { color: string; weight: number; opacity: number; dash?: string };
  point?: (f: { t: string }) => { color: string; fill: string; radius: number; opacity: number };
  poly?: (f: { t: string }) => { color: string; fill: string; fillOpacity: number; weight: number; opacity: number };
}

/** مقیاس شبکهٔ ۴۰۹۶ → ۲۵۶ پیکسل تایل */
const SCALE = 256 / 4096;

/** رمزگشایی آرایهٔ صاف دلتا → فهرست نقاط [x, y] در شبکهٔ تایل */
function decodeDelta(flat: number[]): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  let x = 0;
  let y = 0;
  for (let i = 0; i < flat.length - 1; i += 2) {
    x += flat[i];
    y += flat[i + 1];
    pts.push([x, y]);
  }
  return pts;
}

async function decompressGzip(buf: ArrayBuffer): Promise<string> {
  const DS = (window as unknown as { DecompressionStream?: new (fmt: string) => ReadableWritablePair }).DecompressionStream;
  if (!DS) {
    // مرورگرهای قدیمی: بدون پشتیبانی gzip — تایل خالی
    return '';
  }
  const ds = new DS('gzip');
  const stream = new Blob([buf]).stream().pipeThrough(ds);
  return new Response(stream).text();
}

function drawLines(ctx: CanvasRenderingContext2D, feats: VtFeatureLine[], style: NonNullable<VtThemeStyles['line']>) {
  // دسته‌بندی سبک: یک مسیر واحد برای هر دسته
  const keys = new Set<string>();
  for (const f of feats) {
    const st = style(f);
    keys.add(`${st.color}|${st.weight}|${st.opacity}|${st.dash || ''}`);
  }
  for (const key of keys) {
    const [color, weight, opacity, dash] = key.split('|');
    ctx.globalAlpha = Number(opacity);
    ctx.strokeStyle = color;
    ctx.lineWidth = Number(weight);
    if (dash) ctx.setLineDash(dash.split(' ').map(Number));
    ctx.beginPath();
    for (const f of feats) {
      const st = style(f);
      if (`${st.color}|${st.weight}|${st.opacity}|${st.dash || ''}` !== key) continue;
      const c = f.c;
      const runs = typeof c[0] === 'number' ? [c as number[]] : (c as number[][]);
      for (const run of runs) {
        const pts = decodeDelta(run);
        if (pts.length < 2) continue;
        for (let i = 0; i < pts.length; i++) {
          const px = pts[i][0] * SCALE;
          const py = pts[i][1] * SCALE;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
      }
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.globalAlpha = 1;
}

function drawPoints(ctx: CanvasRenderingContext2D, feats: VtFeaturePoint[], style: NonNullable<VtThemeStyles['point']>) {
  const keys = new Set<string>();
  for (const f of feats) {
    const st = style(f);
    keys.add(`${st.fill}|${st.color}|${st.radius}|${st.opacity}`);
  }
  for (const key of keys) {
    const [fill, color, radius, opacity] = key.split('|');
    ctx.globalAlpha = Number(opacity);
    ctx.fillStyle = fill;
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (const f of feats) {
      const st = style(f);
      if (`${st.fill}|${st.color}|${st.radius}|${st.opacity}` !== key) continue;
      const px = f.c[0] * SCALE;
      const py = f.c[1] * SCALE;
      ctx.moveTo(px + Number(radius), py);
      ctx.arc(px, py, Number(radius), 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawPolys(ctx: CanvasRenderingContext2D, feats: VtFeaturePoly[], style: NonNullable<VtThemeStyles['poly']>) {
  for (const f of feats) {
    const st = style(f);
    const ring = decodeDelta(f.c[0]);
    if (ring.length < 3) continue;
    ctx.beginPath();
    for (let i = 0; i < ring.length; i++) {
      const px = ring[i][0] * SCALE;
      const py = ring[i][1] * SCALE;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.globalAlpha = st.fillOpacity;
    ctx.fillStyle = st.fill;
    ctx.fill();
    ctx.globalAlpha = st.opacity;
    ctx.strokeStyle = st.color;
    ctx.lineWidth = st.weight;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawTile(ctx: CanvasRenderingContext2D, data: { layers?: Record<string, Record<string, unknown[]>> }, theme: Record<string, VtThemeStyles>) {
  const layers = data.layers ?? {};
  for (const [name, body] of Object.entries(layers)) {
    const st = theme[name];
    if (!st) continue;
    if (st.line && Array.isArray(body.lines)) drawLines(ctx, body.lines as VtFeatureLine[], st.line);
    if (st.point && Array.isArray(body.points)) drawPoints(ctx, body.points as VtFeaturePoint[], st.point);
    if (st.poly && Array.isArray(body.polys)) drawPolys(ctx, body.polys as VtFeaturePoly[], st.poly);
  }
}

export class PbfVectorTileLayer extends L.TileLayer {
  private theme: Record<string, VtThemeStyles>;

  constructor(theme: Record<string, VtThemeStyles>, options: L.TileLayerOptions) {
    super('data/pbf/vtiles/{z}/{x}/{y}.json.gz', { tileSize: 256, updateWhenIdle: true, ...options });
    this.theme = theme;
  }

  createTile(coords: L.Coords, done: L.DoneCallback): HTMLElement {
    const tile = document.createElement('canvas');
    const dpr = window.devicePixelRatio || 1;
    tile.width = 256 * dpr;
    tile.height = 256 * dpr;
    const ctx = tile.getContext('2d');
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    fetch(`data/pbf/vtiles/${coords.z}/${coords.x}/${coords.y}.json.gz`)
      .then(async (r) => {
        if (!r.ok) return '';
        const buf = await r.arrayBuffer();
        // اگر سرور Content-Encoding: gzip فرستاده، مرورگر خودش بدنه را باز کرده
        // (مثل سرور توسعهٔ Vite)؛ در غیر این صورت دستی DecompressionStream می‌زنیم.
        const enc = (r.headers.get('content-encoding') || '').toLowerCase();
        if (enc.includes('gzip')) return new TextDecoder().decode(buf);
        return decompressGzip(buf);
      })
      .then((text) => {
        if (text && ctx) {
          try {
            drawTile(ctx, JSON.parse(text), this.theme);
          } catch {
            // خطای یک تایل نباید کل لایه را خراب کند
          }
        }
        done(undefined, tile);
      })
      .catch(() => done(undefined, tile));
    return tile;
  }
}
