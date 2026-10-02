/**
 * P0 — دروازهٔ عمومی منابع: `/api/sources`.
 *
 * یک route به‌ازای هر transport، نه به‌ازای هر منبع. منبع جدید = منیفست +
 * کانکتور؛ این فایل هرگز برای منبع تازه ویرایش نمی‌شود.
 */

import crypto from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { SourceRuntime } from './runtime';
import { SourceConfigError, SourceQueryError, createConnectors } from './connectors';
import { getManifest, listManifests, toSummary, validateManifests, declaredRegistryIds, indicatorsForSource, scoredFeedsForSource, scoreEligibleSourceIds } from './manifests';
import type { Connector, ConnectorContext } from './types';

export interface SourceRouterOptions {
  runtime?: SourceRuntime;
  /** جایگزینی کانکتورها برای تست */
  connectors?: Connector[];
  overpassEndpoints?: string[];
  localPoiPath?: string;
}

const IRAN_BOUNDS = { latMin: 24, latMax: 40.5, lngMin: 43, lngMax: 64 };

function correlationId(req: Request): string {
  const incoming = req.header('x-correlation-id')?.trim();
  return incoming && incoming.length <= 128 ? incoming : crypto.randomUUID();
}

function parsePoint(query: Request['query']): { lat: number; lng: number } | undefined {
  if (query.lat === undefined && query.lng === undefined) return undefined;
  const lat = Number(query.lat);
  const lng = Number(query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new SourceQueryError('مختصات نامعتبر: lat و lng باید عدد باشند.');
  if (lat < IRAN_BOUNDS.latMin || lat > IRAN_BOUNDS.latMax || lng < IRAN_BOUNDS.lngMin || lng > IRAN_BOUNDS.lngMax) {
    throw new SourceQueryError('مختصات خارج از محدودهٔ پشتیبانی‌شده است.');
  }
  return { lat, lng };
}

function parseBbox(query: Request['query']): [number, number, number, number] | undefined {
  const raw = query.bbox;
  if (raw === undefined) return undefined;
  const parts = String(raw).split(',').map(v => Number(v.trim()));
  if (parts.length !== 4 || parts.some(v => !Number.isFinite(v))) {
    throw new SourceQueryError('bbox نامعتبر است؛ قالب درست: west,south,east,north');
  }
  const [west, south, east, north] = parts;
  if (west >= east || south >= north) throw new SourceQueryError('bbox نامعتبر است؛ west<east و south<north لازم است.');
  return [west, south, east, north];
}

export function createSourceRouter(options: SourceRouterOptions = {}): Router {
  const runtime = options.runtime ?? new SourceRuntime();
  const connectors = options.connectors ?? createConnectors({
    runtime,
    overpassEndpoints: options.overpassEndpoints,
    localPoiPath: options.localPoiPath,
  });
  const byId = new Map(connectors.map(c => [c.manifest.id, c]));
  const router = Router();

  router.get('/', (_req, res) => {
    const validation = validateManifests();
    res.json({
      success: true,
      data: {
        count: connectors.length,
        declared: listManifests().length,
        registryLinks: declaredRegistryIds(),
        scoreEligible: scoreEligibleSourceIds(),
        validation: { ok: validation.ok, errors: validation.errors, warnings: validation.warnings },
        sources: connectors.map(c => ({
          ...toSummary(c.manifest),
          indicators: indicatorsForSource(c.manifest.id),
          scoredIndicators: scoredFeedsForSource(c.manifest.id).map(f => f.indicatorCode as string),
          health: runtime.health(c.manifest.id),
          queryable: true,
        })),
      },
    });
  });

  router.get('/health', (_req, res) => {
    res.json({ success: true, data: { sources: runtime.listHealth() } });
  });

  router.get('/:id', (req, res) => {
    const manifest = getManifest(req.params.id);
    if (!manifest) {
      return res.status(404).json({ success: false, error: { code: 'SOURCE_NOT_FOUND', message: `منبع «${req.params.id}» اعلان نشده است.` } });
    }
    const connector = byId.get(manifest.id);
    res.json({ success: true, data: { manifest, indicators: indicatorsForSource(manifest.id), queryable: Boolean(connector), health: runtime.health(manifest.id) } });
  });

  router.get('/:id/health', (req, res) => {
    const manifest = getManifest(req.params.id);
    if (!manifest) {
      return res.status(404).json({ success: false, error: { code: 'SOURCE_NOT_FOUND', message: `منبع «${req.params.id}» اعلان نشده است.` } });
    }
    res.json({ success: true, data: runtime.health(manifest.id) });
  });

  router.get('/:id/query', async (req: Request, res: Response) => {
    const manifest = getManifest(req.params.id);
    const id = correlationId(req);
    res.setHeader('X-Correlation-ID', id);
    res.setHeader('X-Source', req.params.id);

    if (!manifest) {
      return res.status(404).json({ success: false, error: { code: 'SOURCE_NOT_FOUND', message: `منبع «${req.params.id}» اعلان نشده است.` } });
    }
    const connector = byId.get(manifest.id);
    if (!connector) {
      return res.status(501).json({ success: false, error: { code: 'CONNECTOR_NOT_IMPLEMENTED', message: `منبع «${manifest.id}» اعلان شده اما کانکتور ندارد.` } });
    }

    let ctx: ConnectorContext;
    try {
      ctx = { point: parsePoint(req.query), bbox: parseBbox(req.query), zoneId: req.query.zone ? String(req.query.zone) : undefined, at: req.query.at ? String(req.query.at) : undefined };
    } catch (error) {
      const issue = error instanceof SourceQueryError ? error : new SourceQueryError('پرس‌وجوی نامعتبر.');
      return res.status(issue.status).json({ success: false, error: { code: 'INVALID_QUERY', message: issue.message } });
    }

    if (manifest.spatial === 'point' && !ctx.point && !ctx.bbox) {
      return res.status(400).json({ success: false, error: { code: 'POINT_REQUIRED', message: `منبع «${manifest.id}» به lat و lng نیاز دارد.` } });
    }
    if (manifest.spatial === 'bbox' && !ctx.bbox && !ctx.point) {
      return res.status(400).json({ success: false, error: { code: 'BBOX_REQUIRED', message: `منبع «${manifest.id}» به bbox یا lat/lng نیاز دارد.` } });
    }

    try {
      const value = await connector.query(ctx);
      res.setHeader('X-Cache', value.provenance.cache);
      res.setHeader('X-Source-Provider', value.provenance.provider);
      if (value.provenance.fallbackFrom) res.setHeader('X-Source-Fallback', value.provenance.fallbackFrom);
      if (value.provenance.cache === 'STALE') res.setHeader('Warning', '110 - response is stale');
      return res.json({ success: true, data: value });
    } catch (error) {
      const status = error instanceof SourceQueryError ? error.status : error instanceof SourceConfigError ? 503 : 502;
      const code = error instanceof SourceQueryError ? 'INVALID_QUERY' : error instanceof SourceConfigError ? 'SOURCE_NOT_CONFIGURED' : 'SOURCE_FAILED';
      return res.status(status).json({
        success: false,
        error: {
          code,
          message: error instanceof Error ? error.message : 'منبع پاسخ نداد.',
          sourceId: manifest.id,
          envVar: error instanceof SourceConfigError ? error.envVar : undefined,
        },
        correlation_id: id,
      });
    }
  });

  return router;
}
