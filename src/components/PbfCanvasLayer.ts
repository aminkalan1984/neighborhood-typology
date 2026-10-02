// ---------------------------------------------------------------------------
// PbfCanvasLayer — رندر هزاران عارضهٔ OSM روی یک بوم (canvas) واحد
// ---------------------------------------------------------------------------
// لایه‌های استخراج‌شده از iran.pbf (راه‌ها، آبراهه‌ها، سکونتگاه‌ها، POI و …)
// می‌توانند صدها هزار عارضه داشته باشند. ساختن یک شیء Leaflet برای هر عارضه
// (L.polyline) ده‌ها ثانیه طول می‌کشد و UI را قفل می‌کند. این کلاس همهٔ عارضه‌ها
// را به‌صورت دسته‌ای روی یک canvas می‌کشد (هر سبک یک مسیر واحد) و برای کلیک،
// نزدیک‌ترین عارضه را با hit-test پیدا می‌کند و popup باز می‌کند.
import L from 'leaflet';

export interface PbfThemeData {
  lines?: Array<{ t: string; n?: string; r?: string; c: [number, number][] }>;
  points?: Array<{ t: string; n?: string; p?: string; c: [number, number] }>;
  polys?: Array<{ t: string; n?: string; c: [number, number][][] }>;
}

export interface PbfThemeStyle {
  line?: (f: { t: string }) => { color: string; weight: number; opacity: number; dash?: string };
  point?: (f: { t: string }) => { color: string; fill: string; radius: number; opacity: number };
  poly?: (f: { t: string }) => { color: string; fill: string; fillOpacity: number; weight: number; opacity: number };
  labels?: {
    line?: (f: { t: string; n?: string; r?: string }) => [string, string] | null;
    point?: (f: { t: string; n?: string; p?: string }) => [string, string] | null;
    poly?: (f: { t: string; n?: string }) => [string, string] | null;
  };
  /** حداکثر فاصلهٔ کلیک (px) برای hit-test نقاط */
  hitRadiusPx?: number;
  /** خوشه‌بندی نقاط در زوم‌های پایین (شبکه‌بندی فضای صفحه) */
  cluster?: {
    /** در زوم‌های کمتر یا مساوی این مقدار، خوشه‌بندی فعال است */
    maxZoom: number;
    /** حداقل تعداد نقطه برای تشکیل خوشه */
    minPoints: number;
    /** اندازهٔ سلول خوشه‌بندی (px) */
    cellSize: number;
    /** رنگ خوشه */
    color: string;
    /** برچسب فارسی برای popup خوشه */
    label?: string;
  };
  /** هیتمپ تراکم نقاط (رندر با ترکیب شعاعی + رمپ رنگی) */
  heat?: {
    /** شعاع هر نقطه در زوم فعلی (px) */
    radius: number;
    /** شدت کلی هیتمپ (0 تا 1) */
    opacity: number;
    /** وزن نقطه (پیش‌فرض ۱) — برای سکونتگاه‌ها می‌تواند جمعیت باشد */
    weight?: (f: { t: string; p?: string }) => number;
  };
}

interface BatchStyle {
  color: string;
  weight: number;
  opacity: number;
  dash?: string;
  kind: 'line';
}
interface PointBatchStyle {
  color: string;
  fill: string;
  radius: number;
  opacity: number;
  kind: 'point';
}
interface PolyBatchStyle {
  color: string;
  fill: string;
  fillOpacity: number;
  weight: number;
  opacity: number;
  kind: 'poly';
}

function ringContains(ring: [number, number][], lat: number, lng: number): boolean {
  let inside = false;
  const n = ring.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export class PbfCanvasLayer extends L.Layer {
  private data: PbfThemeData;
  private style: PbfThemeStyle;
  private layerOpacity: number;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private map: L.Map | null = null;
  private lineBbox: Float64Array | null = null;
  private polyBbox: Float64Array | null = null;
  private clusterHits: Map<string, { x: number; y: number; n: number }> | null = null;
  private clusterCell = 0;

  constructor(data: PbfThemeData, style: PbfThemeStyle, layerOpacity: number) {
    super();
    this.data = data;
    this.style = style;
    this.layerOpacity = layerOpacity;
    if (data.lines) this.lineBbox = this.buildBboxes(data.lines.length, (i) => data.lines![i].c);
    if (data.polys) this.polyBbox = this.buildBboxes(data.polys.length, (i) => data.polys![i].c[0] || []);
  }

  setOpacity(opacity: number) {
    this.layerOpacity = opacity;
    this.redraw();
  }

  private buildBboxes(n: number, coordsOf: (i: number) => [number, number][]): Float64Array {
    const bb = new Float64Array(n * 4);
    for (let i = 0; i < n; i++) {
      const c = coordsOf(i);
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const [x, y] of c) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
      bb[i * 4] = minX;
      bb[i * 4 + 1] = minY;
      bb[i * 4 + 2] = maxX;
      bb[i * 4 + 3] = maxY;
    }
    return bb;
  }

  onAdd(map: L.Map): this {
    this.map = map;
    const pane = map.getPane('overlayPane')!;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'leaflet-pbf-canvas';
    this.canvas.style.pointerEvents = 'none';
    pane.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.resize();
    map.on('moveend zoomend viewreset resize', this.redraw, this);
    map.on('click', this.onClick, this);
    this.redraw();
    // برخی چیدمان‌ها بعد از افزوده‌شدن لایه تغییر اندازه می‌دهند؛ یک بار دوباره بکش.
    map.whenReady(() => this.redraw());
    window.setTimeout(() => this.redraw(), 400);
    return this;
  }

  onRemove(map: L.Map): this {
    map.off('moveend zoomend viewreset resize', this.redraw, this);
    map.off('click', this.onClick, this);
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.canvas = null;
    this.ctx = null;
    this.map = null;
    return this;
  }

  private resize() {
    const map = this.map!;
    const size = map.getSize();
    const dpr = window.devicePixelRatio || 1;
    if (!this.canvas) return;
    this.canvas.width = Math.round(size.x * dpr);
    this.canvas.height = Math.round(size.y * dpr);
    this.canvas.style.width = size.x + 'px';
    this.canvas.style.height = size.y + 'px';
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    (this.canvas as any)._dpr = dpr;
  }

  redraw = () => {
    const map = this.map;
    const ctx = this.ctx;
    const canvas = this.canvas;
    if (!map || !ctx || !canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const size = map.getSize();
    // همگام‌سازی اندازهٔ بوم با اندازهٔ فعلی نقشه (اگر چیدمان تغییر کرده باشد)
    const expectW = Math.round(size.x * dpr);
    const expectH = Math.round(size.y * dpr);
    if (canvas.width !== expectW || canvas.height !== expectH) {
      this.resize();
    }
    const op = this.layerOpacity / 100;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.x, size.y);
    if (op <= 0) return;

    const toPt = (lat: number, lng: number) => map.latLngToContainerPoint([lat, lng]);
    const bounds = map.getBounds();

    // ── پهنه‌ها (پلی‌گون‌ها) ──
    const polys = this.data.polys;
    if (polys && polys.length && this.style.poly) {
      const batches = new Map<string, { s: PolyBatchStyle; drawn: boolean }>();
      polys.forEach((po, i) => {
        const bb = this.polyBbox!;
        const b = map.getBounds();
        if (bb[i * 4 + 2] < b.getWest() || bb[i * 4] > b.getEast() ||
            bb[i * 4 + 3] < b.getSouth() || bb[i * 4 + 1] > b.getNorth()) return;
        const st = this.style.poly!(po);
        const key = `${st.fill}|${st.fillOpacity}|${st.weight}`;
        let batch = batches.get(key);
        if (!batch) {
          batch = { s: { ...st, kind: 'poly' }, drawn: false };
          batches.set(key, batch);
        }
        const ring = po.c[0] || [];
        if (ring.length < 3) return;
        ctx.beginPath();
        ring.forEach(([x, y], k) => {
          const p = toPt(y, x);
          if (k === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
        ctx.closePath();
        ctx.fillStyle = st.fill;
        ctx.globalAlpha = st.fillOpacity * op;
        ctx.fill();
        ctx.globalAlpha = st.opacity * op;
        ctx.strokeStyle = st.color;
        ctx.lineWidth = st.weight || 1;
        ctx.stroke();
        batch.drawn = true;
      });
      ctx.globalAlpha = 1;
    }

    // ── خطوط (راه‌ها، آبراهه‌ها، خطوط برق، مرزها، ریل) ──
    const lines = this.data.lines;
    if (lines && lines.length && this.style.line) {
      const batches = new Map<string, { s: BatchStyle; ctx: CanvasRenderingContext2D }>();
      lines.forEach((ln, i) => {
        const bb = this.lineBbox!;
        if (bb[i * 4 + 2] < bounds.getWest() || bb[i * 4] > bounds.getEast() ||
            bb[i * 4 + 3] < bounds.getSouth() || bb[i * 4 + 1] > bounds.getNorth()) return;
        const st = this.style.line!(ln);
        const key = `${st.color}|${st.weight}|${st.opacity}|${st.dash || ''}`;
        let batch = batches.get(key);
        if (!batch) {
          batch = { s: { ...st, kind: 'line' }, ctx: ctx };
          batches.set(key, batch);
          ctx.beginPath();
        }
        const c = ln.c;
        if (c.length < 2) return;
        c.forEach(([x, y], k) => {
          const p = toPt(y, x);
          if (k === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        });
      });
      for (const { s } of batches.values()) {
        ctx.globalAlpha = s.opacity * op;
        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.weight;
        if (s.dash) ctx.setLineDash([s.dash.split(' ').map(Number)][0]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.globalAlpha = 1;
    }

    // ── نقاط (سکونتگاه‌ها، POI، پست‌ها) ──
    const pts = this.data.points;
    if (pts && pts.length && this.style.point) {
      // حالت هیتمپ: تراکم رنگی به‌جای نقطه‌های مجزا
      if (this.style.heat) {
        this.drawHeat(ctx, size, dpr, op);
      } else if (this.style.cluster && map.getZoom() <= this.style.cluster.maxZoom) {
        // حالت خوشه‌بندی: در زوم پایین نقاط به‌صورت خوشه رسم می‌شوند
        this.drawClusters(ctx, op);
      } else {
        this.clusterHits = null;
        this.drawPoints(ctx, op);
      }
      ctx.globalAlpha = 1;
    }
  };

  /** رسم مجزای نقاط (بدون خوشه) با دسته‌بندی سبک */
  private drawPoints(ctx: CanvasRenderingContext2D, op: number) {
    const map = this.map!;
    const pts = this.data.points!;
    const bounds = map.getBounds();
    const batches = new Map<string, { s: PointBatchStyle }>();
    for (const pt of pts) {
      const [x, y] = pt.c;
      if (y < bounds.getSouth() || y > bounds.getNorth() || x < bounds.getWest() || x > bounds.getEast()) continue;
      const st = this.style.point!(pt);
      const key = `${st.fill}|${st.color}|${st.radius}`;
      let batch = batches.get(key);
      if (!batch) {
        batch = { s: { ...st, kind: 'point' } };
        batches.set(key, batch);
      }
    }
    for (const { s } of batches.values()) {
      ctx.globalAlpha = s.opacity * op;
      ctx.fillStyle = s.fill;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (const pt of pts) {
        const [x, y] = pt.c;
        if (y < bounds.getSouth() || y > bounds.getNorth() || x < bounds.getWest() || x > bounds.getEast()) continue;
        const st = this.style.point!(pt);
        if (st.fill !== s.fill || st.radius !== s.radius) continue;
        const p = map.latLngToContainerPoint([y, x]);
        ctx.moveTo(p.x + s.radius, p.y);
        ctx.arc(p.x, p.y, s.radius, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.stroke();
    }
  }

  /** خوشه‌بندی نقاط در زوم پایین — شبکه‌بندی فضای صفحه با تعداد خوشه */
  private drawClusters(ctx: CanvasRenderingContext2D, op: number) {
    const map = this.map!;
    const pts = this.data.points!;
    const bounds = map.getBounds();
    const cell = this.style.cluster!.cellSize;
    const minPoints = this.style.cluster!.minPoints;
    const color = this.style.cluster!.color;
    const buckets = new Map<string, { x: number; y: number; n: number }>();
    for (const pt of pts) {
      const [x, y] = pt.c;
      if (y < bounds.getSouth() || y > bounds.getNorth() || x < bounds.getWest() || x > bounds.getEast()) continue;
      const p = map.latLngToContainerPoint([y, x]);
      const bx = Math.round(p.x / cell);
      const by = Math.round(p.y / cell);
      const key = bx + ',' + by;
      let b = buckets.get(key);
      if (!b) {
        b = { x: 0, y: 0, n: 0 };
        buckets.set(key, b);
      }
      b.x += p.x;
      b.y += p.y;
      b.n += 1;
    }
    this.clusterHits = buckets;
    this.clusterCell = cell;
    const { r, g, b } = hexToRgb(color);
    const light = (k: number) => `rgba(${Math.min(255, Math.round(r + (255 - r) * k))},${Math.min(255, Math.round(g + (255 - g) * k))},${Math.min(255, Math.round(b + (255 - b) * k))},1)`;
    ctx.globalAlpha = op;
    for (const bucket of buckets.values()) {
      if (bucket.n < minPoints) continue;
      const cx = bucket.x / bucket.n;
      const cy = bucket.y / bucket.n;
      const rad = Math.min(7 + Math.log2(bucket.n) * 3.6, 27);
      // هالهٔ تیره برای خوانایی روی نقشه
      ctx.beginPath();
      ctx.arc(cx, cy, rad + 2.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(15,23,42,0.5)';
      ctx.fill();
      // بدنهٔ خوشه با گرادیان شعاعی
      const grad = ctx.createRadialGradient(cx, cy, rad * 0.12, cx, cy, rad);
      grad.addColorStop(0, light(0.55));
      grad.addColorStop(1, color);
      ctx.beginPath();
      ctx.arc(cx, cy, rad, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      // برچسب تعداد
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `800 ${Math.max(9, Math.round(rad * 0.72))}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(bucket.n), cx, cy + 0.5);
    }
  }

  /** هیتمپ تراکم — بافر نیم‌مقیاس با ترکیب lighter + رمپ رنگی حرفه‌ای */
  private drawHeat(ctx: CanvasRenderingContext2D, size: L.Point, dpr: number, op: number) {
    const map = this.map!;
    const pts = this.data.points!;
    const bounds = map.getBounds();
    const heat = this.style.heat!;
    const radius = Math.max(8, heat.radius * dpr);
    // بافر نیم‌مقیاس برای سرعت
    const w2 = Math.max(1, Math.round(size.x / 2));
    const h2 = Math.max(1, Math.round(size.y / 2));
    const off = document.createElement('canvas');
    off.width = w2;
    off.height = h2;
    const octx = off.getContext('2d');
    if (!octx) return;
    octx.globalCompositeOperation = 'lighter';
    // اسپرایت گرادیان شعاعی یک‌بار ساخته می‌شود و برای همهٔ نقاط drawImage می‌شود
    const spriteR = Math.ceil(radius / 2);
    const sprite = document.createElement('canvas');
    sprite.width = sprite.height = spriteR * 2;
    const sctx = sprite.getContext('2d');
    if (!sctx) return;
    const g = sctx.createRadialGradient(spriteR, spriteR, 0, spriteR, spriteR, spriteR);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.75)');
    g.addColorStop(0.65, 'rgba(255,255,255,0.3)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    sctx.fillStyle = g;
    sctx.fillRect(0, 0, spriteR * 2, spriteR * 2);
    const weightOf = heat.weight ?? (() => 1);
    for (const pt of pts) {
      const [x, y] = pt.c;
      if (y < bounds.getSouth() || y > bounds.getNorth() || x < bounds.getWest() || x > bounds.getEast()) continue;
      const p = map.latLngToContainerPoint([y, x]);
      const w = weightOf(pt);
      if (w <= 0) continue;
      octx.globalAlpha = Math.min(0.9, w * 0.16 * op);
      octx.drawImage(sprite, p.x / 2 - spriteR, p.y / 2 - spriteR);
    }
    // رمپ رنگی: شدت → رنگ (آبی → فیروزه‌ای → سبز → زرد → نارنجی → قرمز)
    const img = octx.getImageData(0, 0, w2, h2);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = d[i + 3] / 255;
      if (v <= 0.02) {
        d[i + 3] = 0;
        continue;
      }
      const c = heatColor(v);
      d[i] = c[0];
      d[i + 1] = c[1];
      d[i + 2] = c[2];
      d[i + 3] = Math.min(255, Math.round(v * 255 * 1.15));
    }
    octx.putImageData(img, 0, 0);
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, 0, 0, size.x, size.y);
  }

  private onClick = (e: L.LeafletMouseEvent) => {
    const map = this.map;
    if (!map) return;
    const pt = map.mouseEventToContainerPoint(e.originalEvent);
    const hit = this.style.hitRadiusPx || 10;
    const hitSq = hit * hit;

    // خوشه‌ها: کلیک روی خوشه → بزرگ‌نمایی به سمت مرکز آن
    if (this.clusterHits && this.style.cluster) {
      const bx = Math.round(pt.x / this.clusterCell);
      const by = Math.round(pt.y / this.clusterCell);
      const bucket = this.clusterHits.get(bx + ',' + by);
      if (bucket && bucket.n >= this.style.cluster.minPoints) {
        const cx = bucket.x / bucket.n;
        const cy = bucket.y / bucket.n;
        const center = map.containerPointToLatLng([cx, cy]);
        const label = this.style.cluster.label || 'خوشه';
        map.openPopup(
          this.popupHtml(`${toFaDigits(bucket.n)} ${label} در این ناحیه`, 'برای بزرگ‌نمایی روی خوشه کلیک کنید'),
          center,
        );
        map.flyTo(center, map.getZoom() + 2, { duration: 0.5 });
        return;
      }
    }

    // نقاط: نزدیک‌ترین نقطه
    let best: { p: { t: string; n?: string; p?: string; c: [number, number] }; d: number } | null = null;
    for (const p of this.data.points || []) {
      const c = map.latLngToContainerPoint([p.c[1], p.c[0]]);
      const dx = c.x - pt.x;
      const dy = c.y - pt.y;
      const d = dx * dx + dy * dy;
      if (d < hitSq && (!best || d < best.d)) best = { p, d };
    }
    if (best) {
      const label = this.style.labels?.point?.(best.p);
      if (label) {
        map.openPopup(this.popupHtml(label[0], label[1]), [best.p.c[1], best.p.c[0]]);
      }
      return;
    }

    // پهنه‌ها: درون کدام پلی‌گون است
    for (const po of this.data.polys || []) {
      const ring = po.c[0] || [];
      if (ringContains(ring as [number, number][], e.latlng.lat, e.latlng.lng)) {
        const label = this.style.labels?.poly?.(po);
        if (label) {
          map.openPopup(this.popupHtml(label[0], label[1]), e.latlng);
        }
        return;
      }
    }

    // خطوط: برای v1 از hit-test صرف‌نظر شده (فقط نقاط و پهنه‌ها popup دارند)
  };

  private popupHtml(title: string, sub: string): string {
    return (
      `<div dir="rtl" style="font-family:Vazirmatn,Tahoma,sans-serif;font-size:12px;text-align:right;color:#0F172A;min-width:160px;">` +
      `<div style="font-weight:900;font-size:12px;color:#1E4841;">${title}</div>` +
      `<div style="font-size:9.5px;color:#64748B;margin-top:3px;">${sub}</div>` +
      `<div style="font-size:8px;color:#94A3B8;margin-top:4px;">منبع: OpenStreetMap (iran.pbf) · ODbL</div>` +
      `</div>`
    );
  }
}

// ─── توابع کمکی رنگ ───────────────────────────────────────────

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  const v = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}

function toFaDigits(n: number): string {
  return String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
}

/** رمپ رنگی هیتمپ: شدت ۰..۱ → [r, g, b] (آبی → فیروزه‌ای → سبز → زرد → نارنجی → قرمز) */
const HEAT_STOPS: Array<[number, [number, number, number]]> = [
  [0, [15, 23, 42]],
  [0.2, [37, 99, 235]],
  [0.4, [34, 211, 238]],
  [0.55, [52, 211, 153]],
  [0.7, [250, 204, 21]],
  [0.85, [249, 115, 22]],
  [1, [239, 68, 68]],
];
function heatColor(v: number): [number, number, number] {
  for (let i = 0; i < HEAT_STOPS.length - 1; i++) {
    const [t0, c0] = HEAT_STOPS[i];
    const [t1, c1] = HEAT_STOPS[i + 1];
    if (v >= t0 && v <= t1) {
      const k = (v - t0) / (t1 - t0 || 1);
      return [
        Math.round(c0[0] + (c1[0] - c0[0]) * k),
        Math.round(c0[1] + (c1[1] - c0[1]) * k),
        Math.round(c0[2] + (c1[2] - c0[2]) * k),
      ];
    }
  }
  return HEAT_STOPS[HEAT_STOPS.length - 1][1];
}
