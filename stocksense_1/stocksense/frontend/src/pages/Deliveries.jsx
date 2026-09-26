import { useEffect, useState } from 'react';
import { Truck, PackageSearch, PackagePlus, CheckCircle2, Loader2, ArrowRight, ArrowLeft } from 'lucide-react';
import { api } from '../lib/api.js';
import LineItemsEditor from '../components/LineItemsEditor.jsx';
import { StatusPill } from '../components/StatusPill.jsx';

const STEPS = [
  { key: 'pick', label: 'Pick', icon: PackageSearch },
  { key: 'pack', label: 'Pack', icon: PackagePlus },
  { key: 'validate', label: 'Validate', icon: CheckCircle2 },
];

export default function Deliveries() {
  const [locations, setLocations] = useState([]);
  const [products, setProducts] = useState([]);
  const [documents, setDocuments] = useState([]);

  const [step, setStep] = useState('pick');
  const [source, setSource] = useState('');
  const [items, setItems] = useState([{ product_id: '', quantity: 1 }]);
  const [draftDoc, setDraftDoc] = useState(null); // created after Pick, moved through Pack/Validate
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function loadAll() {
    const [locRes, prodRes, docRes] = await Promise.all([
      api.getLocations(),
      api.getProducts(),
      api.getLedgerDocuments({ document_type: 'Delivery' }),
    ]);
    setLocations(locRes.locations || []);
    setProducts(prodRes.products || []);
    setDocuments(docRes.documents || []);
  }

  useEffect(() => { loadAll(); }, []);

  // Step 1 — Pick: create the Delivery document as 'Waiting' with picked lines
  async function handlePick(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const { ledger } = await api.createLedgerDocument({
        document_type: 'Delivery',
        source_location_id: source,
        status: 'Waiting',
        items: items.filter((it) => it.product_id),
      });
      setDraftDoc(ledger);
      setStep('pack');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Step 2 — Pack: mark the document 'Ready' for dispatch
  async function handlePack() {
    setSubmitting(true);
    setError(null);
    try {
      const { ledger } = await api.updateLedgerStatus(draftDoc.id, 'Ready');
      setDraftDoc(ledger);
      setStep('validate');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Step 3 — Validate: transition to 'Done', triggering the stock decrement
  async function handleValidate() {
    setSubmitting(true);
    setError(null);
    try {
      await api.validateLedgerDocument(draftDoc.id);
      resetWizard();
      await loadAll();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function resetWizard() {
    setStep('pick');
    setSource('');
    setItems([{ product_id: '', quantity: 1 }]);
    setDraftDoc(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <Truck className="w-5 h-5 text-amber-warn" /> Deliveries
        </h2>
        <p className="text-sm text-slate-500">Pick, pack, and validate outbound stock in three steps.</p>
      </div>

      <div className="glass-panel p-5">
        <StepIndicator step={step} />

        {step === 'pick' && (
          <form onSubmit={handlePick} className="space-y-4 mt-5">
            <div className="max-w-xs">
              <label className="text-xs text-slate-500 mb-1 block">Source Location</label>
              <select required className="input-field" value={source} onChange={(e) => setSource(e.target.value)}>
                <option value="">Select location…</option>
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>

            <LineItemsEditor items={items} onChange={setItems} products={products} />

            {error && <ErrorBox text={error} />}

            <button type="submit" disabled={submitting} className="btn-primary flex items-center gap-2 text-sm">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              Confirm Pick List
            </button>
          </form>
        )}

        {step === 'pack' && draftDoc && (
          <div className="space-y-4 mt-5">
            <DraftSummary doc={draftDoc} products={products} />
            {error && <ErrorBox text={error} />}
            <div className="flex gap-3">
              <button onClick={() => setStep('pick')} className="btn-ghost flex items-center gap-2 text-sm">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button onClick={handlePack} disabled={submitting} className="btn-primary flex items-center gap-2 text-sm">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                Confirm Packed
              </button>
            </div>
          </div>
        )}

        {step === 'validate' && draftDoc && (
          <div className="space-y-4 mt-5">
            <DraftSummary doc={draftDoc} products={products} />
            <p className="text-xs text-slate-500">
              Validating will decrement stock at <span className="text-slate-300">{locations.find((l) => l.id === source)?.name}</span> and mark the document Done.
            </p>
            {error && <ErrorBox text={error} />}
            <div className="flex gap-3">
              <button onClick={() => setStep('pack')} className="btn-ghost flex items-center gap-2 text-sm">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <button onClick={handleValidate} disabled={submitting} className="btn-primary flex items-center gap-2 text-sm">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Validate Delivery
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="glass-panel overflow-hidden">
        <div className="px-5 py-4 border-b border-panel-border">
          <h3 className="text-white font-semibold text-sm">Recent Deliveries</h3>
        </div>
        <table className="w-full text-sm">
          <tbody>
            {documents.map((doc) => (
              <tr key={doc.id} className="border-b border-panel-border/50">
                <td className="px-5 py-3 font-mono text-xs text-slate-300">{doc.reference}</td>
                <td className="px-5 py-3 text-xs text-slate-400">{doc.source?.name}</td>
                <td className="px-5 py-3 text-xs text-slate-400">{doc.ledger_items?.length || 0} lines</td>
                <td className="px-5 py-3"><StatusPill status={doc.status} /></td>
                <td className="px-5 py-3 text-xs text-slate-500">{new Date(doc.created_at).toLocaleString()}</td>
              </tr>
            ))}
            {documents.length === 0 && (
              <tr><td className="px-5 py-6 text-center text-slate-500 text-sm">No deliveries yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StepIndicator({ step }) {
  const activeIndex = STEPS.findIndex((s) => s.key === step);
  return (
    <div className="flex items-center gap-2">
      {STEPS.map((s, i) => {
        const Icon = s.icon;
        const isActive = i === activeIndex;
        const isDone = i < activeIndex;
        return (
          <div key={s.key} className="flex items-center gap-2 flex-1">
            <div
              className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 ${
                isActive
                  ? 'bg-indigo-soft border-indigo-accent text-indigo-accent'
                  : isDone
                  ? 'bg-emerald-soft border-emerald-pill text-emerald-pill'
                  : 'bg-white/5 border-panel-border text-slate-600'
              }`}
            >
              <Icon className="w-4 h-4" />
            </div>
            <span className={`text-xs font-medium ${isActive ? 'text-white' : 'text-slate-500'}`}>{s.label}</span>
            {i < STEPS.length - 1 && <div className="flex-1 h-px bg-panel-border mx-2" />}
          </div>
        );
      })}
    </div>
  );
}

function DraftSummary({ doc, products }) {
  return (
    <div className="bg-white/5 border border-panel-border rounded-xl p-4">
      <p className="text-xs text-slate-500 mb-2">Document {doc.reference} · <StatusPill status={doc.status} /></p>
      <ul className="space-y-1">
        {(doc.ledger_items || []).map((it) => {
          const p = products.find((pr) => pr.id === it.product_id);
          return (
            <li key={it.id} className="text-sm text-slate-300 flex justify-between">
              <span>{p?.name || 'Unknown product'}</span>
              <span className="font-semibold text-white">{it.quantity}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ErrorBox({ text }) {
  return (
    <div className="text-xs px-3 py-2 rounded-lg bg-crimson-soft text-crimson-bad border border-crimson-bad/30">
      {text}
    </div>
  );
}
