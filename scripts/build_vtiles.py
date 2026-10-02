#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ساخت تایل‌های برداری (Vector Tiles) از لایه‌های فشردهٔ PBF.

ورودی:  public/data/pbf/{roads,water,places,pois,power,railway,boundaries,landuse}.json
خروجی: public/data/pbf/vtiles/{z}/{x}/{y}.json  (هر تایل شامل همهٔ لایه‌ها)

ویژگی‌ها:
  • کلیپ دقیق خطوط به مرز تایل (Liang–Barsky) — بدون شکستگی در لبهٔ تایل
  • تعمیم وابسته به زوم: فیلتر کلاس، حداقل طول، کاهش رأس (decimation)
  • کوآنتیزاسیون مختصات به شبکهٔ ۴۰۹۶ داخل هر تایل (مثل MVT)
  • سکونتگاه‌ها/POI نقطه‌ای به‌صورت تک‌تایل؛ پلی‌گون‌ها با سقف تایل
نیاز به هیچ وابستگی ندارد (Python خالص).
"""
import gzip
import json
import math
import os
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'public', 'data', 'pbf')
OUT = os.path.join(SRC, 'vtiles')

# محدودهٔ ایران (west, south, east, north)
IRAN = (43.5, 24.0, 63.6, 39.9)
GRID = 4096  # دقت داخل هر تایل


# ─── توابع مختصات تایل (اسلیپی مپ استاندارد) ──────────────────
def y_from_lat(lat, n):
    lat_r = math.radians(lat)
    return int((1 - math.asinh(math.tan(lat_r)) / math.pi) / 2 * n)


def tile_bounds(z, x, y):
    n = 2 ** z
    west = x / n * 360 - 180
    east = (x + 1) / n * 360 - 180
    north = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))
    south = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (y + 1) / n))))
    return west, south, east, north


def tiles_overlapped(minx, miny, maxx, maxy, z):
    n = 2 ** z
    x0 = max(0, int((minx + 180) / 360 * n))
    x1 = min(n - 1, int((maxx + 180) / 360 * n))
    y0 = max(0, y_from_lat(maxy, n))
    y1 = min(n - 1, y_from_lat(miny, n))
    if x1 < x0:
        x0, x1 = x1, x0
    if y1 < y0:
        y0, y1 = y1, y0
    for tx in range(x0, x1 + 1):
        for ty in range(y0, y1 + 1):
            yield tx, ty


# ─── کلیپ خط به مستطیل (Liang–Barsky) ─────────────────────────
def clip_segment(x0, y0, x1, y1, xmin, xmax, ymin, ymax):
    dx, dy = x1 - x0, y1 - y0
    p = (-dx, dx, -dy, dy)
    q = (x0 - xmin, xmax - x0, y0 - ymin, ymax - y0)
    t0, t1 = 0.0, 1.0
    for pi, qi in zip(p, q):
        if pi == 0:
            if qi < 0:
                return None
        else:
            t = qi / pi
            if pi < 0:
                if t > t1:
                    return None
                if t > t0:
                    t0 = t
            else:
                if t < t0:
                    return None
                if t < t1:
                    t1 = t
    if t1 < t0:
        return None
    return (x0 + t0 * dx, y0 + t0 * dy, x1 + t1 * dx, y1 + t1 * dy)


def clip_polyline(pts, xmin, xmax, ymin, ymax, margin=0.0):
    """خط شکسته را به مستطیل تایل کلیپ می‌کند؛ خروجی: فهرست ران‌های (run) نقطه."""
    xmin -= margin
    xmax += margin
    ymin -= margin
    ymax += margin
    runs = []
    cur = None
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        seg = clip_segment(x0, y0, x1, y1, xmin, xmax, ymin, ymax)
        if seg is None:
            cur = None
            continue
        if cur is None:
            cur = [[seg[0], seg[1]], [seg[2], seg[3]]]
            runs.append(cur)
        else:
            last = cur[-1]
            if abs(last[0] - seg[0]) < 1e-9 and abs(last[1] - seg[1]) < 1e-9:
                cur.append([seg[2], seg[3]])
            else:
                cur = [[seg[0], seg[1]], [seg[2], seg[3]]]
                runs.append(cur)
    return runs


# ─── طول و کاهش رأس ───────────────────────────────────────────
def line_len_km(pts):
    total = 0.0
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        midlat = math.radians((y0 + y1) / 2)
        dlat = (y1 - y0) * 111.32
        dlng = (x1 - x0) * 111.32 * math.cos(midlat)
        total += math.hypot(dlat, dlng)
    return total


def decimate(pts, k):
    if k <= 1 or len(pts) <= 2:
        return pts
    out = pts[0::k]
    if out[-1] != pts[-1]:
        out.append(pts[-1])
    return out


def quantize_pt(x, y, west, south, east, north):
    qx = int(round((x - west) / (east - west) * GRID))
    qy = int(round((north - y) / (north - south) * GRID))
    return [max(0, min(GRID, qx)), max(0, min(GRID, qy))]


def delta_flat(pts):
    """آرایهٔ صاف با کدگذاری دلتا (اول مطلق، بعد دلتا) — فشرده‌تر در gzip."""
    flat = []
    px = py = 0
    for i, (x, y) in enumerate(pts):
        if i == 0:
            flat.append(x)
            flat.append(y)
        else:
            flat.append(x - px)
            flat.append(y - py)
        px, py = x, y
    return flat


# ─── پیکربندی لایه‌ها ─────────────────────────────────────────
# classes=None یعنی همهٔ کلاس‌ها؛ decimate/мин_km فقط برای خطوط.
LAYERS = {
    'roads': dict(
        zooms=(4, 10),
        lines=dict(
            classes={4: ('motorway', 'trunk', 'primary'), 5: ('motorway', 'trunk', 'primary'),
                     6: ('motorway', 'trunk', 'primary', 'secondary'), 7: None, 8: None, 9: None, 10: None},
            min_km={4: 25, 5: 12, 6: 6, 7: 3, 8: 1.2, 9: 0.6, 10: 0.25},
            decimate={4: 12, 5: 8, 6: 4, 7: 2, 8: 2, 9: 2, 10: 2},
        ),
    ),
    'water': dict(
        zooms=(4, 10),
        lines=dict(
            classes={4: ('river', 'canal'), 5: ('river', 'canal', 'dam'),
                     6: ('river', 'canal', 'dam', 'stream', 'weir'), 7: None, 8: None, 9: None, 10: None},
            min_km={4: 20, 5: 10, 6: 4, 7: 1.5, 8: 0.6, 9: 0.3, 10: 0.12},
            decimate={4: 12, 5: 8, 6: 4, 7: 2, 8: 2, 9: 2, 10: 2},
        ),
        polys=dict(
            classes={4: ('water', 'wetland'), 5: ('water', 'wetland', 'lake'), 6: None,
                     7: None, 8: None, 9: None, 10: None},
            decimate={7: 2, 8: 2, 9: 2, 10: 2},
        ),
    ),
    'places': dict(
        zooms=(4, 9),
        points=dict(
            classes={4: ('city', 'town'), 5: ('city', 'town', 'village'),
                     6: ('city', 'town', 'village'), 7: ('city', 'town', 'village', 'hamlet', 'suburb'),
                     8: None, 9: None},
        ),
    ),
    'pois': dict(
        zooms=(6, 9),
        points=dict(
            classes={6: ('hospital', 'university', 'college', 'fuel', 'bank'),
                     7: ('hospital', 'clinic', 'pharmacy', 'school', 'university', 'college',
                         'fuel', 'bank', 'atm', 'place_of_worship'),
                     8: None, 9: None},
        ),
    ),
    'power': dict(
        zooms=(7, 9),
        lines=dict(classes={7: None, 8: None, 9: None}, min_km={7: 5, 8: 2, 9: 0.8}, decimate={7: 2, 8: 2, 9: 2}),
        points=dict(classes={7: ('substation', 'plant'), 8: None, 9: None}),
    ),
    'railway': dict(
        zooms=(6, 9),
        lines=dict(classes={6: None, 7: None, 8: None, 9: None}, min_km={6: 3, 7: 1.5, 8: 0.6, 9: 0.3}, decimate={7: 2, 8: 2, 9: 2}),
        points=dict(classes={7: ('station',), 8: None, 9: None}),
    ),
    'boundaries': dict(
        zooms=(4, 9),
        lines=dict(classes={4: None, 5: None, 6: None, 7: None, 8: None, 9: None},
                   decimate={4: 4, 5: 2, 6: 2, 7: 2, 8: 2, 9: 2}),
    ),
    'landuse': dict(
        zooms=(6, 9),
        polys=dict(classes={6: ('industrial', 'quarry', 'military'), 7: None, 8: None, 9: None},
                   decimate={7: 2, 8: 2, 9: 2}),
    ),
}

POLY_MAX_TILES = 32  # سقف تایل برای پلی‌گون‌های بزرگ


def main():
    t0 = time.time()
    if os.path.exists(OUT):
        import shutil
        shutil.rmtree(OUT)
    os.makedirs(OUT, exist_ok=True)

    manifest = {'generatedAtUtc': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                'grid': GRID, 'note': 'GeoJSON-style vector tiles built from iran.pbf layers',
                'layers': {}}

    # تایل‌های همهٔ لایه‌ها در یک فایل مشترک ادغام می‌شوند: (z, x, y) -> {layer: body}
    all_tiles = {}
    total_tiles = 0
    for name, cfg in LAYERS.items():
        zmin, zmax = cfg['zooms']
        path = os.path.join(SRC, f'{name}.json')
        if not os.path.exists(path):
            print(f'[skip] {name}: missing {path}')
            continue
        with open(path, encoding='utf-8') as f:
            data = json.load(f)
        lines = data.get('lines') or []
        points = data.get('points') or []
        polys = data.get('polys') or []

        print(f'[load] {name}: {len(lines)} lines, {len(points)} points, {len(polys)} polys')
        layer_stats = {}
        for z in range(zmin, zmax + 1):
            zstart = time.time()
            tiles = {}  # (x, y) -> dict
            n_lines = n_points = n_polys = 0

            # ── خطوط ──
            lcfg = cfg.get('lines')
            if lcfg and lines:
                classes = lcfg.get('classes', {})
                allowed = classes.get(z)
                min_km = lcfg.get('min_km', {}).get(z, 0)
                dec = lcfg.get('decimate', {}).get(z, 1)
                for feat in lines:
                    cls = feat.get('t')
                    if allowed is not None and cls not in allowed:
                        continue
                    pts = feat['c']
                    if len(pts) < 2:
                        continue
                    ln = line_len_km(pts)
                    if ln < min_km:
                        continue
                    dp = decimate(pts, dec)
                    minx = min(p[0] for p in dp)
                    maxx = max(p[0] for p in dp)
                    miny = min(p[1] for p in dp)
                    maxy = max(p[1] for p in dp)
                    for tx, ty in tiles_overlapped(minx, miny, maxx, maxy, z):
                        w, s, e, n_ = tile_bounds(z, tx, ty)
                        runs = clip_polyline(dp, w, e, s, n_, margin=0.0)
                        if not runs:
                            continue
                        qruns = []
                        for run in runs:
                            qruns.append(delta_flat([quantize_pt(x, y, w, s, e, n_) for x, y in run]))
                        out_feat = {'t': cls}
                        if feat.get('n'):
                            out_feat['n'] = feat['n']
                        if feat.get('r'):
                            out_feat['r'] = feat['r']
                        out_feat['c'] = qruns if len(qruns) > 1 else qruns[0]
                        tiles.setdefault((tx, ty), {}).setdefault('lines', []).append(out_feat)
                        n_lines += 1

            # ── نقاط ──
            pcfg = cfg.get('points')
            if pcfg and points:
                classes = pcfg.get('classes', {})
                allowed = classes.get(z)
                for feat in points:
                    cls = feat.get('t')
                    if allowed is not None and cls not in allowed:
                        continue
                    x, y = feat['c']
                    n = 2 ** z
                    tx = max(0, min(n - 1, int((x + 180) / 360 * n)))
                    ty = max(0, min(n - 1, y_from_lat(y, n)))
                    w, s, e, n_ = tile_bounds(z, tx, ty)
                    out_feat = {'t': cls}
                    if feat.get('n'):
                        out_feat['n'] = feat['n']
                    if feat.get('p'):
                        out_feat['p'] = feat['p']
                    out_feat['c'] = quantize_pt(x, y, w, s, e, n_)
                    tiles.setdefault((tx, ty), {}).setdefault('points', []).append(out_feat)
                    n_points += 1

            # ── پلی‌گون‌ها (بدون کلیپ؛ برش با خود canvas) ──
            gcfg = cfg.get('polys')
            if gcfg and polys:
                classes = gcfg.get('classes', {})
                allowed = classes.get(z)
                dec = gcfg.get('decimate', {}).get(z, 1)
                for feat in polys:
                    cls = feat.get('t')
                    if allowed is not None and cls not in allowed:
                        continue
                    ring = decimate(feat['c'][0], dec)
                    if len(ring) < 3:
                        continue
                    minx = min(p[0] for p in ring)
                    maxx = max(p[0] for p in ring)
                    miny = min(p[1] for p in ring)
                    maxy = max(p[1] for p in ring)
                    count = 0
                    for tx, ty in tiles_overlapped(minx, miny, maxx, maxy, z):
                        if count >= POLY_MAX_TILES:
                            break
                        w, s, e, n_ = tile_bounds(z, tx, ty)
                        out_feat = {'t': cls}
                        if feat.get('n'):
                            out_feat['n'] = feat['n']
                        out_feat['c'] = [delta_flat([quantize_pt(x, y, w, s, e, n_) for x, y in ring])]
                        tiles.setdefault((tx, ty), {}).setdefault('polys', []).append(out_feat)
                        count += 1
                        n_polys += 1

            # ── ادغام در تایل‌های مشترک ──
            for (tx, ty), body in tiles.items():
                all_tiles.setdefault((z, tx, ty), {})[name] = body
            layer_stats[z] = {'lines': n_lines, 'points': n_points, 'polys': n_polys,
                              'tiles': len(tiles)}
            print(f'  z{z}: {n_lines} lines, {n_points} points, {n_polys} polys in '
                  f'{len(tiles)} tiles ({time.time() - zstart:.1f}s)')
        manifest['layers'][name] = {'zooms': [zmin, zmax], 'zooms_detail': layer_stats}

    # ── نوشتن نهایی تایل‌ها (هر فایل شامل همهٔ لایه‌ها، فشرده با gzip) ──
    total_tiles = 0
    for (z, tx, ty), layers in all_tiles.items():
        tile_path = os.path.join(OUT, str(z), str(tx))
        os.makedirs(tile_path, exist_ok=True)
        payload = json.dumps({'layers': layers}, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
        with gzip.open(os.path.join(tile_path, f'{ty}.json.gz'), 'wb', compresslevel=9) as f:
            f.write(payload)
        total_tiles += 1

    with open(os.path.join(OUT, 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)
    print(f'\nDone: {total_tiles} tiles in {time.time() - t0:.1f}s → {OUT}')


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    main()
