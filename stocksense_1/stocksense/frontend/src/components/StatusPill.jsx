const STATUS_TONE = {
  Draft: 'pill-neutral',
  Waiting: 'pill-warn',
  Ready: 'pill-neutral',
  Done: 'pill-positive',
  Canceled: 'pill-bad',
};

const DOC_TYPE_TONE = {
  Receipt: 'pill-positive',
  Delivery: 'pill-warn',
  Internal: 'pill-neutral',
  Adjustment: 'pill-bad',
};

export function StatusPill({ status }) {
  return <span className={`pill ${STATUS_TONE[status] || 'pill-neutral'}`}>{status}</span>;
}

export function DocTypePill({ type }) {
  return <span className={`pill ${DOC_TYPE_TONE[type] || 'pill-neutral'}`}>{type}</span>;
}

export function StockLevelPill({ quantity, threshold = 10 }) {
  if (quantity === 0) return <span className="pill pill-bad">Out of stock</span>;
  if (quantity <= threshold) return <span className="pill pill-warn">Low · {quantity}</span>;
  return <span className="pill pill-positive">{quantity}</span>;
}
