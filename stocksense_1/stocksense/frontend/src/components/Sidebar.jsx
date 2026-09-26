import { useEffect, useState } from 'react';
import {
  Boxes, LayoutDashboard, Package, Truck, ArrowLeftRight,
  ClipboardList, History, ChevronDown, LogOut, PackageCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../lib/api.js';

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'products', label: 'Products', icon: Package },
  { key: 'receipts', label: 'Receipts', icon: PackageCheck },
  { key: 'deliveries', label: 'Deliveries', icon: Truck },
  { key: 'internal', label: 'Internal Moves', icon: ArrowLeftRight },
  { key: 'adjustments', label: 'Adjustments', icon: ClipboardList },
  { key: 'history', label: 'Move History', icon: History },
];

export default function Sidebar({ activeView, onNavigate, activeLocation, onLocationChange }) {
  const { user, profile, signOut } = useAuth();
  const [locations, setLocations] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    api.getLocations().then((r) => setLocations(r.locations || [])).catch(() => {});
  }, []);

  const currentLocationName =
    locations.find((l) => l.id === activeLocation)?.name || 'All Warehouses';

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 glass-panel rounded-none border-r border-panel-border flex flex-col">
      <div className="flex items-center gap-3 px-5 py-6">
        <div className="p-2 rounded-xl bg-indigo-soft border border-indigo-accent/40">
          <Boxes className="w-5 h-5 text-indigo-accent" />
        </div>
        <div>
          <h1 className="text-white font-bold tracking-tight leading-none">StockSense</h1>
          <p className="text-[10px] text-slate-500 mt-0.5">Inventory OS</p>
        </div>
      </div>

      <div className="px-4 mb-4 relative">
        <button
          onClick={() => setPickerOpen((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 border border-panel-border text-sm text-slate-300 hover:bg-white/10 transition"
        >
          <span className="truncate">{currentLocationName}</span>
          <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
        </button>
        {pickerOpen && (
          <div className="absolute z-10 mt-1 w-full glass-panel py-1 max-h-56 overflow-y-auto">
            <button
              onClick={() => { onLocationChange(null); setPickerOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-white/10"
            >
              All Warehouses
            </button>
            {locations.map((loc) => (
              <button
                key={loc.id}
                onClick={() => { onLocationChange(loc.id); setPickerOpen(false); }}
                className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-white/10"
              >
                {loc.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
          <div
            key={key}
            onClick={() => onNavigate(key)}
            className={`nav-link ${activeView === key ? 'nav-link-active' : ''}`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </div>
        ))}
      </nav>

      <div className="px-4 py-4 border-t border-panel-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-indigo-soft border border-indigo-accent/40 flex items-center justify-center text-indigo-accent font-semibold text-sm shrink-0">
            {(profile?.full_name || user?.email || '?').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-white font-medium truncate">
              {profile?.full_name || user?.email}
            </p>
            <p className="text-[11px] text-slate-500 truncate">
              {profile?.role || 'Warehouse Staff'}
            </p>
          </div>
          <button onClick={signOut} title="Sign out" className="text-slate-500 hover:text-crimson-bad transition">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
