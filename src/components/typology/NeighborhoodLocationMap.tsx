import { useEffect, useRef, useState } from 'react';
import { Crosshair, LocateFixed, RotateCcw, Trash2, Pentagon } from 'lucide-react';
import L from 'leaflet';
import { PROVINCE_OUTLINES } from '../../data/provinceOutlines';
import { createBasemapLayer } from '../../lib/offlineBasemap';
import type { LocationCandidate, NeighborhoodBoundaryFeature } from './types';

interface Props {
  candidates: LocationCandidate[];
  selectedCandidate: string | null;
  onSelectCandidate: (candidate: LocationCandidate) => void;
  onPickPoint?: (lat: number, lng: number) => void;
  onBoundaryDraft?: (geometry: Record<string, unknown> | null) => void;
  boundaries?: NeighborhoodBoundaryFeature[];
  administrativeBoundaries?: NeighborhoodBoundaryFeature[];
  className?: string;
}

const INITIAL_CENTER: [number, number] = [32.75, 53.7];

function pointOf(candidate: LocationCandidate): [number, number] | null {
  if (!candidate.center) return null;
  return Array.isArray(candidate.center) ? [candidate.center[1], candidate.center[0]] : [candidate.center.lat, candidate.center.lng];
}

export default function NeighborhoodLocationMap({ candidates, selectedCandidate, onSelectCandidate, onPickPoint, onBoundaryDraft, boundaries = [], administrativeBoundaries = [], className = '' }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const boundariesRef = useRef<L.GeoJSON | null>(null);
  const administrativeBoundariesRef = useRef<L.GeoJSON | null>(null);
  const draftLayerRef = useRef<L.Polyline | null>(null);
  const draftPointsRef = useRef<[number, number][]>([]);
  const [drawMode, setDrawMode] = useState(false);
  const [draftCount, setDraftCount] = useState(0);
  const onPickRef = useRef(onPickPoint);
  const onSelectRef = useRef(onSelectCandidate);
  const drawModeRef = useRef(drawMode);
  onPickRef.current = onPickPoint;
  onSelectRef.current = onSelectCandidate;
  drawModeRef.current = drawMode;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { center: INITIAL_CENTER, zoom: 5, minZoom: 4, maxZoom: 19, zoomControl: true });
    createBasemapLayer('light', { maxZoom: 19 }).addTo(map);
    Object.entries(PROVINCE_OUTLINES as Record<string, [number, number][][]>).forEach(([code, rings]) => {
      const latlngs = rings.map((ring) => ring.map(([lng, lat]) => [lat, lng] as [number, number]));
      L.polygon(latlngs, { color: '#94CCAA', weight: 1, fillColor: '#EAF4ED', fillOpacity: 0.18, interactive: false }).addTo(map).bindTooltip(code, { sticky: true });
    });
    map.on('click', (event: L.LeafletMouseEvent) => {
      const { lat, lng } = event.latlng;
      if (drawModeRef.current) {
        draftPointsRef.current = [...draftPointsRef.current, [lat, lng]];
        setDraftCount(draftPointsRef.current.length);
        draftLayerRef.current?.remove();
        draftLayerRef.current = L.polyline(draftPointsRef.current, { color: '#1D5940', weight: 3, dashArray: '6 5' }).addTo(map);
      }
      if (!drawModeRef.current) onPickRef.current?.(lat, lng);
    });
    mapRef.current = map;
    const timer = window.setTimeout(() => map.invalidateSize(), 200);
    return () => { window.clearTimeout(timer); map.remove(); mapRef.current = null; markersRef.current = null; boundariesRef.current = null; administrativeBoundariesRef.current = null; draftLayerRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    boundariesRef.current?.remove();
    if (!boundaries.length) return;
    const layer = L.geoJSON(boundaries as unknown as GeoJSON.GeoJsonObject[], {
      style: (feature) => ({
        color: feature?.properties?.boundary_quality === 'authoritative' ? '#0D9488' : '#2563EB',
        weight: selectedCandidate && feature?.properties?.candidate_id === selectedCandidate ? 3 : 1,
        fillColor: feature?.properties?.boundary_quality === 'authoritative' ? '#5FB485' : '#60A5FA',
        fillOpacity: selectedCandidate && feature?.properties?.candidate_id === selectedCandidate ? 0.42 : 0.12,
      }),
      onEachFeature: (feature, featureLayer) => {
        const props = { ...(feature.properties as LocationCandidate), boundary_available: true, boundary_geojson: feature.geometry as unknown as Record<string, unknown> };
        featureLayer.bindTooltip(`<strong>${props.canonical_name ?? 'محله'}</strong><br/><span>${props.city_or_county ?? ''}، ${props.province ?? ''}</span>`, { sticky: true, direction: 'top' });
        featureLayer.on('click', (event: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(event);
          onSelectRef.current(props);
        });
      },
    }).addTo(map);
    boundariesRef.current = layer;
  }, [boundaries, selectedCandidate]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    administrativeBoundariesRef.current?.remove();
    if (!administrativeBoundaries.length) return;
    const layer = L.geoJSON(administrativeBoundaries as unknown as GeoJSON.GeoJsonObject[], {
      style: { color: '#64748B', weight: 1.4, dashArray: '5 5', fillColor: '#94A3B8', fillOpacity: 0.03, interactive: false },
      onEachFeature: (feature, featureLayer) => {
        const properties = feature.properties as LocationCandidate;
        featureLayer.bindTooltip(`<strong>${properties.canonical_name ?? 'منطقه شهری'}</strong><br/><span>${properties.city_or_county ?? ''}</span>`, { sticky: true, direction: 'top' });
      },
    }).addTo(map);
    administrativeBoundariesRef.current = layer;
  }, [administrativeBoundaries]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current?.clearLayers();
    const group = L.layerGroup().addTo(map);
    candidates.forEach((candidate) => {
      const point = pointOf(candidate);
      if (!point) return;
      const marker = L.circleMarker(point, { radius: candidate.candidate_id === selectedCandidate ? 9 : 6, color: candidate.candidate_id === selectedCandidate ? '#12402D' : '#236B48', fillColor: candidate.candidate_id === selectedCandidate ? '#BBF49C' : '#3C9C6A', fillOpacity: 0.95, weight: 2 });
      marker.bindTooltip(`<strong>${candidate.canonical_name}</strong><br/><span>${candidate.province}${candidate.city_or_county ? `، ${candidate.city_or_county}` : ''}</span>`, { direction: 'top', sticky: true });
      marker.on('click', () => { onSelectRef.current(candidate); map.flyTo(point, Math.max(map.getZoom(), 13), { duration: 0.5 }); });
      marker.addTo(group);
    });
    markersRef.current = group;
    const selected = candidates.find((candidate) => candidate.candidate_id === selectedCandidate);
    const selectedPoint = selected ? pointOf(selected) : null;
    if (selectedPoint) map.flyTo(selectedPoint, Math.max(map.getZoom(), 13), { duration: 0.6 });
  }, [candidates, selectedCandidate]);

  const resetDraft = () => {
    draftPointsRef.current = [];
    setDraftCount(0);
    draftLayerRef.current?.remove();
    draftLayerRef.current = null;
    onBoundaryDraft?.(null);
  };

  const finishDraft = () => {
    if (draftPointsRef.current.length < 3) return;
    const first = draftPointsRef.current[0];
    const coordinates = [...draftPointsRef.current, first].map(([lat, lng]) => [lng, lat]);
    onBoundaryDraft?.({ type: 'Polygon', coordinates: [coordinates] });
    setDrawMode(false);
  };

  return (
    <div className={`typology-map-wrap relative overflow-hidden rounded-lg border border-line bg-surface ${className}`} dir="rtl">
      <div ref={containerRef} className="h-[420px] w-full" />
      <div className="absolute right-3 top-3 z-[500] flex flex-wrap gap-1.5 rounded-md border border-line bg-surface/95 p-1.5 shadow-sm">
        <button type="button" onClick={() => setDrawMode((value) => !value)} className={`inline-flex h-8 items-center gap-1 rounded px-2 text-[9px] font-black ${drawMode ? 'bg-brand-800 text-white' : 'bg-paper text-ink-700 hover:bg-brand-50'}`} title="ترسیم مرز محله"><Pentagon size={13} /> {drawMode ? 'در حال ترسیم' : 'ترسیم مرز'}</button>
        <button type="button" onClick={finishDraft} disabled={draftCount < 3} className="inline-flex size-8 items-center justify-center rounded bg-paper text-ink-600 disabled:opacity-40" title="ثبت مرز ترسیم‌شده" aria-label="ثبت مرز ترسیم‌شده"><Crosshair size={14} /></button>
        <button type="button" onClick={resetDraft} disabled={draftCount === 0} className="inline-flex size-8 items-center justify-center rounded bg-paper text-ink-600 disabled:opacity-40" title="پاک کردن ترسیم" aria-label="پاک کردن ترسیم"><Trash2 size={14} /></button>
        <button type="button" onClick={() => mapRef.current?.locate({ setView: true, maxZoom: 15 })} className="inline-flex size-8 items-center justify-center rounded bg-paper text-ink-600" title="موقعیت من" aria-label="موقعیت من"><LocateFixed size={14} /></button>
        <button type="button" onClick={() => mapRef.current?.setView(INITIAL_CENTER, 5)} className="inline-flex size-8 items-center justify-center rounded bg-paper text-ink-600" title="بازنشانی نمای نقشه" aria-label="بازنشانی نمای نقشه"><RotateCcw size={14} /></button>
      </div>
      <div className="absolute bottom-3 right-3 z-[500] rounded-md border border-line bg-surface/95 px-2.5 py-1.5 text-[9px] font-bold text-ink-600 shadow-sm">{drawMode ? `روی نقشه کلیک کنید؛ ${numberFa(draftCount)} نقطه ثبت شده` : 'نشانگر را انتخاب کنید یا برای مرز دقیق، ترسیم را فعال کنید'}</div>
    </div>
  );
}

function numberFa(value: number): string { return new Intl.NumberFormat('fa-IR').format(value); }
