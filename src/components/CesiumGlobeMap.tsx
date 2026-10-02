import { useEffect, useRef, useState } from 'react';
import { Globe, MapPin, RotateCcw } from 'lucide-react';
import { PROVINCE_OUTLINES } from '../data/provinceOutlines';
import { PROVINCES_DATA } from '../data/iranProvincePaths';
import type { SatelliteMapLayerDescriptor } from './SatelliteOperationsPanel';

type CesiumViewer = any;
type CesiumModule = typeof import('cesium');

const COLORS = [
  { min: 0, max: 500000, color: '#1e3a5f' },
  { min: 500000, max: 1500000, color: '#2d5a8e' },
  { min: 1500000, max: 3000000, color: '#4a90d9' },
  { min: 3000000, max: 5000000, color: '#7ab648' },
  { min: 5000000, max: 8000000, color: '#f5a623' },
  { min: 8000000, max: 20000000, color: '#d0021b' },
];

function getColor(v: number): string {
  for (const c of COLORS) { if (v >= c.min && v < c.max) return c.color; }
  return COLORS[COLORS.length - 1].color;
}

function getProvinceData() {
  const out: any[] = [];
  for (const p of PROVINCES_DATA) {
    if (PROVINCE_OUTLINES[p.id]) {
      out.push({ code: p.id, name: p.name, pop: (p.population || 0) * 1e6, lat: p.lat, lng: p.lng });
    }
  }
  return out;
}

export function CesiumGlobeMap({ className = '', satelliteLayer = null }: { className?: string; satelliteLayer?: SatelliteMapLayerDescriptor | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const vr = useRef<CesiumViewer | null>(null);
  const cesiumModuleRef = useRef<CesiumModule | null>(null);
  const satelliteImageryRef = useRef<any>(null);
  const lastSatelliteKeyRef = useRef<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [hover, setHover] = useState<any>(null);
  const [cam, setCam] = useState({ lng: 0, lat: 0, h: 0 });
  const provs = getProvinceData();

  useEffect(() => {
    if (!ref.current || vr.current) return;
    let alive = true;
    (async () => {
      try {
        const C = await import('cesium');
        if (!alive || !ref.current) return;
        cesiumModuleRef.current = C;
        const v = new C.Viewer(ref.current, {
          animation: false, timeline: false, baseLayerPicker: false,
          geocoder: false, homeButton: false, sceneModePicker: false,
          selectionIndicator: false, navigationHelpButton: false,
          infoBox: false, fullscreenButton: false, vrButton: false,
          shouldAnimate: true, baseLayer: false,
        });
        v.scene.backgroundColor = C.Color.fromCssColorString('#0f172a');
        v.scene.globe.baseColor = C.Color.fromCssColorString('#1e293b');
        v.scene.fog.enabled = true;
        v.scene.globe.enableLighting = true;
        v.scene.skyAtmosphere.show = true;
        v.camera.setView({
          destination: C.Cartesian3.fromDegrees(53.6880, 32.4279, 8000000),
          orientation: { heading: 0, pitch: C.Math.toRadians(-45), roll: 0 },
        });
        const ds = new C.CustomDataSource('provinces');
        v.dataSources.add(ds);
        Object.entries(PROVINCE_OUTLINES).forEach(([code, rings]) => {
          if (!rings?.[0]) return;
          const ring = rings[0];
          const pos = ring.map(([lng, lat]: [number, number]) => C.Cartesian3.fromDegrees(lng, lat));
          const d = provs.find(p => p.code === code);
          const pop = d?.pop || 0;
          ds.entities.add({
            polygon: { hierarchy: new C.PolygonHierarchy(pos),
              material: C.Color.fromCssColorString(getColor(pop)).withAlpha(0.35),
              outline: true, outlineColor: C.Color.fromCssColorString('#60a5fa').withAlpha(0.6),
              outlineWidth: 2, height: 0 },
            properties: { code, name: d?.name || code, population: pop },
          });
          if (d) {
            const cLng = ring.reduce((s: number, p: number[]) => s + p[0], 0) / ring.length;
            const cLat = ring.reduce((s: number, p: number[]) => s + p[1], 0) / ring.length;
            ds.entities.add({
              position: C.Cartesian3.fromDegrees(cLng, cLat, 1000),
              label: { text: d.name, font: '12px sans-serif',
                fillColor: C.Color.WHITE, outlineColor: C.Color.BLACK, outlineWidth: 2,
                style: C.LabelStyle.FILL_AND_OUTLINE, scale: 0.9, showBackground: true,
                backgroundColor: C.Color.fromCssColorString('#1e293b').withAlpha(0.7) },
            });
          }
        });
        const ps = new C.CustomDataSource('points');
        v.dataSources.add(ps);
        provs.forEach(p => {
          const sz = Math.max(3, Math.min(20, p.pop / 1000000));
          ps.entities.add({
            position: C.Cartesian3.fromDegrees(p.lng, p.lat, 5000),
            point: { pixelSize: sz,
              color: C.Color.fromCssColorString(getColor(p.pop)).withAlpha(0.8),
              outlineColor: C.Color.WHITE.withAlpha(0.5), outlineWidth: 1,
              heightReference: C.HeightReference.CLAMP_TO_GROUND },
            label: { text: p.pop > 1e6 ? (p.pop/1e6).toFixed(1)+'M' : (p.pop/1e3).toFixed(0)+'K',
              font: '10px sans-serif', fillColor: C.Color.WHITE,
              outlineColor: C.Color.BLACK, outlineWidth: 1,
              style: C.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new C.Cartesian2(0,-10),
              scale: 0.8, showBackground: true,
              backgroundColor: C.Color.fromCssColorString('#1e293b').withAlpha(0.8) },
            properties: { ...p },
          });
        });

        const h = new C.ScreenSpaceEventHandler(v.scene.canvas);
        h.setInputAction((ev: any) => {
          const pk = v.scene.pick(ev.endPosition);
          if (C.defined(pk) && pk.id?.properties) {
            const p = pk.id.properties;
            setHover({ code: p.code, name: p.name, pop: p.population });
          } else setHover(null);
        }, C.ScreenSpaceEventType.MOUSE_MOVE);
        v.camera.changed.addEventListener(() => {
          const c = v.camera.positionCartographic;
          setCam({ lng: C.Math.toDegrees(c.longitude), lat: C.Math.toDegrees(c.latitude), h: c.height });
        });
        vr.current = v;
        setLoaded(true);
      } catch (e) { console.error('Cesium init failed:', e); }
    })();
    return () => { alive = false; if (vr.current) { vr.current.destroy(); vr.current = null; } cesiumModuleRef.current = null; satelliteImageryRef.current = null; };
  }, []);

  useEffect(() => {
    const viewer = vr.current;
    const C = cesiumModuleRef.current;
    if (!loaded || !viewer || !C) return;
    if (satelliteImageryRef.current) {
      viewer.imageryLayers.remove(satelliteImageryRef.current, true);
      satelliteImageryRef.current = null;
    }
    if (!satelliteLayer) {
      lastSatelliteKeyRef.current = null;
      return;
    }
    const [west, south, east, north] = satelliteLayer.bounds;
    const rectangle = C.Rectangle.fromDegrees(west, south, east, north);
    const provider = new C.UrlTemplateImageryProvider({
      url: satelliteLayer.tileUrl,
      rectangle,
      minimumLevel: 0,
      maximumLevel: 24,
      credit: satelliteLayer.attribution,
    });
    const imagery = viewer.imageryLayers.addImageryProvider(provider);
    imagery.alpha = satelliteLayer.opacity;
    satelliteImageryRef.current = imagery;
    const key = `${satelliteLayer.jobId}:${satelliteLayer.artifactName}`;
    if (lastSatelliteKeyRef.current !== key) {
      viewer.camera.flyTo({ destination: rectangle, duration: 1.4 });
      lastSatelliteKeyRef.current = key;
    }
  }, [loaded, satelliteLayer]);

  const flyHome = () => {
    const C = cesiumModuleRef.current;
    if (!vr.current || !C) return;
    try {
      vr.current.camera.flyTo({
        destination: C.Cartesian3.fromDegrees(53.6880, 32.4279, 8000000),
        orientation: { heading: 0, pitch: C.Math.toRadians(-45), roll: 0 },
        duration: 2,
      });
    } catch(e) { console.error(e); }
  };

  return (
    <div className={'relative ' + className}>
      <div className='absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-slate-900/95 to-transparent p-4'>
        <div className='flex items-center justify-between'>
          <div className='flex items-center gap-3'>
            <Globe className='w-6 h-6 text-blue-400' />
            <div>
              <h2 className='text-lg font-bold text-white'>{'\u0646\u0642\u0634\u0647 \u0633\u0647\u200c\u0628\u0639\u062f\u06cc \u0627\u06cc\u0631\u0627\u0646'}</h2>
              <p className='text-xs text-slate-400'>
                {cam.h > 1e6 ? (cam.h/1e6).toFixed(1)+' Mm' : (cam.h/1e3).toFixed(0)+' km'}
                {' \u2014 '}{cam.lat.toFixed(2)}{'\u00b0N, '}{cam.lng.toFixed(2)}{'\u00b0E'}
              </p>
            </div>
          </div>
          <button onClick={flyHome} className='p-2 bg-slate-800/80 rounded-lg hover:bg-slate-700'>
            <RotateCcw className='w-4 h-4 text-slate-300' />
          </button>
        </div>
      </div>
      <div ref={ref} className='w-full h-full bg-slate-900' style={{ minHeight: '600px' }} />
      {hover && (
        <div className='absolute bottom-4 left-4 z-10 bg-slate-900/95 backdrop-blur-sm rounded-xl border border-slate-700/50 p-4 min-w-64'>
          <div className='flex items-center gap-2 mb-2'>
            <MapPin className='w-5 h-5 text-blue-400' />
            <h3 className='font-bold text-white'>{hover.name}</h3>
          </div>
          <div className='text-sm text-slate-300'>
            {'\u062c\u0645\u0639\u06cc\u062a: '}{hover.pop > 1e6 ? (hover.pop/1e6).toFixed(1)+'M' : (hover.pop/1e3).toFixed(0)+'K'}
          </div>
        </div>
      )}
      {!loaded && (
        <div className='absolute inset-0 z-30 bg-slate-900 flex items-center justify-center'>
          <div className='text-center'>
            <Globe className='w-16 h-16 text-blue-500 animate-spin mx-auto mb-4' />
            <h3 className='text-xl font-bold text-white'>{'\u0628\u0627\u0631\u06af\u0630\u0627\u0631\u06cc \u0646\u0642\u0634\u0647...'}</h3>
          </div>
        </div>
      )}
    </div>
  );
}

export default CesiumGlobeMap;
