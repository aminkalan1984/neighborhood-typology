// ============================================================
// نقشهٔ تعاملی انتخاب نقطه — Leaflet (OSM)
// بزرگ‌نمایی تا سطح خیابان/محله، چندضلعی‌های استان رنگ‌شده بر
// مبنای SI، انتخاب نقطه با کلیک/درگ نشانگر، و پرواز به نقطهٔ
// انتخابی (جستجو/مکان من/بارگذاری نتیجهٔ ذخیره‌شده)
// ============================================================
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { PROVINCE_OUTLINES } from '../data/provinceOutlines';
import { PROVINCES_DATA } from '../data/iranProvincePaths';
import { createBasemapLayer } from '../lib/offlineBasemap';

const SI_HEX = ['#E5484D', '#F5A524', '#E3C028', '#2E9E6B'] as const;

export interface TypologyPoint {
  lat: number;
  lng: number;
}

interface Props {
  provinceSi: Map<string, number>;
  selectedProvince: string | null;
  onSelectProvince: (code: string | null) => void;
  pickMode: boolean;
  point: TypologyPoint | null;
  onPick: (lat: number, lng: number) => void;
  flySignal: number;
  className?: string;
}

function provinceFaName(code: string): string {
  return PROVINCES_DATA.find((p) => p.id === code)?.name ?? code;
}

function siColorOf(si: number | undefined): string {
  if (si == null) return '#E7EDEB';
  return si < 2 ? SI_HEX[0] : si < 3 ? SI_HEX[1] : si < 4 ? SI_HEX[2] : SI_HEX[3];
}

export default function TypologyPickerMap({
  provinceSi,
  selectedProvince,
  onSelectProvince,
  pickMode,
  point,
  onPick,
  flySignal,
  className = '',
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const polygonsRef = useRef<Map<string, L.Polygon>>(new Map());
  const markerRef = useRef<L.Marker | null>(null);
  const onPickRef = useRef(onPick);
  const pickModeRef = useRef(pickMode);
  const selectedProvinceRef = useRef(selectedProvince);
  const provinceSiRef = useRef(provinceSi);
  onPickRef.current = onPick;
  pickModeRef.current = pickMode;
  selectedProvinceRef.current = selectedProvince;
  provinceSiRef.current = provinceSi;

  // ─── ساخت نقشه + چندضلعی‌های استان ─────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [32.9, 53.5],
      zoom: 5,
      minZoom: 4,
      maxZoom: 18,
      zoomControl: true,
      attributionControl: true,
    });
    createBasemapLayer('light', { maxZoom: 19 }).addTo(map);
    mapRef.current = map;

    // نشانگر نقطهٔ انتخابی (قابل درگ برای اصلاح دقیق)
    const icon = L.divIcon({
      className: 'typology-pick-marker',
      html: '<div class="typology-ping"></div><div class="typology-core"></div>',
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });
    const marker = L.marker([0, 0], { icon, draggable: true, interactive: true }).addTo(map);
    marker.on('dragend', () => {
      const p = marker.getLatLng();
      onPickRef.current(p.lat, p.lng);
    });
    markerRef.current = marker;

    // کلیک روی نقشه در حالت انتخاب نقطه
    map.on('click', (e: L.LeafletMouseEvent) => {
      if (!pickModeRef.current) return;
      onPickRef.current(e.latlng.lat, e.latlng.lng);
    });

    // چندضلعی‌های مرز استان‌ها (مختصات واقعی WGS84)
    Object.entries(PROVINCE_OUTLINES).forEach(([code, rings]) => {
      const latlngs = rings.map((ring) => ring.map(([lng, lat]) => [lat, lng] as [number, number]));
      const poly = L.polygon(latlngs, {
        color: '#ffffff',
        weight: 1.1,
        fillColor: '#E7EDEB',
        fillOpacity: 0.72,
        interactive: true,
      }).addTo(map);
      poly.on('click', (e: L.LeafletMouseEvent) => {
        if (pickModeRef.current) return;
        L.DomEvent.stopPropagation(e);
        onSelectProvince(selectedProvinceRef.current === code ? null : code);
      });
      poly.bindTooltip(
        () => {
          const si = provinceSiRef.current.get(code);
          const name = provinceFaName(code);
          const fill = siColorOf(si);
          return (
            `<div class="typology-tip" dir="rtl">` +
            `<span class="tip-name">${name}</span>` +
            `<span class="tip-si" style="color:${fill}">${si == null ? 'بدون داده' : `SI ${si.toFixed(1)}`}</span>` +
            `</div>`
          );
        },
        { sticky: true, direction: 'top', className: 'typology-tooltip' },
      );
      polygonsRef.current.set(code, poly);
    });

    // رفع مشکل کاشی‌های خاکستری پس از رندر/تغییر اندازه
    const t = window.setTimeout(() => map.invalidateSize(), 260);
    return () => {
      window.clearTimeout(t);
      map.remove();
      mapRef.current = null;
      polygonsRef.current.clear();
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── همگام‌سازی رنگ/برجستگی استان‌ها با SI و فیلتر ─────────
  useEffect(() => {
    polygonsRef.current.forEach((poly, code) => {
      const si = provinceSi.get(code);
      const active = selectedProvince === code;
      poly.setStyle({
        fillColor: siColorOf(si),
        fillOpacity: active ? 0.9 : 0.72,
        color: active ? '#1D5940' : '#ffffff',
        weight: active ? 2.4 : 1.1,
      });
      if (active) poly.bringToFront();
    });
  }, [provinceSi, selectedProvince]);

  // ─── فعال/غیرفعال کردن تعامل چندضلعی‌ها در حالت انتخاب نقطه ─
  useEffect(() => {
    polygonsRef.current.forEach((poly) => {
      const map = mapRef.current;
      if (!map) return;
      if (poly.options.interactive === !pickMode) return;
      map.removeLayer(poly);
      poly.options.interactive = !pickMode;
      poly.addTo(map);
      if (pickMode) poly.unbindTooltip();
      else {
        const code = [...polygonsRef.current].find(([, p]) => p === poly)?.[0];
        if (code) {
          poly.bindTooltip(
            () => {
              const si = provinceSiRef.current.get(code);
              const name = provinceFaName(code);
              return (
                `<div class="typology-tip" dir="rtl"><span class="tip-name">${name}</span>` +
                `<span class="tip-si" style="color:${siColorOf(si)}">${si == null ? 'بدون داده' : `SI ${si.toFixed(1)}`}</span></div>`
              );
            },
            { sticky: true, direction: 'top', className: 'typology-tooltip' },
          );
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickMode]);

  // ─── جابه‌جایی نشانگر با نقطهٔ انتخاب‌شده ───────────────────
  useEffect(() => {
    if (!markerRef.current || !point) return;
    markerRef.current.setLatLng([point.lat, point.lng]);
  }, [point]);

  // ─── پرواز به نقطه (جستجوی نام / مکان من / بارگذاری) ───────
  useEffect(() => {
    if (!mapRef.current || !point || flySignal === 0) return;
    mapRef.current.flyTo([point.lat, point.lng], Math.max(mapRef.current.getZoom(), 13), { duration: 0.9 });
  }, [flySignal, point]);

  return (
    <div
      ref={containerRef}
      className={`w-full h-[460px] md:h-[540px] rounded-xl overflow-hidden typology-map-wrap ${className}`}
    />
  );
}
