import { useState } from 'react';
import { useAuth } from './context/AuthContext.jsx';
import AuthCard from './components/AuthCard.jsx';
import Sidebar from './components/Sidebar.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Products from './pages/Products.jsx';
import Receipts from './pages/Receipts.jsx';
import Deliveries from './pages/Deliveries.jsx';
import InternalMoves from './pages/InternalMoves.jsx';
import Adjustments from './pages/Adjustments.jsx';
import MoveHistory from './pages/MoveHistory.jsx';
import { Loader2 } from 'lucide-react';

const VIEWS = {
  dashboard: Dashboard,
  products: Products,
  receipts: Receipts,
  deliveries: Deliveries,
  internal: InternalMoves,
  adjustments: Adjustments,
  history: MoveHistory,
};

export default function App() {
  const { session, loading } = useAuth();
  const [activeView, setActiveView] = useState('dashboard');
  const [activeLocation, setActiveLocation] = useState(null);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-indigo-accent animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <AuthCard />;
  }

  const ActiveComponent = VIEWS[activeView] || Dashboard;

  return (
    <div className="min-h-screen">
      <Sidebar
        activeView={activeView}
        onNavigate={setActiveView}
        activeLocation={activeLocation}
        onLocationChange={setActiveLocation}
      />
      <main className="ml-64 p-8 max-w-[1600px]">
        <ActiveComponent activeLocation={activeLocation} />
      </main>
    </div>
  );
}
