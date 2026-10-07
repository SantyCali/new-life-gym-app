import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { SociosProvider } from './context/SociosContext';
import { IngresosProvider } from './context/IngresosContext';
import { AvisosProvider } from './context/AvisosContext';
import EnSalaPage from './pages/EnSalaPage';
import ProtectedRoute from './components/ProtectedRoute';
import ComingSoon from './components/ComingSoon';
import AdminLayout from './layout/AdminLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import SociosPage from './pages/SociosPage';
import SocioDetailPage from './pages/SocioDetailPage';
import PlanesPage from './pages/PlanesPage';
import RutinaSocioPage from './pages/RutinaSocioPage';
import RutinasPage from './pages/RutinasPage';
import RutinaImprimirPage from './pages/RutinaImprimirPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          {/* Hoja para imprimir: sin el menú del panel. */}
          <Route path="/socios/:dni/rutina/imprimir" element={<ProtectedRoute><RutinaImprimirPage /></ProtectedRoute>} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <SociosProvider>
                  <IngresosProvider>
                    <AvisosProvider>
                      <AdminLayout />
                    </AvisosProvider>
                  </IngresosProvider>
                </SociosProvider>
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="socios" element={<SociosPage />} />
            <Route path="socios/:dni" element={<SocioDetailPage />} />
            <Route path="socios/:dni/rutina" element={<RutinaSocioPage />} />
            <Route path="planes" element={<PlanesPage />} />
            <Route path="rutinas" element={<RutinasPage />} />
            <Route path="en-sala" element={<EnSalaPage />} />
            <Route path="caja" element={<ComingSoon title="Caja" />} />
            <Route path="reportes" element={<ComingSoon title="Reportes" />} />
            <Route path="configuracion" element={<ComingSoon title="Configuración" />} />
            <Route path="usuarios" element={<ComingSoon title="Usuarios" />} />
            <Route path="compras-ventas" element={<ComingSoon title="Compras / Ventas" />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
