import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import PlanillaRutina from '../rutinas/PlanillaRutina';
import { descargarExcel } from '../rutinas/excel';
import { getSocioByDni } from '../services/sociosService';
import { getUserByDni } from '../services/usersService';
import { cargarRutina } from '../services/rutinasService';

// La planilla del gimnasio completa con la rutina del socio, para imprimir
// (o "Guardar como PDF" desde el cuadro de impresión). Se abre en una pestaña
// aparte desde el editor de rutina; con ?auto=1 abre el cuadro de impresión solo.
export default function RutinaImprimirPage() {
  const { dni } = useParams();
  const [params] = useSearchParams();
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(false);
  const impreso = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const [socio, cuenta] = await Promise.all([getSocioByDni(dni).catch(() => null), getUserByDni(dni).catch(() => null)]);
        const rutina = await cargarRutina({ dni, uid: cuenta?.uid });
        const nombre = [socio?.nombre, socio?.apellido].filter(Boolean).join(' ')
          || [cuenta?.nombre, cuenta?.apellido].filter(Boolean).join(' ');
        setDatos({ rutina, nombre });
        document.title = `Rutina - ${nombre || dni}`;
      } catch (e) {
        console.error('[admin-web] imprimir rutina:', e);
        setError(true);
      }
    })();
  }, [dni]);

  // Imprimir solo cuando ya cargaron las letras y las imágenes.
  useEffect(() => {
    if (!datos?.rutina || params.get('auto') !== '1' || impreso.current) return;
    impreso.current = true;
    const imgs = [...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = r; i.onerror = r; })));
    Promise.all([document.fonts?.ready, ...imgs]).then(() => setTimeout(() => window.print(), 150));
  }, [datos, params]);

  if (error) return <p style={{ padding: 24, color: '#fff' }}>No se pudo cargar la rutina.</p>;
  if (!datos) return <p style={{ padding: 24, color: '#fff' }}>Cargando…</p>;
  if (!datos.rutina) return <p style={{ padding: 24, color: '#fff' }}>Este socio todavía no tiene rutina.</p>;

  return (
    <div className="planilla-pantalla">
      <div className="planilla-barra">
        <button className="btn-primary" onClick={() => window.print()}>Imprimir</button>
        <button className="btn-outline" onClick={() => descargarExcel({ rutina: datos.rutina, nombreSocio: datos.nombre })}>Descargar Excel</button>
        <button className="btn-ghost" onClick={() => window.close()}>Cerrar</button>
        <span style={{ color: '#9aa3b2', fontSize: 12, marginLeft: 8 }}>
          Para PDF: en el cuadro de impresión elegí “Guardar como PDF”. Usá papel A4 y sin márgenes.
        </span>
      </div>
      <PlanillaRutina rutina={datos.rutina} nombreSocio={datos.nombre} />
    </div>
  );
}
