import type {
  CreateTypologyRunRequest,
  DomainKey,
  DomainResult,
  LocationCandidate,
  LocationSearchResult,
  NeighborhoodBoundaryFeature,
  TypologyExplanation,
  TypologyDataCatalogSummary,
  TypologyReport,
  TypologyRunSummary,
} from './types';

const API_ROOT = '/api/typology';

type ApiEnvelope<T> = { success?: boolean; data?: T; error?: { message?: string } } | T;

export type TypologyActionResponse = TypologyRunSummary & Record<string, unknown>;

export interface TypologyReviewInput {
  reviewer_id: string;
  reviewer_name?: string;
  decision: 'approve' | 'reject';
  reason?: string;
}

export interface TypologyRequestOptions {
  signal?: AbortSignal;
}

export class TypologyApiError extends Error {
  status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = 'TypologyApiError';
    this.status = status;
  }
}

export function isTypologyAbortError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      'name' in error &&
      (error as { name?: unknown }).name === 'AbortError',
  );
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_ROOT}${path}`, {
      ...init,
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    });
  } catch (error) {
    if (isTypologyAbortError(error)) throw error;
    throw new TypologyApiError('سرویس گونه‌شناسی در دسترس نیست. اتصال سرویس را بررسی کنید.');
  }

  const raw = await response.text();
  let payload: ApiEnvelope<T> | null = null;
  if (raw) {
    try {
      payload = JSON.parse(raw) as ApiEnvelope<T>;
    } catch {
      throw new TypologyApiError('پاسخ سرویس گونه‌شناسی معتبر نیست.', response.status);
    }
  }

  if (!response.ok) {
    const envelope = payload as { error?: { message?: string }; message?: string } | null;
    throw new TypologyApiError(
      envelope?.error?.message || envelope?.message || `خطای سرویس با کد ${response.status}`,
      response.status,
    );
  }

  if (payload && typeof payload === 'object' && 'success' in payload) {
    const envelope = payload as { success?: boolean; data?: T; error?: { message?: string } };
    if (envelope.success === false) {
      throw new TypologyApiError(envelope.error?.message || 'عملیات سرویس ناموفق بود.', response.status);
    }
    return envelope.data as T;
  }

  return payload as T;
}

export function createTypologyRun(input: CreateTypologyRunRequest, options?: TypologyRequestOptions): Promise<TypologyRunSummary> {
  return request<TypologyRunSummary>('/runs', { method: 'POST', body: JSON.stringify(input), signal: options?.signal });
}

export async function listTypologyRuns(limit = 8, options?: TypologyRequestOptions): Promise<TypologyRunSummary[]> {
  const payload = await request<unknown>(`/runs?limit=${Math.max(1, Math.min(50, Math.trunc(limit)))}`, { signal: options?.signal });
  const source = record(payload);
  const rows = Array.isArray(payload) ? payload : Array.isArray(source.runs) ? source.runs : [];
  return rows.map((item) => normalizeRunSummary(item));
}

export async function getTypologyRun(runId: string, options?: TypologyRequestOptions): Promise<TypologyRunSummary> {
  return normalizeRunSummary(await request<unknown>(`/runs/${encodeURIComponent(runId)}`, { signal: options?.signal }), runId);
}

export async function getLocationCandidates(runId: string, options?: TypologyRequestOptions): Promise<LocationCandidate[]> {
  const payload = await request<{ candidates?: LocationCandidate[] } | LocationCandidate[]>(`/runs/${runId}/candidates`, { signal: options?.signal });
  const rows = Array.isArray(payload) ? payload : payload.candidates ?? [];
  return rows.map((item) => {
    const source = item as unknown as Record<string, unknown>;
    const rawCenter = record(source.center);
    const center = Array.isArray(source.center)
      ? source.center as [number, number]
      : typeof rawCenter.lat === 'number' && typeof (rawCenter.lng ?? rawCenter.lon) === 'number'
        ? { lat: rawCenter.lat, lng: Number(rawCenter.lng ?? rawCenter.lon) }
        : null;
    const sourceRows = Array.isArray(source.sources) ? source.sources.map(record) : [];
    return {
      candidate_id: String(source.candidate_id ?? source.id ?? ''),
      canonical_name: String(source.canonical_name ?? source.name ?? 'گزینهٔ مکانی'),
      alternative_names: Array.isArray(source.alternative_names) ? source.alternative_names.map(String) : [],
      province: String(source.province ?? ''),
      province_id: String(source.province_id ?? record(source.hierarchy).province_code ?? ''),
      city_or_county: String(source.city_or_county ?? ''),
      settlement_type: String(source.settlement_type ?? ''),
      confidence: numberOrNull(source.confidence) ?? 0,
      source: String(source.source ?? (sourceRows.map((entry) => [entry.type, entry.id].filter(Boolean).join(':')).join('، ') || 'منبع ثبت نشده')),
      center,
      boundary_available: Boolean(source.boundary_available ?? source.boundary_geojson),
      boundary_geojson: source.boundary_geojson ? record(source.boundary_geojson) : null,
      boundary_quality: source.boundary_quality === 'authoritative' ? 'authoritative' : source.boundary_quality === 'confirmed_osm' ? 'confirmed_osm' : source.boundary_quality === 'provisional' ? 'provisional' : undefined,
      municipality_region: typeof source.municipality_region === 'number' ? source.municipality_region : undefined,
      municipality_region_name: source.municipality_region_name ? String(source.municipality_region_name) : undefined,
      district_name: source.district_name ? String(source.district_name) : undefined,
      area_km2: typeof source.area_km2 === 'number' ? source.area_km2 : null,
      perimeter_km: typeof source.perimeter_km === 'number' ? source.perimeter_km : null,
      source_detail: source.source_detail ? String(source.source_detail) : undefined,
      data_quality_note: source.data_quality_note ? String(source.data_quality_note) : undefined,
      tentative_match: source.tentative_match === true,
      administrative_id: String(source.administrative_id ?? source.id ?? ''),
    };
  });
}

export async function searchLocations(query: string, options?: TypologyRequestOptions): Promise<LocationSearchResult[]> {
  const normalized = query.trim();
  if (normalized.length < 2) return [];
  const payload = await request<{ results?: LocationSearchResult[] }>(`/locations/search?q=${encodeURIComponent(normalized)}&limit=20`, { signal: options?.signal });
  const rows = Array.isArray(payload) ? payload : payload.results ?? [];
  return rows.map((item) => ({
    ...item,
    candidate_id: String(item.candidate_id ?? ''),
    canonical_name: String(item.canonical_name ?? 'محدوده بدون نام'),
    province: String(item.province ?? ''),
    city_or_county: String(item.city_or_county ?? ''),
    confidence: Number(item.confidence ?? 0),
    source: String(item.source ?? 'منبع محلی'),
    center: item.center ?? null,
    boundary_available: Boolean(item.boundary_available),
    match_reason: String(item.match_reason ?? 'تطبیق نام'),
  }));
}

export async function getNearbyLocations(lat: number, lng: number, options?: TypologyRequestOptions): Promise<LocationSearchResult[]> {
  const payload = await request<{ results?: LocationSearchResult[] }>(`/locations/nearby?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&limit=12`, { signal: options?.signal });
  return (payload.results ?? []).map((item) => ({ ...item, match_reason: String(item.match_reason ?? 'محدوده مجاور') }));
}

export async function getNeighborhoodBoundaries(city?: string, options?: TypologyRequestOptions): Promise<NeighborhoodBoundaryFeature[]> {
  const suffix = city ? `?city=${encodeURIComponent(city)}` : '';
  const payload = await request<{ features?: NeighborhoodBoundaryFeature[] }>(`/locations/boundaries${suffix}`, { signal: options?.signal });
  return Array.isArray(payload.features) ? payload.features : [];
}

export async function getAdministrativeBoundaries(city?: string, options?: TypologyRequestOptions): Promise<NeighborhoodBoundaryFeature[]> {
  const suffix = city ? `?city=${encodeURIComponent(city)}` : '';
  const payload = await request<{ features?: NeighborhoodBoundaryFeature[] }>(`/locations/administrative-boundaries${suffix}`, { signal: options?.signal });
  return Array.isArray(payload.features) ? payload.features : [];
}

export function confirmBoundary(
  runId: string,
  input: { candidate_id: string; boundary_geojson: Record<string, unknown>; source?: string; version?: string },
  options?: TypologyRequestOptions,
): Promise<TypologyRunSummary> {
  return request<TypologyRunSummary>(`/runs/${runId}/boundary-confirmation`, {
    method: 'POST',
    body: JSON.stringify({
      candidate_id: input.candidate_id,
      boundary_geojson: input.boundary_geojson,
      source: input.source ?? 'user_supplied',
      version: input.version ?? 'user-upload-v1',
      crs: 'EPSG:4326',
      approved_at: new Date().toISOString(),
    }),
    signal: options?.signal,
  });
}

export function startTypologyRun(runId: string, options?: TypologyRequestOptions): Promise<TypologyRunSummary | Record<string, unknown>> {
  return request<TypologyRunSummary | Record<string, unknown>>(`/runs/${runId}/start`, {
    method: 'POST',
    body: JSON.stringify({}),
    signal: options?.signal,
  });
}

export async function addTypologyEvidence(
  runId: string,
  records: Record<string, unknown>[] | Record<string, unknown>,
  idempotencyKey?: string,
): Promise<TypologyActionResponse> {
  const rows = Array.isArray(records) ? records : [records];
  return normalizeRunSummary(await request<unknown>(`/runs/${encodeURIComponent(runId)}/evidence`, {
    method: 'POST',
    ...(idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : {}),
    body: JSON.stringify({ records: rows }),
  }), runId) as TypologyActionResponse;
}

export async function collectLocalTypologyEvidence(
  runId: string,
  options?: TypologyRequestOptions & { maxRecords?: number },
): Promise<TypologyActionResponse> {
  return normalizeRunSummary(await request<unknown>(`/runs/${encodeURIComponent(runId)}/auto-evidence`, {
    method: 'POST',
    headers: { 'Idempotency-Key': `local-catalog:${runId}` },
    body: JSON.stringify({ max_records: options?.maxRecords ?? 180 }),
    signal: options?.signal,
  }), runId) as TypologyActionResponse;
}

export async function recomputeTypologyRun(runId: string): Promise<TypologyActionResponse> {
  return normalizeRunSummary(await request<unknown>(`/runs/${encodeURIComponent(runId)}/recompute`, {
    method: 'POST',
    body: JSON.stringify({}),
  }), runId) as TypologyActionResponse;
}

export async function approveTypologyRun(runId: string, input: TypologyReviewInput): Promise<TypologyActionResponse> {
  return normalizeRunSummary(await request<unknown>(`/runs/${encodeURIComponent(runId)}/approve`, {
    method: 'POST',
    body: JSON.stringify(input),
  }), runId) as TypologyActionResponse;
}

export async function getTypologyCoverage(runId: string): Promise<Record<string, unknown>> {
  const payload = await request<unknown>(`/runs/${encodeURIComponent(runId)}/coverage`);
  return record(payload);
}

export async function getTypologyDataCatalog(): Promise<TypologyDataCatalogSummary> {
  return request<TypologyDataCatalogSummary>('/data-catalog/summary');
}

export async function getTypologyReport(runId: string, options?: TypologyRequestOptions): Promise<TypologyReport> {
  const payload = await request<Record<string, unknown>>(`/runs/${runId}/report`, { signal: options?.signal });
  return normalizeReport(payload, runId);
}

export async function explainTypologyReport(runId: string, options?: TypologyRequestOptions): Promise<TypologyExplanation> {
  const payload = await request<Record<string, unknown>>(`/runs/${runId}/explain`, {
    method: 'POST',
    body: JSON.stringify({
      intent: 'explain_verified_measurements_only',
      language: 'fa',
      forbid_numeric_inference: true,
    }),
    signal: options?.signal,
  });
  return {
    text: String(payload.text ?? payload.explanation ?? payload.summary ?? 'توضیحی از سرویس دریافت نشد.'),
    generated_by: String(payload.generated_by ?? payload.mode ?? (payload.ai_used === true ? 'ai' : 'deterministic')),
    caveats: Array.isArray(payload.caveats)
      ? payload.caveats.map(String)
      : payload.warning
        ? [String(payload.warning)]
        : [],
  };
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readableText(value: unknown, fallback = ''): string {
  if (value === undefined || value === null) return fallback;
  const text = String(value).trim();
  return text && !/^[?\uFFFD\s]+$/u.test(text) ? text : fallback;
}

const missingReasonLabels: Record<string, string> = {
  survey_data_not_received: 'بسته پیمایش معتبر دریافت نشده است.',
  field_audit_not_received: 'ممیزی میدانی معتبر دریافت نشده است.',
  organizational_data_not_received: 'داده سازمانی معتبر دریافت نشده است.',
  approved_connector_not_executed: 'اتصال دهنده مصوب داده اجرا نشده است.',
  approved_source_not_configured: 'منبع مصوب تامین داده تعیین نشده است.',
  measurement_not_available: 'اندازه گیری معتبر در دسترس نیست.',
  failed_qa: 'اندازه گیری از کنترل کیفیت عبور نکرده است.',
  standardized_score_not_computed: 'نمره استاندارد نسخه دار محاسبه نشده است.',
};

const nextActionLabels: Record<string, string> = {
  'Collect an approved anonymized survey package.': 'بسته پیمایش ناشناس سازی شده و مورد تایید را گردآوری و بارگذاری کنید.',
  'Complete the approved geolocated field audit.': 'ممیزی میدانی مکان مند مصوب را تکمیل و مستندات آن را بارگذاری کنید.',
  'Upload an approved aggregated organizational dataset with provenance.': 'داده تجمیعی سازمانی را همراه منشا، نسخه، مجوز و checksum بارگذاری کنید.',
  'Configure and run the registry-approved connector; do not substitute a model estimate.': 'اتصال دهنده مورد تایید رجیستر را اجرا کنید و برآورد مدلی را جایگزین داده نکنید.',
  'Assign an approved source and collection playbook.': 'منبع و playbook مصوب تامین داده را تعیین و به مسئول آن واگذار کنید.',
};

function suggestedOwner(accessMode: string): string {
  if (accessMode.includes('سازمانی')) return 'دستگاه متولی داده';
  if (accessMode.includes('میدانی')) return 'تیم پیمایش و ممیزی میدانی';
  if (accessMode.includes('برخط')) return 'مدیر اتصال دهنده داده';
  return 'راهبری داده محله';
}

function normalizeRunSummary(value: unknown, fallbackRunId = ''): TypologyRunSummary {
  const source = record(value);
  const requestSource = record(source.request);
  const request = Object.keys(requestSource).length > 0
    ? {
        ...requestSource,
        neighborhood_name: readableText(requestSource.neighborhood_name, 'محله بدون نام'),
        city_or_county: readableText(requestSource.city_or_county),
        province: readableText(requestSource.province),
      } as TypologyRunSummary['request']
    : undefined;
  return {
    ...(source as Partial<TypologyRunSummary>),
    run_id: String(source.run_id ?? fallbackRunId),
    status: String(source.status ?? 'CREATED'),
    request,
    coverage: record(source.coverage) as TypologyRunSummary['coverage'],
    boundary: source.boundary == null ? null : record(source.boundary) as TypologyRunSummary['boundary'],
  };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function array(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(record) : [];
}

function normalizeDomain(
  key: DomainKey,
  source: Record<string, unknown>,
  scores: Record<string, unknown>,
  labels: Record<string, unknown>,
  coverage: Record<string, unknown>,
): DomainResult {
  const own = record(source[key]);
  return {
    key,
    score: numberOrNull(own.score ?? scores[key]),
    label: String(own.label ?? labels[key] ?? 'در انتظار داده'),
    coverage: numberOrNull(own.coverage ?? coverage[key]),
    confidence: numberOrNull(own.confidence),
  };
}

export function normalizeReport(rawPayload: Record<string, unknown>, fallbackRunId: string): TypologyReport {
  const raw = record(rawPayload.report ?? rawPayload);
  const run = record(raw.run);
  const locationRaw = record(raw.location ?? raw.neighborhood ?? raw.identity);
  const boundaryRaw = raw.boundary == null ? null : record(raw.boundary);
  const coverageRaw = record(raw.coverage);
  const statusCounts = record(coverageRaw.status_counts);
  const auditRaw = record(raw.audit);
  const verificationGatesRaw = record(raw.verification_gates);
  const domainSource = record(raw.domains);
  const results = record(raw.results);
  const scores = record(raw.domain_scores ?? results.domain_scores);
  const labels = record(raw.domain_labels_fa ?? raw.domain_labels ?? results.domain_labels_fa ?? results.domain_labels);
  const weightedCoverage = record(raw.weighted_coverage ?? results.weighted_coverage);
  const scenarioRaw = record(raw.scenario ?? raw.imbalance ?? results.scenario);
  const driverScores = record(raw.driver_scores ?? results.driver_scores);
  const driverCoverage = record(raw.driver_coverage ?? results.driver_coverage);

  const domains: Record<DomainKey, DomainResult> = {
    physical: normalizeDomain('physical', domainSource, scores, labels, weightedCoverage),
    behavioral: normalizeDomain('behavioral', domainSource, scores, labels, weightedCoverage),
    normative: normalizeDomain('normative', domainSource, scores, labels, weightedCoverage),
  };

  const defaultDriverTitles: Record<string, string> = {
    P1: 'زیرساخت و تاب‌آوری', P2: 'خدمات و محیط', P3: 'امنیت فضایی/محیطی',
    B1: 'پویایی اقتصادی/معیشت', B2: 'زنجیره ارزش و بازار', B3: 'الگوهای زیستی و جذب', B4: 'دسترسی/امنیت رفتاری',
    N1: 'سرمایه اجتماعی', N2: 'امنیت، شمول و حکمرانی', N3: 'ظرفیت نهادی و محله‌بندی',
  };
  const rawDrivers = array(raw.drivers);
  const drivers = rawDrivers.length > 0
    ? rawDrivers.map((item) => {
        const code = String(item.code ?? item.driver_id ?? '—');
        return {
          code,
          title: String(item.title ?? item.name ?? defaultDriverTitles[code] ?? code),
          domain: String(item.domain ?? (code.startsWith('P') ? 'physical' : code.startsWith('B') ? 'behavioral' : 'normative')) as DomainKey,
          score: numberOrNull(item.score),
          coverage: numberOrNull(item.coverage),
          confidence: numberOrNull(item.confidence),
        };
      })
    : Object.keys(driverScores).map((code) => ({
        code,
        title: defaultDriverTitles[code] ?? code,
        domain: (code.startsWith('P') ? 'physical' : code.startsWith('B') ? 'behavioral' : 'normative') as DomainKey,
        score: numberOrNull(driverScores[code]),
        coverage: numberOrNull(driverCoverage[code]),
        confidence: null,
      }));

  const evidenceRecords = array(raw.evidence ?? raw.evidence_records ?? raw.evidence_ledger);
  const latestEvidence = new Map<string, Record<string, unknown>>();
  for (const item of evidenceRecords) {
    const code = String(item.indicator_code ?? '');
    if (code) latestEvidence.set(code, item);
  }
  const indicatorPlan = array(raw.indicators ?? raw.indicator_results ?? raw.indicator_plan);
  const indicatorPlanByCode = new Map(indicatorPlan.map((item) => [String(item.code ?? item.indicator_code ?? ''), item]));
  const indicators = indicatorPlan.map((item) => {
    const evidence = latestEvidence.get(String(item.code ?? item.indicator_code ?? '')) ?? {};
    const quality = record(evidence.quality);
    return {
    code: String(item.code ?? item.indicator_code ?? '—'),
    indicator: String(item.indicator ?? item.name ?? 'شاخص بدون عنوان'),
    domain: String(item.domain ?? ''),
    driver_id: item.driver_id ? String(item.driver_id) : undefined,
    raw_value: (item.raw_value ?? item.value ?? evidence.raw_value ?? null) as number | string | null,
    unit: item.unit == null && evidence.unit == null ? null : String(item.unit ?? evidence.unit),
    score: numberOrNull(item.score ?? item.score_1_5 ?? evidence.score_1_5),
    coverage: numberOrNull(item.coverage ?? quality.spatial_coverage),
    confidence: numberOrNull(item.confidence ?? quality.score),
    status: String(item.status ?? 'NOT_AVAILABLE'),
    flags: Array.isArray(item.flags)
      ? item.flags.map(String)
      : Array.isArray(quality.flags)
        ? quality.flags.map(String)
        : [],
    evidence_ids: Array.isArray(item.evidence_ids) ? item.evidence_ids.map(String) : (evidence.id ? [String(evidence.id)] : []),
    reference_date: item.reference_date == null && evidence.reference_date == null ? null : String(item.reference_date ?? evidence.reference_date),
  };
  });

  const evidence = evidenceRecords.map((item) => {
    const source = record(item.source);
    const quality = record(item.quality);
    return {
      evidence_id: String(item.evidence_id ?? item.id ?? '—'),
      indicator_code: item.indicator_code ? String(item.indicator_code) : undefined,
      organization: String(item.organization ?? source.organization ?? '—'),
      dataset_id: String(item.dataset_id ?? source.dataset_id ?? '—'),
      version: String(item.version ?? source.version ?? '—'),
      retrieved_at: String(item.retrieved_at ?? source.retrieved_at ?? ''),
      license: String(item.license ?? source.license ?? '—'),
      checksum: String(item.checksum ?? source.checksum ?? '—'),
      coverage: numberOrNull(item.coverage ?? quality.spatial_coverage),
      quality_score: numberOrNull(item.quality_score ?? quality.score),
      url: String(item.url ?? source.url ?? ''),
      status: String(item.status ?? 'AVAILABLE'),
    };
  });

  const missingData = array(raw.missing_data ?? raw.missing_actions ?? coverageRaw.missing).map((item) => {
    const indicatorCode = String(item.indicator_code ?? item.code ?? '—');
    const task = indicatorPlanByCode.get(indicatorCode) ?? {};
    const reasonCode = String(item.reason ?? 'measurement_not_available');
    const nextAction = String(item.next_action ?? item.action ?? 'تامین داده و محاسبه مجدد');
    const accessMode = String(item.access_mode ?? task.access_mode ?? '');
    return {
      indicator_code: indicatorCode,
      indicator: readableText(item.indicator ?? task.indicator ?? task.name) || undefined,
      reason: missingReasonLabels[reasonCode] ?? reasonCode,
      status: String(item.status ?? task.status ?? 'NOT_AVAILABLE'),
      access_mode: readableText(accessMode) || undefined,
      next_action: nextActionLabels[nextAction] ?? nextAction,
      owner: readableText(item.owner, suggestedOwner(accessMode)),
    };
  });

  const alternativeNames = locationRaw.alternative_names ?? locationRaw.aliases;
  const auditEvents = array(auditRaw.events).map((item) => ({
    id: String(item.id ?? ''),
    at: String(item.at ?? ''),
    actor: readableText(item.actor, 'system'),
    action: String(item.action ?? 'UNKNOWN_ACTION'),
    from_status: item.from_status ? String(item.from_status) : undefined,
    to_status: item.to_status ? String(item.to_status) : undefined,
    details: Object.keys(record(item.details)).length > 0 ? record(item.details) : undefined,
  }));
  const computedCount = typeof coverageRaw.computed === 'number'
    ? coverageRaw.computed
    : Number(statusCounts.COMPUTED ?? 0) + Number(statusCounts.APPROVED ?? 0);

  return {
    run_id: String(raw.run_id ?? run.run_id ?? fallbackRunId),
    status: String(raw.status ?? run.status ?? 'PROVISIONAL'),
    publication_level: String(raw.publication_level ?? raw.status ?? 'PROVISIONAL'),
    registry_version: String(raw.registry_version ?? record(raw.registry).version ?? ''),
    code_version: String(raw.code_version ?? auditRaw.code_version ?? ''),
    reference_year: typeof raw.reference_year === 'number' ? raw.reference_year : undefined,
    created_at: String(raw.created_at ?? run.created_at ?? ''),
    updated_at: String(raw.updated_at ?? run.updated_at ?? ''),
    location: {
      neighborhood_id: locationRaw.neighborhood_id ? String(locationRaw.neighborhood_id) : undefined,
      official_name: readableText(locationRaw.official_name ?? locationRaw.canonical_name ?? locationRaw.neighborhood_name, 'محله انتخاب‌شده'),
      alternative_names: Array.isArray(alternativeNames)
        ? alternativeNames.map((item) => readableText(item)).filter(Boolean)
        : [],
      province: readableText(locationRaw.province),
      province_id: locationRaw.province_id ? String(locationRaw.province_id) : undefined,
      city_or_county: readableText(locationRaw.city_or_county ?? locationRaw.city),
      settlement_type: locationRaw.settlement_type ? String(locationRaw.settlement_type) : undefined,
    },
    boundary: boundaryRaw
      ? {
          boundary_id: boundaryRaw.boundary_id ? String(boundaryRaw.boundary_id) : undefined,
          candidate_id: boundaryRaw.candidate_id ? String(boundaryRaw.candidate_id) : undefined,
          source: boundaryRaw.source ? String(boundaryRaw.source) : undefined,
          version: boundaryRaw.version ? String(boundaryRaw.version) : undefined,
          confidence: numberOrNull(boundaryRaw.confidence),
          crs: boundaryRaw.crs ? String(boundaryRaw.crs) : undefined,
          area_km2: numberOrNull(boundaryRaw.area_km2),
          approved_at: boundaryRaw.approved_at ? String(boundaryRaw.approved_at) : undefined,
          geojson: record(boundaryRaw.geojson),
        }
      : null,
    coverage: {
      total: Number(coverageRaw.total ?? 419),
      computed: computedCount,
      approved: Number(coverageRaw.approved ?? statusCounts.APPROVED ?? 0),
      missing: typeof coverageRaw.missing === 'number' ? coverageRaw.missing : missingData.length,
      failed_qa: Number(coverageRaw.failed_qa ?? statusCounts.FAILED_QA ?? 0),
      waiting_public: Number(coverageRaw.waiting_public ?? coverageRaw.downloading_public_data ?? statusCounts.DOWNLOADING_PUBLIC_DATA ?? 0),
      waiting_organizational: Number(coverageRaw.waiting_organizational ?? statusCounts.WAITING_FOR_ORGANIZATIONAL_DATA ?? 0),
      waiting_survey: Number(coverageRaw.waiting_survey ?? statusCounts.WAITING_FOR_SURVEY ?? 0),
      waiting_field: Number(coverageRaw.waiting_field ?? statusCounts.WAITING_FOR_FIELD_AUDIT ?? 0),
      weighted: numberOrNull(coverageRaw.weighted ?? coverageRaw.weighted_coverage),
    },
    domains,
    si: numberOrNull(raw.si ?? raw.SI ?? results.si ?? results.SI),
    label_stability: numberOrNull(raw.label_stability ?? raw.stability ?? results.label_stability),
    scenario: {
      pattern: scenarioRaw.pattern ? String(scenarioRaw.pattern) : undefined,
      label: String(scenarioRaw.label_fa ?? scenarioRaw.label ?? 'در انتظار پوشش کافی'),
      explanation: scenarioRaw.explanation ? String(scenarioRaw.explanation) : scenarioRaw.rationale ? String(scenarioRaw.rationale) : undefined,
      requires_review: Boolean(scenarioRaw.requires_review ?? true),
    },
    drivers,
    indicators,
    evidence,
    missing_data: missingData,
    verification_gates: {
      eligible: verificationGatesRaw.eligible === true || raw.publication_level === 'VERIFIED',
      failures: Array.isArray(verificationGatesRaw.failures) ? verificationGatesRaw.failures.map(String) : [],
    },
    audit_events: auditEvents,
    positive_factors: Array.isArray(raw.positive_factors) ? raw.positive_factors.map(String) : [],
    bottlenecks: Array.isArray(raw.bottlenecks) ? raw.bottlenecks.map(String) : [],
    reviewer: raw.reviewer || auditRaw.reviewer
      ? (() => {
          const reviewer = record(raw.reviewer ?? auditRaw.reviewer);
          return {
            id: reviewer.id ? String(reviewer.id) : undefined,
            name: reviewer.name ? String(reviewer.name) : undefined,
            decision: reviewer.decision ? String(reviewer.decision) : undefined,
            reason: reviewer.reason ? String(reviewer.reason) : undefined,
            at: reviewer.at || reviewer.approved_at ? String(reviewer.at ?? reviewer.approved_at) : undefined,
          };
        })()
      : null,
  };
}
