import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { pullAll, syncOnReconnect } from './lib/sync';
import { SyncContext } from './lib/SyncContext';
import Dashboard from './pages/Dashboard';
import Apartados from './pages/Apartados';
import NuevoApartado from './pages/NuevoApartado';
import DetalleApartado from './pages/DetalleApartado';
import Entregas from './pages/Entregas';
import TandaDashboard from './pages/Tanda';
import TandaDetalle from './pages/TandaDetalle';
import TandaNueva from './pages/TandaNueva';

export default function App() {
  const [syncReady, setSyncReady] = useState(false);

  useEffect(() => {
    const init = async () => {
      if (navigator.onLine) await pullAll();
      setSyncReady(true);
    };
    init();

    window.addEventListener('online', syncOnReconnect);
    return () => window.removeEventListener('online', syncOnReconnect);
  }, []);

  return (
    <SyncContext.Provider value={syncReady}>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/apartados" element={<Apartados />} />
        <Route path="/nuevo" element={<NuevoApartado />} />
        <Route path="/apartado/:id" element={<DetalleApartado />} />
        <Route path="/entregas" element={<Entregas />} />
        <Route path="/tanda" element={<TandaDashboard />} />
        <Route path="/tanda/nueva" element={<TandaNueva />} />
        <Route path="/tanda/:id" element={<TandaDetalle />} />
      </Routes>
    </BrowserRouter>
    </SyncContext.Provider>
  );
}
