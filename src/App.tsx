import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import NuevoApartado from './pages/NuevoApartado';
import DetalleApartado from './pages/DetalleApartado';
import Entregas from './pages/Entregas';
import TandaDashboard from './pages/Tanda';
import TandaDetalle from './pages/TandaDetalle';
import TandaNueva from './pages/TandaNueva';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/nuevo" element={<NuevoApartado />} />
        <Route path="/apartado/:id" element={<DetalleApartado />} />
        <Route path="/entregas" element={<Entregas />} />
        <Route path="/tanda" element={<TandaDashboard />} />
        <Route path="/tanda/nueva" element={<TandaNueva />} />
        <Route path="/tanda/:id" element={<TandaDetalle />} />
      </Routes>
    </BrowserRouter>
  );
}
