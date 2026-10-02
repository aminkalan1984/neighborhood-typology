import L from 'leaflet';

/**
 * The preview and many deployments run behind a restricted network.  A map
 * should still be useful in that situation, so the default basemap is drawn
 * locally as a small deterministic grid layer.  Set VITE_EXTERNAL_BASEMAPS=
 * true when a deployment explicitly wants to use an online provider.
 */
export type BasemapStyle = 'dark' | 'light' | 'satellite' | 'topo';

export const externalBasemapsEnabled = import.meta.env.VITE_EXTERNAL_BASEMAPS === 'true';

const STYLE = {
  dark: { background: '#12251f', secondary: '#19372d', grid: 'rgba(187,244,156,.16)', line: 'rgba(187,244,156,.28)', text: '#bbf49c' },
  light: { background: '#eef5f0', secondary: '#e2eee6', grid: 'rgba(29,89,64,.12)', line: 'rgba(29,89,64,.24)', text: '#1d5940' },
  satellite: { background: '#27362d', secondary: '#3e4a36', grid: 'rgba(235,224,177,.16)', line: 'rgba(235,224,177,.28)', text: '#f4e9b6' },
  topo: { background: '#eee7d5', secondary: '#e1d7bd', grid: 'rgba(102,83,47,.16)', line: 'rgba(102,83,47,.28)', text: '#66532f' },
} as const;

function externalUrl(style: BasemapStyle): string {
  switch (style) {
    case 'dark':
      return 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png';
    case 'satellite':
      return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    case 'topo':
      return 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
    case 'light':
    default:
      return 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png';
  }
}

class OfflineBasemapLayer extends L.GridLayer {
  private readonly style: BasemapStyle;

  constructor(style: BasemapStyle, options: L.GridLayerOptions = {}) {
    super({ tileSize: 256, noWrap: true, ...options });
    this.style = style;
  }

  createTile(coords: L.Coords): HTMLElement {
    const tile = document.createElement('canvas');
    tile.width = 256;
    tile.height = 256;
    tile.setAttribute('aria-hidden', 'true');
    tile.className = 'ara-offline-basemap-tile';

    const context = tile.getContext('2d');
    if (!context) return tile;
    const palette = STYLE[this.style];
    const gradient = context.createLinearGradient(0, 0, 256, 256);
    gradient.addColorStop(0, palette.background);
    gradient.addColorStop(1, palette.secondary);
    context.fillStyle = gradient;
    context.fillRect(0, 0, 256, 256);

    // A subtle, deterministic relief texture makes the offline layer legible
    // without pretending that it is a real satellite observation.
    const seed = Math.abs((coords.x * 73856093) ^ (coords.y * 19349663) ^ (coords.z * 83492791));
    context.globalAlpha = 0.13;
    for (let i = 0; i < 7; i += 1) {
      const offset = (seed + i * 37) % 80;
      context.beginPath();
      context.strokeStyle = palette.line;
      context.lineWidth = 1;
      for (let x = -20; x <= 276; x += 8) {
        const y = 28 + i * 34 + Math.sin((x + offset) / 34) * 11;
        if (x === -20) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.stroke();
    }
    context.globalAlpha = 1;

    context.strokeStyle = palette.grid;
    context.lineWidth = 1;
    for (let p = 0; p <= 256; p += 64) {
      context.beginPath(); context.moveTo(p + 0.5, 0); context.lineTo(p + 0.5, 256); context.stroke();
      context.beginPath(); context.moveTo(0, p + 0.5); context.lineTo(256, p + 0.5); context.stroke();
    }

    if (coords.z <= 5) {
      context.fillStyle = palette.text;
      context.globalAlpha = 0.55;
      context.font = '11px sans-serif';
      context.textAlign = 'right';
      context.fillText('آرا · نقشهٔ پایهٔ محلی', 246, 242);
      context.globalAlpha = 1;
    }
    return tile;
  }
}

export function createBasemapLayer(style: BasemapStyle, options: L.GridLayerOptions = {}): L.Layer {
  if (externalBasemapsEnabled) {
    return L.tileLayer(externalUrl(style), {
      maxZoom: 19,
      subdomains: ['a', 'b', 'c', 'd'],
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      ...options,
    });
  }
  return new OfflineBasemapLayer(style, options);
}
