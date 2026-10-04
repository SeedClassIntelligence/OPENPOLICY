import React, { useState, useEffect } from 'react';
import { apiFetch } from '../services/apiClient';
import { 
  Activity, 
  Database, 
  Server, 
  Cpu, 
  HardDrive, 
  Zap, 
  CheckCircle, 
  Clock, 
  TrendingUp,
  RefreshCw,
  Layers,
  Terminal,
  ShieldCheck
} from 'lucide-react';
import { SystemMetrics } from '../types/insurance';

export const TelemetryDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<SystemMetrics>({
    activeChallenges: 1,
    totalPoliciesIngested: 3,
    redisCacheHitRate: 96.4,
    p95ComparisonLatencyMs: 14.2,
    workerQueueJobsProcessed: 1492,
    discrepanciesIntercepted: 14,
    averageConsumerSavings: 428
  });

  const [activeTab, setActiveTab] = useState<'METRICS' | 'REDIS' | 'POSTGRES'>('METRICS');

  // Simulated live Redis keys
  const [redisKeys, setRedisKeys] = useState([
    { key: 'cache:baseline:BL-NV-49281', type: 'HASH', ttl: '3482s', hits: 142 },
    { key: 'cache:comparison:CHAL-NV-49281:OFFER-A', type: 'STRING', ttl: '1820s', hits: 89 },
    { key: 'cache:comparison:CHAL-NV-49281:OFFER-B', type: 'STRING', ttl: '1820s', hits: 114 },
    { key: 'rate_limit:provider:PROV-1', type: 'INT', ttl: '42s', hits: 6 },
    { key: 'queue:bullmq:doc-ocr:active', type: 'LIST', ttl: 'PERSISTENT', hits: 1492 }
  ]);

  const fetchMetrics = async () => {
    try {
      const res = await apiFetch('/api/metrics');
      const data = await res.json();
      setMetrics(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      {/* Grafana-Style Header */}
      <div className="bg-slate-900 text-white rounded-xl p-6 border border-slate-800 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono font-bold bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded border border-purple-500/30 flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>GRAFANA REAL-TIME TELEMETRY</span>
            </span>
            <span className="text-xs text-slate-400 font-mono">Cluster: us-west1-prod</span>
          </div>
          <h2 className="text-xl font-bold text-white mt-1">
            Performance Analytics & Engine Health
          </h2>
          <p className="text-xs text-slate-400">
            Real-time observability of PostgreSQL integrity, Redis caching throughput, and BullMQ worker queue latencies.
          </p>
        </div>

        {/* View Switcher */}
        <div className="flex items-center space-x-1 bg-slate-800 p-1 rounded-lg text-xs">
          <button
            onClick={() => setActiveTab('METRICS')}
            className={`px-3 py-1.5 rounded font-medium transition ${activeTab === 'METRICS' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'}`}
          >
            System Metrics
          </button>
          <button
            onClick={() => setActiveTab('REDIS')}
            className={`px-3 py-1.5 rounded font-medium transition ${activeTab === 'REDIS' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'}`}
          >
            Fast-Path Cache ({redisKeys.length})
          </button>
          <button
            onClick={() => setActiveTab('POSTGRES')}
            className={`px-3 py-1.5 rounded font-medium transition ${activeTab === 'POSTGRES' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'}`}
          >
            PostgreSQL 16 Schema
          </button>
        </div>
      </div>

      {activeTab === 'METRICS' && (
        <>
          {/* Key Metric Tiles (Grafana Style) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Cache Hit Ratio */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-white">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>Fast-Path Cache Hit Rate</span>
                <Zap className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-mono font-bold text-emerald-400">
                {metrics.redisCacheHitRate}%
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                Avg Rating Lookup: 1.2ms
              </div>
            </div>

            {/* P95 Latency */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-white">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>P95 Engine Latency</span>
                <Clock className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-2xl font-mono font-bold text-blue-400">
                {metrics.p95ComparisonLatencyMs} ms
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                Deterministic Field Matrix
              </div>
            </div>

            {/* BullMQ Worker Jobs */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-white">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>BullMQ Jobs Executed</span>
                <Cpu className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-2xl font-mono font-bold text-purple-400">
                {metrics.workerQueueJobsProcessed.toLocaleString()}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                0 Failed / 100% Success
              </div>
            </div>

            {/* Discrepancies Intercepted */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-white">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span>Quote Discrepancies Caught</span>
                <ShieldCheck className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-mono font-bold text-amber-400">
                {metrics.discrepanciesIntercepted}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                Stealth term cuts intercepted
              </div>
            </div>
          </div>

          {/* Microservice Health Indicators */}
          <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Decoupled Microservice Health Status
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">Document Intelligence Worker</span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">ONLINE</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  OCR Engine: Tesseract / Vision AI with bounding-box snippet coordinates.
                </p>
                <div className="text-[10px] text-slate-400 font-mono">TPS: 42 docs/min • Concurrency: 8</div>
              </div>

              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">Comparison Engine Service</span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">ONLINE</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Pure deterministic comparisons: Limits, Deductibles, Whole-Offer classifications.
                </p>
                <div className="text-[10px] text-slate-400 font-mono">P99: 18.2ms • Error Rate: 0.00%</div>
              </div>

              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">Renewal Continuity Cron</span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">ONLINE</span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Monitors active baseline expiration dates (60d, 30d, 15d notice schedule).
                </p>
                <div className="text-[10px] text-slate-400 font-mono">Next execution: In 4 hours</div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Redis Inspector View */}
      {activeTab === 'REDIS' && (
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Engine Fast-Path In-Memory Cache
              </h3>
              <p className="text-xs text-slate-500">
                Low-latency key-value store for coverage baselines, offer comparisons, and token rate limiting.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-red-600 bg-red-50 border border-red-200 px-2.5 py-1 rounded">
              Memory Used: 142.8 MB
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-600 font-semibold border-b border-slate-200">
                  <th className="py-2.5 px-3">Redis Key</th>
                  <th className="py-2.5 px-3">Data Type</th>
                  <th className="py-2.5 px-3">Time-To-Live (TTL)</th>
                  <th className="py-2.5 px-3">Access Hits</th>
                  <th className="py-2.5 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {redisKeys.map((k, i) => (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="py-3 px-3 font-semibold text-slate-900">{k.key}</td>
                    <td className="py-3 px-3 text-slate-600">{k.type}</td>
                    <td className="py-3 px-3 text-amber-700">{k.ttl}</td>
                    <td className="py-3 px-3 text-emerald-700">{k.hits}</td>
                    <td className="py-3 px-3 text-right">
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-sans font-bold">
                        CACHED
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PostgreSQL Relational Schema View (Section 34) */}
      {activeTab === 'POSTGRES' && (
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                PostgreSQL Relational Schema & Entity Integrity (Section 34)
              </h3>
              <p className="text-xs text-slate-500">
                Primary relational entities with strict foreign keys, immutable audit trails, and versioning.
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded">
              PostgreSQL 16 • 12 Relational Tables
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs font-mono">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="font-bold text-slate-900 block mb-1">Table: policies</span>
              <p className="text-[11px] text-slate-600">
                • id (UUID PK)<br/>
                • policy_number (VARCHAR)<br/>
                • carrier (VARCHAR)<br/>
                • annual_premium (NUMERIC)<br/>
                • status (ENUM)
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="font-bold text-slate-900 block mb-1">Table: coverage_baselines</span>
              <p className="text-[11px] text-slate-600">
                • id (UUID PK)<br/>
                • policy_id (FK → policies)<br/>
                • version (INT)<br/>
                • baseline_annual_premium<br/>
                • verified_at (TIMESTAMP)
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="font-bold text-slate-900 block mb-1">Table: challenges</span>
              <p className="text-[11px] text-slate-600">
                • id (UUID PK)<br/>
                • baseline_id (FK)<br/>
                • requirements_id (FK)<br/>
                • disclosure_level (ENUM)<br/>
                • status (ENUM)
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="font-bold text-slate-900 block mb-1">Table: offers</span>
              <p className="text-[11px] text-slate-600">
                • id (UUID PK)<br/>
                • challenge_id (FK)<br/>
                • provider_id (FK)<br/>
                • carrier (VARCHAR)<br/>
                • quote_number (VARCHAR)<br/>
                • annual_premium (NUMERIC)
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="font-bold text-slate-900 block mb-1">Table: binding_handoffs</span>
              <p className="text-[11px] text-slate-600">
                • id (UUID PK)<br/>
                • challenge_id (FK)<br/>
                • selected_offer_id (FK)<br/>
                • binding_reference (VARCHAR)<br/>
                • status (ENUM)
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
              <span className="font-bold text-slate-900 block mb-1">Table: audit_events</span>
              <p className="text-[11px] text-slate-600">
                • id (UUID PK)<br/>
                • event_type (VARCHAR)<br/>
                • actor_role (ENUM)<br/>
                • block_hash (CHAR 64)<br/>
                • prev_hash (CHAR 64)
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
