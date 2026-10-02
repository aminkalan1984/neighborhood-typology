import { randomUUID } from 'node:crypto';
import type {
  NeighborhoodRequest,
  RegistryIndex,
  SupplyChannel,
  SupplyPlan,
  SupplyTask,
  SupplyTaskStatus,
} from './types.js';
import { normalizeNeighborhoodRequest } from './workflow.js';

function accessChannels(accessMode: string, template: string, calcFamily: string, playbookCodes: string[]): SupplyChannel[] {
  const channels: SupplyChannel[] = [];
  if (accessMode.includes('برخط')) {
    channels.push({ id: 'public', label: 'داده برخط/باز', playbookCodes, required: true });
  }
  if (accessMode.includes('سازمانی') || accessMode.includes('غیرعمومی')) {
    channels.push({ id: 'organizational', label: 'درخواست داده سازمانی', playbookCodes, required: true });
  }
  if (accessMode.includes('میدانی')) {
    const survey = template === 'survey' || calcFamily === 'survey_or_assessment';
    channels.push({
      id: survey ? 'survey' : 'field',
      label: survey ? 'پیمایش نمونه‌ای' : 'ممیزی میدانی',
      playbookCodes,
      required: true,
    });
  }
  if (!channels.length) {
    channels.push({ id: 'organizational', label: 'بازبینی مسیر تأمین داده', playbookCodes, required: true });
  }
  return channels;
}

function initialStatus(channels: SupplyChannel[], boundaryConfirmed: boolean): SupplyTaskStatus {
  if (!boundaryConfirmed) return 'PLANNED';
  if (channels.some((channel) => channel.id === 'organizational')) return 'WAITING_FOR_ORGANIZATIONAL_DATA';
  if (channels.some((channel) => channel.id === 'survey')) return 'WAITING_FOR_SURVEY';
  if (channels.some((channel) => channel.id === 'field')) return 'WAITING_FOR_FIELD_AUDIT';
  return 'DOWNLOADING_PUBLIC_DATA';
}

export function nextActionForTask(task: Pick<SupplyTask, 'channels' | 'status'>): string {
  switch (task.status) {
    case 'PLANNED': return 'confirm_boundary_then_start_collection';
    case 'DOWNLOADING_PUBLIC_DATA': return 'run_approved_public_connector';
    case 'WAITING_FOR_ORGANIZATIONAL_DATA': return 'issue_or_follow_up_official_data_request';
    case 'WAITING_FOR_SURVEY': return 'design_or_complete_approved_survey';
    case 'WAITING_FOR_FIELD_AUDIT': return 'schedule_or_complete_field_audit';
    case 'COMPUTABLE': return 'run_deterministic_formula_and_qa';
    case 'COMPUTED': return 'submit_for_expert_review';
    case 'FAILED_QA': return 'resolve_quality_flags_and_recompute';
    case 'NOT_AVAILABLE': {
      if (task.channels.some((channel) => channel.id === 'organizational')) return 'request_organizational_data_or_record_denial';
      if (task.channels.some((channel) => channel.id === 'survey')) return 'collect_survey_data';
      if (task.channels.some((channel) => channel.id === 'field')) return 'collect_field_audit_data';
      return 'retry_approved_connector_or_record_unavailability';
    }
  }
}

export function resolveSupplyTaskStatus(
  task: SupplyTask,
  availability: { public?: boolean; organizational?: boolean; survey?: boolean; field?: boolean; qaPassed?: boolean; computed?: boolean; unavailable?: boolean },
): SupplyTask {
  if (availability.unavailable) {
    const status: SupplyTaskStatus = 'NOT_AVAILABLE';
    return { ...task, status, nextAction: nextActionForTask({ ...task, status }), missingReasons: ['required_data_unavailable'] };
  }
  if (availability.qaPassed === false) {
    const status: SupplyTaskStatus = 'FAILED_QA';
    return { ...task, status, nextAction: nextActionForTask({ ...task, status }), missingReasons: ['qa_failed'] };
  }
  if (availability.computed) {
    const status: SupplyTaskStatus = 'COMPUTED';
    return { ...task, status, nextAction: nextActionForTask({ ...task, status }), missingReasons: [] };
  }

  const missing = task.channels.filter((channel) => channel.required && availability[channel.id] !== true);
  let status: SupplyTaskStatus = 'COMPUTABLE';
  if (missing.some((channel) => channel.id === 'organizational')) status = 'WAITING_FOR_ORGANIZATIONAL_DATA';
  else if (missing.some((channel) => channel.id === 'survey')) status = 'WAITING_FOR_SURVEY';
  else if (missing.some((channel) => channel.id === 'field')) status = 'WAITING_FOR_FIELD_AUDIT';
  else if (missing.some((channel) => channel.id === 'public')) status = 'DOWNLOADING_PUBLIC_DATA';
  return {
    ...task,
    status,
    nextAction: nextActionForTask({ ...task, status }),
    missingReasons: missing.map((channel) => `${channel.id}_data_missing`),
  };
}

export function buildDataSupplyPlan(
  registry: RegistryIndex,
  requestInput: Record<string, unknown> | NeighborhoodRequest,
  options: { runId?: string; createdAt?: string; boundaryConfirmed?: boolean } = {},
): SupplyPlan {
  const request = normalizeNeighborhoodRequest(requestInput);
  const boundaryConfirmed = options.boundaryConfirmed ?? Boolean(request.optionalBoundaryGeojson);
  const tasks = registry.rows.map((indicator): SupplyTask => {
    const channels = accessChannels(indicator.accessMode, indicator.template, indicator.calcFamily, indicator.playbookCodes);
    const status = initialStatus(channels, boundaryConfirmed);
    const task: SupplyTask = {
      code: indicator.code,
      sourceOrder: indicator.sourceOrder,
      domain: indicator.domain,
      driverId: indicator.driverId,
      indicator: indicator.indicator,
      calcFamily: indicator.calcFamily,
      formulaVersion: indicator.formulaVersion,
      formulaText: indicator.formulaText,
      accessMode: indicator.accessMode,
      playbookCodes: indicator.playbookCodes,
      sourceRequirements: indicator.sourceRequirements,
      channels,
      status,
      nextAction: '',
      missingReasons: boundaryConfirmed ? channels.map((channel) => `${channel.id}_data_missing`) : ['boundary_not_confirmed'],
    };
    task.nextAction = nextActionForTask(task);
    return task;
  });

  const codes = tasks.map((task) => task.code);
  const duplicates = codes.filter((code, index) => codes.indexOf(code) !== index);
  const statusCounts: Record<string, number> = {};
  const counts: Record<string, number> = {};
  const channelCounts: Record<string, number> = {};
  for (const task of tasks) {
    counts[task.accessMode] = (counts[task.accessMode] ?? 0) + 1;
    statusCounts[task.status] = (statusCounts[task.status] ?? 0) + 1;
    for (const channel of task.channels) channelCounts[channel.id] = (channelCounts[channel.id] ?? 0) + 1;
  }

  return {
    runId: options.runId ?? randomUUID(),
    request,
    registryVersion: registry.version,
    status: boundaryConfirmed ? 'BOUNDARY_CONFIRMED' : 'WAITING_FOR_LOCATION_RESOLUTION',
    createdAt: options.createdAt ?? new Date().toISOString(),
    expectedIndicatorCount: registry.expectedCount,
    tasks,
    counts,
    statusCounts,
    channels: channelCounts,
    acceptance: {
      exactIndicatorCount: tasks.length === registry.expectedCount,
      uniqueCodes: duplicates.length === 0,
      missingCodes: registry.rows.filter((row) => !codes.includes(row.code)).map((row) => row.code),
      duplicateCodes: [...new Set(duplicates)],
    },
  };
}

export const makePlan = buildDataSupplyPlan;

