import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import NuevoApartado from './pages/NuevoApartado';
import DetalleApartado from './pages/DetalleApartado';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/nuevo" element={<NuevoApartado />} />
        <Route path="/apartado/:id" element={<DetalleApartado />} />
      </Routes>
    </BrowserRouter>
  );
}
