export default function KpiCard({ icon: Icon, label, value, tone = 'neutral', suffix }) {
  const toneClasses = {
    neutral: 'text-indigo-accent bg-indigo-soft border-indigo-accent/30',
    positive: 'text-emerald-pill bg-emerald-soft border-emerald-pill/30',
    warn: 'text-amber-warn bg-amber-soft border-amber-warn/30',
    bad: 'text-crimson-bad bg-crimson-soft border-crimson-bad/30',
  }[tone];

  return (
    <div className="glass-panel p-5 flex flex-col gap-3">
      <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${toneClasses}`}>
        <Icon className="w-4.5 h-4.5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-white tracking-tight">
          {value}
          {suffix && <span className="text-sm text-slate-500 font-medium ml-1">{suffix}</span>}
        </p>
        <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}
