import { useEffect, useState } from 'react';
import {
  Boxes, AlertTriangle, PackageX, Clock, ArrowLeftRight, RefreshCw,
} from 'lucide-react';
import { api } from '../lib/api.js';
import KpiCard from '../components/KpiCard.jsx';
import { StatusPill, DocTypePill } from '../components/StatusPill.jsx';

const DOC_TYPES = ['Receipt', 'Delivery', 'Internal', 'Adjustment'];
const STATUSES = ['Draft', 'Waiting', 'Ready', 'Done', 'Canceled'];

export default function Dashboard({ activeLocation }) {
  const [kpis, setKpis] = useState(null);
  const [activity, setActivity] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState({ document_type: '', status: '', category_id: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [kpiRes, activityRes, catRes] = await Promise.all([
        api.getKpis(),
        api.getActivity({
          ...(filters.document_type && { document_type: filters.document_type }),
          ...(filters.status && { status: filters.status }),
          ...(activeLocation && { location_id: activeLocation }),
        }),
        api.getCategories(),
      ]);
      setKpis(kpiRes);
      setActivity(activityRes.activity || []);
      setCategories(catRes.categories || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.document_type, filters.status, activeLocation]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Dashboard</h2>
          <p className="text-sm text-slate-500">Real-time inventory overview</p>
        </div>
        <button onClick={loadAll} className="btn-ghost flex items-center gap-2 text-sm">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="glass-panel px-4 py-3 text-sm text-crimson-bad border-crimson-bad/30">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard icon={Boxes} label="Total Stock Units" value={kpis?.totalStockUnits ?? '—'} tone="neutral" />
        <KpiCard icon={AlertTriangle} label={`Low Stock (≤ ${kpis?.lowStockThreshold ?? 10})`} value={kpis?.lowStockCount ?? '—'} tone="warn" />
        <KpiCard icon={PackageX} label="Out of Stock" value={kpis?.outOfStockCount ?? '—'} tone="bad" />
        <KpiCard icon={Clock} label="Pending Documents" value={kpis?.pendingDocuments ?? '—'} tone="neutral" />
        <KpiCard icon={ArrowLeftRight} label="Upcoming Transfers" value={kpis?.upcomingTransfers ?? '—'} tone="positive" />
      </div>

      <div className="glass-panel p-4 flex flex-wrap gap-3">
        <Select
          label="Document Type"
          value={filters.document_type}
          onChange={(v) => setFilters((f) => ({ ...f, document_type: v }))}
          options={DOC_TYPES}
        />
        <Select
          label="Status"
          value={filters.status}
          onChange={(v) => setFilters((f) => ({ ...f, status: v }))}
          options={STATUSES}
        />
        <Select
          label="Category"
          value={filters.category_id}
          onChange={(v) => setFilters((f) => ({ ...f, category_id: v }))}
          options={categories.map((c) => ({ value: c.id, label: c.name }))}
        />
      </div>

      <div className="glass-panel overflow-hidden">
        <div className="px-5 py-4 border-b border-panel-border">
          <h3 className="text-white font-semibold text-sm">Ledger Activity Stream</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 text-xs uppercase tracking-wide border-b border-panel-border">
                <th className="px-5 py-3 font-medium">Reference</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Route</th>
                <th className="px-5 py-3 font-medium">Items</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {activity.map((doc) => (
                <tr key={doc.id} className="border-b border-panel-border/50 hover:bg-white/5 transition">
                  <td className="px-5 py-3 text-slate-300 font-mono text-xs">{doc.reference}</td>
                  <td className="px-5 py-3"><DocTypePill type={doc.document_type} /></td>
                  <td className="px-5 py-3 text-slate-400 text-xs">
                    {doc.source?.name || '—'} <span className="text-slate-600">→</span> {doc.destination?.name || '—'}
                  </td>
                  <td className="px-5 py-3 text-slate-400 text-xs">{doc.ledger_items?.length || 0} lines</td>
                  <td className="px-5 py-3"><StatusPill status={doc.status} /></td>
                  <td className="px-5 py-3 text-slate-500 text-xs">
                    {new Date(doc.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}
              {!loading && activity.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-500 text-sm">
                    No documents match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] text-slate-500 uppercase tracking-wide">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-field text-slate-300"
      >
        <option value="">All</option>
        {options.map((opt) =>
          typeof opt === 'string' ? (
            <option key={opt} value={opt}>{opt}</option>
          ) : (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          )
        )}
      </select>
    </div>
  );
}
