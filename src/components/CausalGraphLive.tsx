import React, { useState, useMemo, useCallback, memo, useEffect } from 'react';
import {
  GitCommit,
  ArrowRight,
  ArrowLeft,
  Activity,
  Sparkles,
  Eye,
  RefreshCw,
  Sliders,
  Maximize2,
  Minimize2,
  RotateCcw,
  PanelLeft,
  PanelLeftClose,
} from 'lucide-react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Handle,
  Position,
  EdgeLabelRenderer,
  getBezierPath,
  type Node,
  type Edge,
  type NodeProps,
  type EdgeProps,
  type NodeChange,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { motion, AnimatePresence } from 'motion/react';
import dagre from 'dagre';
import { PolicyLever } from './ScenarioBuilderPage';

export interface CausalNode {
  id: string;
  label: string;
  dimensionCode: 'I' | 'N' | 'D' | 'E' | 'S' | 'P' | 'C' | 'F';
  dimensionName: string;
  color: string;
  type: 'lever' | 'driver' | 'outcome';
  currentValue: number; // calculated 0 - 100
  unit: string;
  x: number; // % layout X (legacy)
  y: number; // % layout Y (legacy)
  description: string;
}

export interface CausalEdge {
  id: string;
  sourceId: string;
  targetId: string;
  polarity: '+' | '-';
  lagTime: string; // e.g. "۶ ماه"
  strength: number; // 0.1 to 1.0 weight
  description: string;
}

interface CausalGraphLiveProps {
  levers: PolicyLever[];
  onLeverIntensityChange?: (leverId: string, newIntensity: number) => void;
  selectedYear?: number;
}

/* ─── React Flow typed contracts ─── */
type CausalNodeData = {
  node: CausalNode;
  isSelected: boolean;
};
type CausalFlowNode = Node<CausalNodeData, 'causal'>;

type CausalEdgeData = {
  polarity: '+' | '-';
  lagTime: string;
  strength: number;
  highlighted: boolean;
};
type CausalFlowEdge = Edge<CausalEdgeData, 'effect'>;

/* Fixed box used by dagre to produce deterministic hierarchical layout */
const NODE_W = 196;
const NODE_H = 92;

/* ─── Static knowledge graph (same as before) ─── */
const DEFAULT_NODES: CausalNode[] = [
  // Interventions (Levers)
  {
    id: 'node-lvr-1',
    label: 'انتقال آب خلیج فارس',
    dimensionCode: 'I',
    dimensionName: 'زیرساختی',
    color: '#6366F1',
    type: 'lever',
    currentValue: 75,
    unit: '٪ تخصیص',
    x: 12,
    y: 20,
    description: 'طرح ملی انتقال و شیرین‌سازی آب برای صنایع و شرب استان‌های کویری.'
  },
  {
    id: 'node-lvr-2',
    label: 'انسداد چاه‌های غیرمجاز',
    dimensionCode: 'N',
    dimensionName: 'محیط‌زیست',
    color: '#10B981',
    type: 'lever',
    currentValue: 60,
    unit: '٪ انسداد',
    x: 12,
    y: 52,
    description: 'نصب کنتورهای هوشمند و مهار برداشت غیرقانونی از سفره‌های زیرزمینی.'
  },
  {
    id: 'node-lvr-3',
    label: 'فیبر نوری و زیرساخت دیجیتال',
    dimensionCode: 'D',
    dimensionName: 'دیجیتال',
    color: '#F59E0B',
    type: 'lever',
    currentValue: 85,
    unit: '٪ پوشش',
    x: 12,
    y: 82,
    description: 'توسعه پهن‌باند روستایی و زیرساخت‌های کسب‌وکار آنلاین.'
  },

  // Intermediate Drivers / Variables
  {
    id: 'node-drv-1',
    label: 'ترمیم تراز سفره‌های زیرزمینی',
    dimensionCode: 'N',
    dimensionName: 'محیط‌زیست',
    color: '#059669',
    type: 'driver',
    currentValue: 68,
    unit: 'میلیون مترمکعب',
    x: 42,
    y: 25,
    description: 'کاهش افت سالانه سطح آب‌های زیرزمینی و تعادل‌بخشی آبخوان‌ها.'
  },
  {
    id: 'node-drv-2',
    label: 'مهار نرخ فرونشست زمین',
    dimensionCode: 'N',
    dimensionName: 'محیط‌زیست',
    color: '#047857',
    type: 'driver',
    currentValue: 54,
    unit: 'سانتی‌متر/سال',
    x: 42,
    y: 55,
    description: 'کاهش سرعت نشست دشت‌های کشاورزی و خطرات زیرساختی.'
  },
  {
    id: 'node-drv-3',
    label: 'اشتغال پایدار دیجیتال و مرزی',
    dimensionCode: 'E',
    dimensionName: 'اقتصادی',
    color: '#D97706',
    type: 'driver',
    currentValue: 72,
    unit: 'هزار شغل',
    x: 42,
    y: 80,
    description: 'ایجاد فرصت‌های شغلی جدید در مشاغل فناوری‌محور و خدمات آنلاین.'
  },

  // Ultimate Outcomes
  {
    id: 'node-[#1E4841]-1',
    label: 'کاهش ناترازی و تنش آبی استان‌ها',
    dimensionCode: 'I',
    dimensionName: 'هدف استراتژیک',
    color: '#1E4841',
    type: 'outcome',
    currentValue: 26.6,
    unit: '٪ بهبود',
    x: 82,
    y: 22,
    description: 'خروج استان‌های هدف از محدوده قرمز و بحرانی تنش آبی.'
  },
  {
    id: 'node-[#1E4841]-2',
    label: 'رشد تولید ناخالص داخلی',
    dimensionCode: 'E',
    dimensionName: 'هدف استراتژیک',
    color: '#1E4841',
    type: 'outcome',
    currentValue: 2.7,
    unit: '٪ رشد سالانه',
    x: 82,
    y: 52,
    description: 'افزایش ارزش افزوده بخش‌های صنعتی، کشاورزی نوین و خدمات.'
  },
  {
    id: 'node-[#1E4841]-3',
    label: 'افزایش سرمایه اجتماعی و مهاجرت معکوس',
    dimensionCode: 'S',
    dimensionName: 'هدف استراتژیک',
    color: '#7C3AED',
    type: 'outcome',
    currentValue: 19.0,
    unit: '٪ بهبود رضایت',
    x: 82,
    y: 82,
    description: 'افزایش امید به زندگی، ثبات سکونت و کاهش حاشیه‌نشینی.'
  }
];

const DEFAULT_EDGES: CausalEdge[] = [
  // Lever 1 Connections
  { id: 'edge-1', sourceId: 'node-lvr-1', targetId: 'node-[#1E4841]-1', polarity: '+', lagTime: '۱۸ ماه', strength: 0.85, description: 'تامین مستقیم آب صنعتی، بار سفره‌های زیرزمینی را کاهش می‌دهد.' },
  { id: 'edge-2', sourceId: 'node-lvr-1', targetId: 'node-drv-1', polarity: '+', lagTime: '۱۲ ماه', strength: 0.65, description: 'کاهش برداشت از چاه‌های صنعتی منجر به تغذیه سفره‌ها می‌شود.' },

  // Lever 2 Connections
  { id: 'edge-3', sourceId: 'node-lvr-2', targetId: 'node-drv-1', polarity: '+', lagTime: '۶ ماه', strength: 0.90, description: 'انسداد چاه‌های غیرمجاز سریع‌ترین اثر را بر مهار فرار آب سفره دارد.' },
  { id: 'edge-4', sourceId: 'node-drv-1', targetId: 'node-drv-2', polarity: '-', lagTime: '۲۴ ماه', strength: 0.82, description: 'افزایش تراز آبخوان، نرخ فرونشست زمین را به‌شدت کاهش می‌دهد.' },
  { id: 'edge-5', sourceId: 'node-drv-2', targetId: 'node-[#1E4841]-2', polarity: '+', lagTime: '۱۲ ماه', strength: 0.70, description: 'کاهش فرونشست از تخریب زیرساخت‌های حمل‌ونقل و کشاورزی جلوگیری می‌کند.' },

  // Lever 3 Connections
  { id: 'edge-6', sourceId: 'node-lvr-3', targetId: 'node-drv-3', polarity: '+', lagTime: '۳ ماه', strength: 0.95, description: 'توسعه فیبر نوری بستر کسب‌وکارهای اینترنتی را فراهم می‌سازد.' },
  { id: 'edge-7', sourceId: 'node-drv-3', targetId: 'node-[#1E4841]-2', polarity: '+', lagTime: '۶ ماه', strength: 0.75, description: 'کسب‌وکارهای دیجیتال سهم مهمی در رشد GDP غیرنفتی ایفا می‌کنند.' },
  { id: 'edge-8', sourceId: 'node-drv-3', targetId: 'node-[#1E4841]-3', polarity: '+', lagTime: '۱۲ ماه', strength: 0.88, description: 'اشتغال جوانان بومی انگیزه مهاجرت را کاهش داده و رضایت را افزایش می‌دهد.' },
  { id: 'edge-9', sourceId: 'node-drv-1', targetId: 'node-[#1E4841]-3', polarity: '+', lagTime: '۱۸ ماه', strength: 0.60, description: 'پایداری منبع آب کشاورزی باعث دلگرمی روستاییان و تثبیت جمعیت می‌شود.' }
];

/* ─── dagre hierarchical layout (levers → drivers → outcomes) ─── */
function layoutGraph(nodes: CausalFlowNode[], edges: CausalFlowEdge[]): CausalFlowNode[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 26, ranksep: 110, marginx: 24, marginy: 24 });

  nodes.forEach(n => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  edges.forEach(e => g.setEdge(e.source, e.target));
  dagre.layout(g);

  return nodes.map(n => {
    const pos = g.node(n.id);
    return {
      ...n,
      position: { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 },
    };
  });
}

/* ─── Custom node: same visual card as before, now a draggable RF node ─── */
const CausalFlowNode = memo(function CausalFlowNode({ data }: NodeProps<CausalFlowNode>) {
  const { node, isSelected } = data;

  return (
    <div
      className={`relative w-[196px] select-none rounded-xl border p-2.5 cursor-pointer shadow-xs transition-all duration-200 animate-fade-in ${
        isSelected
          ? 'border-brand-800 bg-surface ring-4 ring-signal-400/40 scale-[1.05] z-30 shadow-md'
          : 'border-line bg-surface/95 hover:border-gray-400 hover:shadow-sm hover:-translate-y-0.5'
      }`}
    >
      <Handle type="target" position={Position.Left} className="!size-2 !border-0 !bg-gray-300" />
      <Handle type="source" position={Position.Right} className="!size-2 !border-0 !bg-gray-300" />

      <div className="flex items-center justify-between gap-1 mb-1">
        <span
          className="px-1.5 py-0.5 rounded text-[8.5px] font-black text-white shrink-0"
          style={{ backgroundColor: node.color }}
        >
          {node.dimensionName}
        </span>
        <span className="font-mono text-[9px] text-ink-500 font-bold">
          {node.type === 'lever' ? 'ورودی' : node.type === 'driver' ? 'واسط' : 'پیامد'}
        </span>
      </div>

      <h4 className="text-[11px] font-bold text-ink-800 leading-tight truncate" title={node.label}>
        {node.label}
      </h4>

      <div className="mt-1 pt-1 border-t border-line/70 flex items-center justify-between text-[10px] font-mono">
        <span className="text-ink-400">مقدار:</span>
        <motion.span
          key={node.currentValue}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 24 }}
          className="font-black text-brand-800"
        >
          {node.currentValue} {node.unit}
        </motion.span>
      </div>
    </div>
  );
});

/* ─── Custom edge: base line + animated dash "wave" + traveling particle ─── */
const EffectEdge = memo(function EffectEdge(props: EdgeProps<CausalFlowEdge>) {
  const {
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    markerEnd,
    data,
  } = props;

  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const polarity = data?.polarity ?? '+';
  const strength = data?.strength ?? 0.5;
  const lagTime = data?.lagTime;
  const highlighted = data?.highlighted ?? false;
  const color = polarity === '+' ? '#10B981' : '#EF4444';
  const width = 1 + strength * 2;

  return (
    <g style={{ opacity: highlighted ? 1 : 0.35 }} className="transition-opacity duration-300">
      {/* Base edge */}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
        markerEnd={markerEnd}
      />

      {highlighted && (
        <>
          {/* Wave of effect: moving dashes overlay */}
          <path
            d={path}
            fill="none"
            stroke={color}
            strokeWidth={width + 2.5}
            strokeLinecap="round"
            strokeDasharray="5 11"
            className="edge-effect-flow"
          />
          {/* Traveling particle */}
          <circle r="3.5" fill={color} className="edge-effect-dot" style={{ color }}>
            <animateMotion
              dur={`${Math.max(0.8, 1.7 / strength).toFixed(2)}s`}
              repeatCount="indefinite"
              path={path}
            />
          </circle>
        </>
      )}

      {highlighted && lagTime && (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-md bg-ink-800/90 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm"
            style={{ left: labelX, top: labelY }}
          >
            تاخیر {lagTime}
          </div>
        </EdgeLabelRenderer>
      )}
    </g>
  );
});

/* Stable component maps (module scope → no re-creation per render) */
const nodeTypes = { causal: CausalFlowNode };
const edgeTypes = { effect: EffectEdge };

/* Shared small UI bits */
const quickActionBtn =
  'w-7 h-7 rounded-lg bg-surface border border-line shadow-xs flex items-center justify-center text-ink-500 hover:text-brand-800 hover:border-brand-300 hover:shadow-sm transition-all cursor-pointer';

export default function CausalGraphLive({ levers, onLeverIntensityChange, selectedYear = 1408 }: CausalGraphLiveProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('node-drv-1');
  const [filterType, setFilterType] = useState<'all' | 'lever' | 'driver' | 'outcome'>('all');
  const [activeFeedbackLoop, setActiveFeedbackLoop] = useState<boolean>(true);
  const [dragged, setDragged] = useState<Record<string, { x: number; y: number }>>({});
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [inspectorOpen, setInspectorOpen] = useState<boolean>(true);
  const [autoLayoutEpoch, setAutoLayoutEpoch] = useState<number>(0);

  // Lock body scroll while the fullscreen overlay is open
  useEffect(() => {
    document.body.style.overflow = isFullscreen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isFullscreen]);

  // Keyboard shortcuts: F ⇄ fullscreen, Escape → exit fullscreen
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = (target?.tagName ?? '').toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;

      if (e.key === 'Escape') {
        setIsFullscreen(false);
      }
      if ((e.key === 'f' || e.key === 'F') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        setIsFullscreen(prev => !prev);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Compute live updated values for nodes based on active policy levers
  const nodes = useMemo(() => {
    const lever1 = levers.find(l => l.dimensionCode === 'I')?.intensity ?? 75;
    const lever2 = levers.find(l => l.dimensionCode === 'N')?.intensity ?? 60;
    const lever3 = levers.find(l => l.dimensionCode === 'D')?.intensity ?? 85;

    return DEFAULT_NODES.map(node => {
      let val = node.currentValue;
      if (node.id === 'node-lvr-1') val = lever1;
      if (node.id === 'node-lvr-2') val = lever2;
      if (node.id === 'node-lvr-3') val = lever3;

      if (node.id === 'node-drv-1') {
        val = Math.round(30 + lever1 * 0.25 + lever2 * 0.45);
      }
      if (node.id === 'node-drv-2') {
        val = Math.round(85 - (lever2 * 0.4 + lever1 * 0.15));
      }
      if (node.id === 'node-drv-3') {
        val = Math.round(20 + lever3 * 0.65);
      }

      if (node.id === 'node-[#1E4841]-1') {
        val = Number((-10 - (lever1 * 0.15 + lever2 * 0.12)).toFixed(1));
      }
      if (node.id === 'node-[#1E4841]-2') {
        val = Number((0.8 + lever3 * 0.02 + lever1 * 0.01).toFixed(1));
      }
      if (node.id === 'node-[#1E4841]-3') {
        val = Number((5 + lever3 * 0.12 + lever2 * 0.06).toFixed(1));
      }

      return { ...node, currentValue: val };
    });
  }, [levers]);

  const onNodeClick: NodeMouseHandler = useCallback((_, node) => setSelectedNodeId(node.id), []);
  const onNodesChange = useCallback((changes: NodeChange<CausalFlowNode>[]) => {
    setDragged(prev => {
      let next = prev;
      for (const change of changes) {
        if (change.type === 'position') {
          next = { ...next, [change.id]: { x: change.position.x, y: change.position.y } };
        }
      }
      return next;
    });
  }, []);

  // Reset to the auto hierarchical layout (clears user drags + refits view)
  const resetLayout = useCallback(() => {
    setDragged({});
    setAutoLayoutEpoch(e => e + 1);
  }, []);

  /* dagre positions — stable unless visible set / values change */
  const layoutedBase = useMemo<CausalFlowNode[]>(() => {
    const visible = nodes.filter(n => filterType === 'all' || n.type === filterType);
    const visibleIds = new Set(visible.map(n => n.id));
    const visibleEdges = DEFAULT_EDGES.filter(e => visibleIds.has(e.sourceId) && visibleIds.has(e.targetId));

    const flowNodes: CausalFlowNode[] = visible.map(n => ({
      id: n.id,
      type: 'causal',
      position: { x: 0, y: 0 },
      data: {
        node: n,
        isSelected: false,
      },
    }));
    const flowEdges: CausalFlowEdge[] = visibleEdges.map(e => ({
      id: e.id,
      source: e.sourceId,
      target: e.targetId,
      type: 'effect',
      data: {
        polarity: e.polarity,
        lagTime: e.lagTime,
        strength: e.strength,
        highlighted: false,
      },
      markerEnd: e.polarity === '+' ? 'url(#edge-arrow-pos)' : 'url(#edge-arrow-neg)',
    }));

    return layoutGraph(flowNodes, flowEdges);
  }, [nodes, filterType]);

  /* Merge selection highlight + user-drag positions into the final node list */
  const flowNodes = useMemo<CausalFlowNode[]>(() => {
    return layoutedBase.map(n => ({
      ...n,
      position: dragged[n.id] ?? n.position,
      data: {
        ...n.data,
        isSelected: selectedNodeId === n.id,
      },
    }));
  }, [layoutedBase, dragged, selectedNodeId]);

  const flowEdges = useMemo<CausalFlowEdge[]>(() => {
    const visibleIds = new Set(flowNodes.map(n => n.id));
    return DEFAULT_EDGES.filter(e => visibleIds.has(e.sourceId) && visibleIds.has(e.targetId)).map(e => ({
      id: e.id,
      source: e.sourceId,
      target: e.targetId,
      type: 'effect',
      data: {
        polarity: e.polarity,
        lagTime: e.lagTime,
        strength: e.strength,
        highlighted: Boolean(
          selectedNodeId && (e.sourceId === selectedNodeId || e.targetId === selectedNodeId)
        ),
      },
      markerEnd: e.polarity === '+' ? 'url(#edge-arrow-pos)' : 'url(#edge-arrow-neg)',
    }));
  }, [flowNodes, selectedNodeId]);

  // Selected node details
  const selectedNode = useMemo(() => {
    return nodes.find(n => n.id === selectedNodeId) || nodes[0];
  }, [nodes, selectedNodeId]);

  // Incoming and outgoing nodes
  const incomingNodes = useMemo(() => {
    if (!selectedNodeId) return [];
    const sourceIds = DEFAULT_EDGES.filter(e => e.targetId === selectedNodeId).map(e => e.sourceId);
    return nodes.filter(n => sourceIds.includes(n.id));
  }, [nodes, selectedNodeId]);

  const outgoingNodes = useMemo(() => {
    if (!selectedNodeId) return [];
    const targetIds = DEFAULT_EDGES.filter(e => e.sourceId === selectedNodeId).map(e => e.targetId);
    return nodes.filter(n => targetIds.includes(n.id));
  }, [nodes, selectedNodeId]);

  /* ─── Shared sub-renders (used by both normal and fullscreen layouts) ─── */

  const renderHeader = () => (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-3">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-brand-50 border border-brand-200 text-brand-700 flex items-center justify-center font-bold shrink-0">
          <GitCommit size={18} />
        </div>
        <div>
          <h3 className="text-xs font-black text-brand-800 flex items-center gap-2">
            <span>گراف علت و معلولی زنده و انتشار اثرات</span>
            <span className="text-[10px] bg-ok-soft text-ok px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-ok-soft animate-ping" />
              <span>بروزرسانی برخط</span>
            </span>
          </h3>
          <p className="text-[10.5px] text-ink-500">
            رصد انتشار اثرات زنده مداخلات سیاستی، تاخیر زمانی و حلقه‌های بازخورد متقابل
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 bg-paper p-1 rounded-xl text-[11px] font-bold">
          <span className="text-ink-400 px-1 text-[10px]">نمایش:</span>
          <button
            onClick={() => { setDragged({}); setFilterType('all'); }}
            className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
              filterType === 'all' ? 'bg-surface text-brand-800 shadow-2xs font-black' : 'text-ink-500'
            }`}
          >
            همه گره‌ها
          </button>
          <button
            onClick={() => { setDragged({}); setFilterType('lever'); }}
            className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
              filterType === 'lever' ? 'bg-surface text-brand-800 shadow-2xs font-black' : 'text-ink-500'
            }`}
          >
            اهرم‌ها
          </button>
          <button
            onClick={() => { setDragged({}); setFilterType('driver'); }}
            className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
              filterType === 'driver' ? 'bg-surface text-brand-800 shadow-2xs font-black' : 'text-ink-500'
            }`}
          >
            متغیرهای واسط
          </button>
          <button
            onClick={() => { setDragged({}); setFilterType('outcome'); }}
            className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${
              filterType === 'outcome' ? 'bg-surface text-brand-800 shadow-2xs font-black' : 'text-ink-500'
            }`}
          >
            اهداف نهایی
          </button>
        </div>

        <button
          onClick={() => setActiveFeedbackLoop(!activeFeedbackLoop)}
          className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer border flex items-center gap-1 ${
            activeFeedbackLoop ? 'bg-brand-50 text-brand-900 border-brand-200' : 'bg-paper text-ink-500 border-line'
          }`}
        >
          <RefreshCw size={12} className={activeFeedbackLoop ? 'animate-spin' : ''} />
          <span>حلقه‌های بازخورد</span>
        </button>

        {/* Inspector toggle — visible in fullscreen mode */}
        {isFullscreen && (
          <button
            onClick={() => setInspectorOpen(o => !o)}
            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer border flex items-center gap-1 ${
              inspectorOpen ? 'bg-brand-50 text-brand-900 border-brand-200' : 'bg-paper text-ink-500 border-line'
            }`}
            title="نمایش/مخفی‌کردن پنل تحلیل گره"
          >
            {inspectorOpen ? <PanelLeftClose size={12} /> : <PanelLeft size={12} />}
            <span>پنل تحلیل</span>
          </button>
        )}

        {/* Fullscreen toggle */}
        <button
          onClick={() => setIsFullscreen(f => !f)}
          className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer border flex items-center gap-1 ${
            isFullscreen
              ? 'bg-brand-800 text-signal-400 border-brand-800 shadow-sm'
              : 'bg-paper text-ink-500 border-line hover:text-brand-800 hover:border-brand-300'
          }`}
          title={isFullscreen ? 'خروج از تمام‌صفحه (Esc)' : 'تمام‌صفحه (F)'}
        >
          {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          <span>{isFullscreen ? 'خروج از تمام‌صفحه' : 'تمام‌صفحه'}</span>
        </button>
      </div>
    </div>
  );

  const renderStage = (colClass: string, stageClass: string, compact: boolean) => (
    <div className={`${colClass} panel-card ${compact ? 'p-3 gap-2' : 'p-4 gap-3'} flex flex-col`}>

      {/* Column Indicators */}
      <div className="grid grid-cols-3 text-center text-[10px] font-black text-ink-500 pb-2 border-b border-line/60 shrink-0">
        <span className="flex items-center justify-center gap-1 text-brand-800">
          <Sliders size={12} />
          <span>مداخلات سیاستی (ورودی)</span>
        </span>
        <span className="flex items-center justify-center gap-1 text-warn">
          <Activity size={12} />
          <span>متغیرها و محرک‌های واسط</span>
        </span>
        <span className="flex items-center justify-center gap-1 text-ok">
          <Sparkles size={12} />
          <span>اهداف نهایی (پیامدها)</span>
        </span>
      </div>

      {/* React Flow stage */}
      <div className={`relative w-full ${stageClass} overflow-hidden rounded-xl border border-line bg-white/70`}>
        <ReactFlow
          key={`${filterType}-${autoLayoutEpoch}`}
          nodes={flowNodes}
          edges={flowEdges}
          onNodesChange={onNodesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.16 }}
          minZoom={0.3}
          maxZoom={1.8}
          nodesConnectable={false}
          deleteKeyCode={null}
          className="causal-flow"
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1.4} color="#dbe4f0" />
          <Controls showInteractive={false} />
          <MiniMap
            nodeColor={(n) => {
              const data = (n as CausalFlowNode).data?.node;
              if (!data) return '#cbd5e1';
              if (data.type === 'lever') return '#6366F1';
              if (data.type === 'driver') return '#F59E0B';
              return '#10B981';
            }}
            nodeStrokeWidth={2}
            maskColor="rgba(248, 250, 252, 0.65)"
            pannable
            zoomable
          />

          {/* Arrowhead markers (resolved document-wide by url(#id)) */}
          <svg style={{ position: 'absolute', width: 0, height: 0 }}>
            <defs>
              <marker id="edge-arrow-pos" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#10B981" />
              </marker>
              <marker id="edge-arrow-neg" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#EF4444" />
              </marker>
            </defs>
          </svg>
        </ReactFlow>

        {/* Floating quick actions on the canvas */}
        <div className="absolute left-2 top-2 z-10 flex flex-col gap-1">
          <button
            onClick={resetLayout}
            className={quickActionBtn}
            title="بازچیدمان خودکار (بازگشت به چیدمان سلسله‌مراتبی)"
          >
            <RotateCcw size={13} />
          </button>
          <button
            onClick={() => setIsFullscreen(f => !f)}
            className={quickActionBtn}
            title={isFullscreen ? 'خروج از تمام‌صفحه (Esc)' : 'تمام‌صفحه (F)'}
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
        </div>
      </div>

      {/* Graph Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-line text-[10px] text-ink-500 shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="flex items-center gap-1 font-bold">
            <span className="w-3 h-0.5 bg-ok-soft inline-block" />
            <span>اثر مستقیم (+)</span>
          </span>
          <span className="flex items-center gap-1 font-bold">
            <span className="w-3 h-0.5 bg-danger-soft border-b border-dashed border-danger/50 inline-block" />
            <span>اثر کاهنده/معکوس (-)</span>
          </span>
          <span className="flex items-center gap-1 font-bold">
            <span className="w-2 h-2 rounded-full bg-ok-soft inline-block animate-pulse" />
            <span>نقطهٔ متحرک = موج انتشار اثر</span>
          </span>
        </div>
        <span className="font-mono text-ink-400">راهنما: کلیک = تحلیل گره · کشیدن = جابه‌جایی · F = تمام‌صفحه</span>
      </div>

    </div>
  );

  const renderInspector = (colClass: string, compact: boolean) => (
    <div className={`${colClass} panel-card ${compact ? 'p-3 gap-3' : 'p-4 gap-3'} flex flex-col overflow-y-auto`}>

      <div className="flex items-center justify-between border-b border-line pb-2 shrink-0">
        <span className="text-xs font-black text-brand-800 flex items-center gap-1.5">
          <Eye size={15} />
          <span>تحلیل گره انتخابی</span>
        </span>
        <span className="font-mono text-[10px] bg-brand-50 text-brand-900 border border-brand-200 px-2 py-0.5 rounded font-bold">
          XAI
        </span>
      </div>

      {selectedNode ? (
        <div className="flex flex-col gap-3 text-xs">
          
          {/* Selected Node Header Card */}
          <div className="p-3 bg-surface border border-line rounded-xl flex flex-col gap-1.5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span 
                className="px-2 py-0.5 rounded text-white text-[9.5px] font-black"
                style={{ backgroundColor: selectedNode.color }}
              >
                {selectedNode.dimensionName}
              </span>
              <motion.span
                key={selectedNode.currentValue}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                className="font-mono text-xs font-black text-brand-800"
              >
                {selectedNode.currentValue} {selectedNode.unit}
              </motion.span>
            </div>

            <h3 className="font-extrabold text-ink-800 text-sm mt-0.5">
              {selectedNode.label}
            </h3>
            <p className="text-[10.5px] text-ink-500 leading-relaxed">
              {selectedNode.description}
            </p>
          </div>

          {/* Incoming Causes (ورودی‌های علت) */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-extrabold text-ink-700 flex items-center gap-1">
              <ArrowRight size={13} className="text-brand-600" />
              <span>علل و ورودی‌های متصل ({incomingNodes.length}):</span>
            </span>
            {incomingNodes.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                {incomingNodes.map(inNode => {
                  const edge = DEFAULT_EDGES.find(e => e.sourceId === inNode.id && e.targetId === selectedNode.id);
                  return (
                    <div key={inNode.id} className="p-2 bg-surface border border-line rounded-lg text-[10.5px] flex flex-col gap-1">
                      <div className="flex items-center justify-between font-bold">
                        <span className="text-ink-800">{inNode.label}</span>
                        <span className={`font-mono text-[9.5px] px-1.5 py-0.2 rounded font-black ${
                          edge?.polarity === '+' ? 'bg-ok-soft text-ok' : 'bg-danger-soft text-danger'
                        }`}>
                          قطب: {edge?.polarity} | تاخیر: {edge?.lagTime}
                        </span>
                      </div>
                      {edge?.description && (
                        <p className="text-[9.5px] text-ink-400">{edge.description}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <span className="text-[10px] text-ink-300 italic bg-paper p-2 rounded-lg">
                این گره یک مداخله اولیه (ورودی مستقل) است.
              </span>
            )}
          </div>

          {/* Outgoing Effects (پیامدهای خروجی) */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-extrabold text-ink-700 flex items-center gap-1">
              <ArrowLeft size={13} className="text-ok" />
              <span>معلول‌ها و اثرات خروجی ({outgoingNodes.length}):</span>
            </span>
            {outgoingNodes.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                {outgoingNodes.map(outNode => {
                  const edge = DEFAULT_EDGES.find(e => e.sourceId === selectedNode.id && e.targetId === outNode.id);
                  return (
                    <div key={outNode.id} className="p-2 bg-surface border border-line rounded-lg text-[10.5px] flex flex-col gap-1">
                      <div className="flex items-center justify-between font-bold">
                        <span className="text-ink-800">{outNode.label}</span>
                        <span className={`font-mono text-[9.5px] px-1.5 py-0.2 rounded font-black ${
                          edge?.polarity === '+' ? 'bg-ok-soft text-ok' : 'bg-danger-soft text-danger'
                        }`}>
                          قطب: {edge?.polarity} | تاخیر: {edge?.lagTime}
                        </span>
                      </div>
                      {edge?.description && (
                        <p className="text-[9.5px] text-ink-400">{edge.description}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <span className="text-[10px] text-ink-300 italic bg-paper p-2 rounded-lg">
                این گره یک هدف استراتژیک نهایی (خروجی پیامد) است.
              </span>
            )}
          </div>

        </div>
      ) : (
        <div className="p-6 text-center text-xs text-ink-400">
          یک گره را از روی شبکه انتخاب کنید تا تحلیل علت و معلولی نمایش داده شود.
        </div>
      )}

    </div>
  );

  return (
    <>
      {/* Normal (embedded) layout — stays mounted (invisible) while fullscreen to avoid page reflow */}
      <div
        aria-hidden={isFullscreen}
        className={`w-full bg-surface border border-line rounded-2xl p-4 flex flex-col gap-4 shadow-xs text-right transition-opacity ${
          isFullscreen ? 'invisible' : ''
        }`}
      >
        {renderHeader()}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {renderStage('lg:col-span-8', 'h-[440px]', false)}
          {renderInspector('lg:col-span-4', false)}
        </div>
      </div>

      {/* Fullscreen overlay */}
      <AnimatePresence>
        {isFullscreen && (
          <motion.div
            key="causal-fullscreen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-[120] bg-paper dark:bg-wall-900 flex flex-col gap-3 p-4 overflow-hidden text-right"
          >
            {renderHeader()}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 min-h-0">
              {renderStage(
                inspectorOpen ? 'lg:col-span-8 min-h-0' : 'lg:col-span-12 min-h-0',
                'flex-1 min-h-0',
                true
              )}
              {inspectorOpen && renderInspector('lg:col-span-4 min-h-0', true)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
