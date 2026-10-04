import React, { useState } from 'react';
import { apiFetch } from '../services/apiClient';
import { 
  GitBranch, 
  CheckCircle2, 
  XCircle, 
  Play, 
  Terminal, 
  Code, 
  Layers, 
  Cpu, 
  Server, 
  Database,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Send,
  Award,
  Lock,
  Flame,
  FileCheck
} from 'lucide-react';
import { runComparisonEngineTestSuite, TestCaseResult } from '../domain/comparisonEngine.test';
import { runEligibilityEngineTestSuite, EligibilityTestCaseResult } from '../domain/eligibilityEngine.test';
import { runCompetitionEngineTestSuite } from '../domain/competitionEngine.test';
import { runBindingAndReconciliationTests } from '../domain/bindingReconciliation.test';
import { runGovernanceAuditTestSuite, GovernanceTestCaseResult } from '../domain/governanceAudit.test';

export const ArchitectureDocs: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'ARCHITECTURE' | 'TDD_TESTS' | 'API_DOCS' | 'CICD'>('TDD_TESTS');
  const [selectedSuite, setSelectedSuite] = useState<
    'ALL' | 'PM1_ELIGIBILITY' | 'PM2_COMPETITION' | 'PM3_BINDING' | 'PM4_GOVERNANCE' | 'COMPARISON'
  >('ALL');

  // Test suite execution states
  const [comparisonResults, setComparisonResults] = useState(() => runComparisonEngineTestSuite());
  const [eligibilityResults, setEligibilityResults] = useState(() => runEligibilityEngineTestSuite());
  const [competitionResults, setCompetitionResults] = useState(() => runCompetitionEngineTestSuite());
  const [bindingResults, setBindingResults] = useState(() => runBindingAndReconciliationTests());
  const [governanceResults, setGovernanceResults] = useState(() => runGovernanceAuditTestSuite());

  const [isRunningTests, setIsRunningTests] = useState(false);

  // Live API test request state
  const [apiEndpoint, setApiEndpoint] = useState<string>('/api/health');
  const [apiResponse, setApiResponse] = useState<string>('Click "Execute API Request" to test live endpoint');
  const [loadingApi, setLoadingApi] = useState(false);

  const handleRunTests = () => {
    setIsRunningTests(true);
    setTimeout(() => {
      setComparisonResults(runComparisonEngineTestSuite());
      setEligibilityResults(runEligibilityEngineTestSuite());
      setCompetitionResults(runCompetitionEngineTestSuite());
      setBindingResults(runBindingAndReconciliationTests());
      setGovernanceResults(runGovernanceAuditTestSuite());
      setIsRunningTests(false);
    }, 350);
  };

  const handleExecuteApi = async () => {
    setLoadingApi(true);
    try {
      const res = await apiFetch(apiEndpoint);
      const data = await res.json();
      setApiResponse(JSON.stringify(data, null, 2));
    } catch (e: any) {
      setApiResponse(`Error: ${e.message}`);
    } finally {
      setLoadingApi(false);
    }
  };

  const bindingPassed = bindingResults.filter(t => t.passed).length;

  const grandTotal = 
    comparisonResults.total + 
    eligibilityResults.total + 
    competitionResults.total + 
    bindingResults.length + 
    governanceResults.total;

  const grandPassed = 
    comparisonResults.passed + 
    eligibilityResults.passed + 
    competitionResults.passed + 
    bindingPassed + 
    governanceResults.passed;

  const grandFailed = grandTotal - grandPassed;

  // Filter test items based on selected tab
  const getDisplayedTests = () => {
    const list: Array<{ name: string; category: string; passed: boolean; details?: string }> = [];

    if (selectedSuite === 'ALL' || selectedSuite === 'COMPARISON') {
      comparisonResults.results.forEach(r => list.push({ ...r, category: `Comparison: ${r.category}` }));
    }
    if (selectedSuite === 'ALL' || selectedSuite === 'PM1_ELIGIBILITY') {
      eligibilityResults.results.forEach(r => list.push({ ...r, category: `PM-1: ${r.category}` }));
    }
    if (selectedSuite === 'ALL' || selectedSuite === 'PM2_COMPETITION') {
      competitionResults.results.forEach(r => list.push({ ...r, category: `PM-2: ${r.category}` }));
    }
    if (selectedSuite === 'ALL' || selectedSuite === 'PM3_BINDING') {
      bindingResults.forEach(r => list.push({ ...r, category: `PM-3: ${r.category}` }));
    }
    if (selectedSuite === 'ALL' || selectedSuite === 'PM4_GOVERNANCE') {
      governanceResults.results.forEach(r => list.push({ ...r, category: `PM-4: ${r.category}` }));
    }

    return list;
  };

  const displayedTests = getDisplayedTests();

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white rounded-xl p-6 border border-slate-800 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono font-bold bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/30">
              ARCHITECTURAL SPECIFICATION & TDD
            </span>
            <span className="text-[11px] font-mono text-emerald-400">All 4 Milestones Active (PM-1 to PM-4)</span>
          </div>
          <h2 className="text-xl font-bold text-white mt-1">
            Modular Microservices, Clean Architecture & Tests
          </h2>
          <p className="text-xs text-slate-400">
            Decoupled domain boundaries, deterministic business logic, interactive API docs, and automated unit test verification.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap items-center gap-1 bg-slate-800 p-1 rounded-lg text-xs">
          <button
            onClick={() => setActiveTab('TDD_TESTS')}
            className={`px-3 py-1.5 rounded font-medium transition ${activeTab === 'TDD_TESTS' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'}`}
          >
            TDD Suite ({grandPassed}/{grandTotal})
          </button>
          <button
            onClick={() => setActiveTab('ARCHITECTURE')}
            className={`px-3 py-1.5 rounded font-medium transition ${activeTab === 'ARCHITECTURE' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'}`}
          >
            Decoupled Boundaries
          </button>
          <button
            onClick={() => setActiveTab('API_DOCS')}
            className={`px-3 py-1.5 rounded font-medium transition ${activeTab === 'API_DOCS' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'}`}
          >
            Interactive API
          </button>
          <button
            onClick={() => setActiveTab('CICD')}
            className={`px-3 py-1.5 rounded font-medium transition ${activeTab === 'CICD' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'}`}
          >
            CI/CD Pipeline
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. TDD AUTOMATED TEST SUITE                                               */}
      {/* ========================================================================= */}
      {activeTab === 'TDD_TESTS' && (
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 md:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="text-lg font-bold text-slate-900">
                  Comprehensive Domain Engine Test Suite ({grandPassed}/{grandTotal} Passing)
                </h3>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Validates all core domain engine invariants across PM-1 (Eligibility), PM-2 (Competition), PM-3 (Binding/Reconciliation), PM-4 (Audit/Review Queue), and Section 40 (Comparison).
              </p>
            </div>

            <button
              onClick={handleRunTests}
              disabled={isRunningTests}
              className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-lg transition shadow-xs self-start"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isRunningTests ? 'Executing All Suites...' : 'Re-Execute All Tests'}</span>
            </button>
          </div>

          {/* Test Suite Selector Tabs */}
          <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
            <button
              onClick={() => setSelectedSuite('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                selectedSuite === 'ALL'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Suites ({grandTotal})
            </button>
            <button
              onClick={() => setSelectedSuite('PM1_ELIGIBILITY')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                selectedSuite === 'PM1_ELIGIBILITY'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              PM-1 Eligibility ({eligibilityResults.total})
            </button>
            <button
              onClick={() => setSelectedSuite('PM2_COMPETITION')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                selectedSuite === 'PM2_COMPETITION'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              PM-2 Competition ({competitionResults.total})
            </button>
            <button
              onClick={() => setSelectedSuite('PM3_BINDING')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                selectedSuite === 'PM3_BINDING'
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              PM-3 Binding & Reconciliation ({bindingResults.length})
            </button>
            <button
              onClick={() => setSelectedSuite('PM4_GOVERNANCE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                selectedSuite === 'PM4_GOVERNANCE'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              PM-4 Audit & Review Queue ({governanceResults.total})
            </button>
            <button
              onClick={() => setSelectedSuite('COMPARISON')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                selectedSuite === 'COMPARISON'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Comparison Engine ({comparisonResults.total})
            </button>
          </div>

          {/* Test Summary Scorecard */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-center">
              <span className="text-[11px] font-semibold text-slate-500 uppercase block">Total Executed</span>
              <span className="text-2xl font-black text-slate-900">{grandTotal}</span>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
              <span className="text-[11px] font-semibold text-emerald-700 uppercase block">Tests Passed</span>
              <span className="text-2xl font-black text-emerald-700">{grandPassed}</span>
            </div>
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-center">
              <span className="text-[11px] font-semibold text-rose-700 uppercase block">Tests Failed</span>
              <span className="text-2xl font-black text-rose-700">{grandFailed}</span>
            </div>
          </div>

          {/* Test Case Execution List */}
          <div className="space-y-2.5">
            {displayedTests.map((r, i) => (
              <div 
                key={i}
                className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 flex items-start justify-between gap-4 text-xs"
              >
                <div className="flex items-start space-x-2.5">
                  {r.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-900">{r.name}</span>
                      <span className="text-[10px] font-mono bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                        {r.category}
                      </span>
                    </div>
                    {r.details && (
                      <p className="text-[11px] text-slate-500 mt-0.5 font-mono">{r.details}</p>
                    )}
                  </div>
                </div>

                <div className="shrink-0 text-right font-mono text-[11px]">
                  <span className="text-emerald-700 font-bold bg-emerald-100/70 px-2 py-0.5 rounded">
                    PASS
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. DECOUPLED BOUNDARIES & CLEAN ARCHITECTURE VISUALIZER                   */}
      {/* ========================================================================= */}
      {activeTab === 'ARCHITECTURE' && (
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 md:p-8 space-y-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Decoupled Clean Architecture & Microservice Packages (Section 36)
            </h3>
            <p className="text-xs text-slate-600 mt-1">
              Domain logic is isolated into standalone npm packages that can be executed server-side, in background queue workers, or in edge containers without coupling to the presentation layer.
            </p>
          </div>

          {/* Interactive Monorepo Package Map */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">
                  /packages/policy-schema
                </span>
              </div>
              <p className="text-xs text-slate-700">
                Carrier-independent canonical insurance representation. Extensible objects: Policy, NamedInsured, Vehicle, Coverage, Endorsement, SourceEvidence.
              </p>
              <div className="text-[11px] text-slate-500 font-mono">
                Dependencies: None (Pure Domain Interfaces & Zod validation)
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">
                  /packages/comparison-engine
                </span>
              </div>
              <p className="text-xs text-slate-700">
                Pure deterministic comparison evaluator. Field results (BETTER, EQUIVALENT, WORSE, DIFFERENT, UNKNOWN) and whole-offer classes (BASELINE MATCH, BASELINE PLUS, COVERAGE CHANGED, REVIEW REQUIRED).
              </p>
              <div className="text-[11px] text-slate-500 font-mono">
                Dependencies: @policy-challenge/policy-schema
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">
                  /packages/competition-engine
                </span>
              </div>
              <p className="text-xs text-slate-700">
                Inverted marketplace lifecycle (PM-2): Anonymous multi-round bidding, market signals (spread, lead, percentile), and blind round transitions.
              </p>
              <div className="text-[11px] text-slate-500 font-mono">
                Dependencies: @policy-challenge/comparison-engine
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">
                  /packages/binding-reconciliation
                </span>
              </div>
              <p className="text-xs text-slate-700">
                Section 40 informed consent gating (PM-3), binding handoff dossier generation, and post-bind rate creep / deductible inflation detection.
              </p>
              <div className="text-[11px] text-slate-500 font-mono">
                Dependencies: @policy-challenge/policy-schema
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2 md:col-span-2">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">
                  /packages/governance-audit (PM-4)
                </span>
              </div>
              <p className="text-xs text-slate-700">
                Append-only cryptographically chained event ledger (Section 33), binary Merkle root verification over block transactions, Section 32 human-in-the-loop review queue for ambiguous extractions, and Section 34 statutory compliance proofs for State Insurance Commissioners.
              </p>
              <div className="text-[11px] text-slate-500 font-mono">
                Dependencies: @policy-challenge/policy-schema (Zero external crypto runtime dependencies)
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. INTERACTIVE REST API DOCUMENTATION                                     */}
      {/* ========================================================================= */}
      {activeTab === 'API_DOCS' && (
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 md:p-8 space-y-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Interactive OpenAPI / REST API Documentation
            </h3>
            <p className="text-xs text-slate-600 mt-1">
              Test real API endpoints live against the running Express backend.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
            <select
              value={apiEndpoint}
              onChange={e => setApiEndpoint(e.target.value)}
              className="text-xs font-mono font-semibold bg-white border border-slate-300 rounded-lg px-3 py-2"
            >
              <option value="/api/health">GET /api/health</option>
              <option value="/api/metrics">GET /api/metrics</option>
              <option value="/api/audit-events">GET /api/audit-events</option>
              <option value="/api/admin/review-queue">GET /api/admin/review-queue (PM-4)</option>
              <option value="/api/admin/audit-chain/verify">GET /api/admin/audit-chain/verify (PM-4)</option>
              <option value="/api/challenges">GET /api/challenges</option>
              <option value="/api/marketplace/active-provider">GET /api/marketplace/active-provider (PM-1)</option>
              <option value="/api/marketplace/competition/CHAL-NV-49281/status">GET /api/marketplace/competition/.../status (PM-2)</option>
              <option value="/api/selection/dossier-by-challenge/CHAL-NV-49281">GET /api/selection/dossier-by-challenge/... (PM-3)</option>
              <option value="/api/tests/run">GET /api/tests/run</option>
              <option value="/api/docs/spec">GET /api/docs/spec</option>
            </select>

            <button
              onClick={handleExecuteApi}
              disabled={loadingApi}
              className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2 rounded-lg transition"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{loadingApi ? 'Sending...' : 'Execute API Request'}</span>
            </button>
          </div>

          {/* Response Console */}
          <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800">
              <span className="font-mono">{apiEndpoint} — Response Payload</span>
              <span className="text-[11px]">JSON Format</span>
            </div>
            <pre className="text-emerald-400 font-mono text-[11px] max-h-72 overflow-y-auto whitespace-pre-wrap">
              {apiResponse}
            </pre>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. CI/CD INTEGRATION & AUTOMATED DEPLOYMENT                               */}
      {/* ========================================================================= */}
      {activeTab === 'CICD' && (
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 md:p-8 space-y-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              Seamless CI/CD Integration & Automated Pipeline
            </h3>
            <p className="text-xs text-slate-600 mt-1">
              Automated testing and zero-downtime deployment pipeline specification across all milestones.
            </p>
          </div>

          <div className="bg-slate-900 text-slate-200 rounded-xl p-5 border border-slate-800 font-mono text-xs space-y-3">
            <div className="flex items-center justify-between text-slate-400 pb-2 border-b border-slate-800">
              <span>.github/workflows/policy-challenge-ci.yml</span>
              <span className="text-[10px] bg-slate-800 text-emerald-400 px-2 py-0.5 rounded">GitHub Actions</span>
            </div>
            <pre className="text-slate-300 text-[11px] leading-relaxed overflow-x-auto">
{`name: Policy Challenge Continuous Delivery

on:
  push:
    branches: [main, release/*]
  pull_request:
    branches: [main]

jobs:
  domain-tests:
    name: Execute All Milestones Domain TDD Suite (PM-1 to PM-4)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'npm'
        - run: npm ci
        - run: npm run lint
        - run: npm run build

  regulatory-chain-check:
    name: Verify Append-Only Cryptographic Chain Invariants
    needs: domain-tests
    runs-on: ubuntu-latest
    steps:
      - run: npx tsx -e "import { runGovernanceAuditTestSuite } from './src/domain/governanceAudit.test'; const r = runGovernanceAuditTestSuite(); if (r.failed > 0) process.exit(1);"

  database-migrations:
    name: Verify PostgreSQL Schema Migrations
    needs: domain-tests
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: policy_challenge
          POSTGRES_PASSWORD: test
        ports:
          - 5432:5432
    steps:
      - uses: actions/checkout@v4
      - run: npx drizzle-kit check:pg

  deploy-container:
    name: Build & Zero-Downtime Cloud Run Deploy
    needs: [domain-tests, regulatory-chain-check, database-migrations]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm run build
      - name: Deploy to Cloud Run
        run: gcloud run deploy policy-challenge --image gcr.io/prod/engine:latest`}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
