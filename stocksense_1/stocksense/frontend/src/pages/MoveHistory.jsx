import { useEffect, useState } from 'react';
import { History, CheckCircle2, Loader2 } from 'lucide-react';
import { api } from '../lib/api.js';
import { StatusPill, DocTypePill } from '../components/StatusPill.jsx';

export default function MoveHistory() {
  const [documents, setDocuments] = useState([]);
  const [filter, setFilter] = useState({ document_type: '', status: '' });
  const [loading, setLoading] = useState(true);
  const [validatingId, setValidatingId] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const res = await api.getLedgerDocuments({
        ...(filter.document_type && { document_type: filter.document_type }),
        ...(filter.status && { status: filter.status }),
      });
      setDocuments(res.documents || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [filter.document_type, filter.status]);

  async function handleValidate(id) {
    setValidatingId(id);
    try {
      await api.validateLedgerDocument(id);
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      setValidatingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <History className="w-5 h-5 text-indigo-accent" /> Move History
        </h2>
        <p className="text-sm text-slate-500">Full audit trail of every stock movement document.</p>
      </div>

      <div className="glass-panel p-4 flex flex-wrap gap-3">
        <select className="input-field w-48" value={filter.document_type} onChange={(e) => setFilter((f) => ({ ...f, document_type: e.target.value }))}>
          <option value="">All Types</option>
          {['Receipt', 'Delivery', 'Internal', 'Adjustment'].map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="input-field w-48" value={filter.status} onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}>
          <option value="">All Statuses</option>
          {['Draft', 'Waiting', 'Ready', 'Done', 'Canceled'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="glass-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 text-xs uppercase tracking-wide border-b border-panel-border">
                <th className="px-5 py-3 font-medium">Reference</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Route</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Created</th>
                <th className="px-5 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((doc) => (
                <tr key={doc.id} className="border-b border-panel-border/50 hover:bg-white/5 transition">
                  <td className="px-5 py-3 font-mono text-xs text-slate-300">{doc.reference}</td>
                  <td className="px-5 py-3"><DocTypePill type={doc.document_type} /></td>
                  <td className="px-5 py-3 text-xs text-slate-400">
                    {doc.source?.name || '—'} <span className="text-slate-600">→</span> {doc.destination?.name || '—'}
                  </td>
                  <td className="px-5 py-3"><StatusPill status={doc.status} /></td>
                  <td className="px-5 py-3 text-xs text-slate-500">{new Date(doc.created_at).toLocaleString()}</td>
                  <td className="px-5 py-3">
                    {doc.status !== 'Done' && doc.status !== 'Canceled' ? (
                      <button
                        onClick={() => handleValidate(doc.id)}
                        disabled={validatingId === doc.id}
                        className="btn-ghost text-xs flex items-center gap-1.5 px-2.5 py-1.5"
                      >
                        {validatingId === doc.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                        Validate
                      </button>
                    ) : (
                      <span className="text-slate-600 text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && documents.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-500 text-sm">No documents found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
