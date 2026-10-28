import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import FichaMedica from '../fichas/FichaMedica';
import { getSocioByDni } from '../services/sociosService';
import { getUserByDni } from '../services/usersService';
import '../rutinas/planilla.css';

// Ficha médica para imprimir. Con DNI (/socios/:dni/ficha-medica) sale con
// los datos que ya se saben del socio; sin DNI (/ficha-medica) sale en blanco.
// El año de validez lo elige el entrenador acá arriba y queda guardado para
// todos en config/fichaMedica (las reglas de config ya dejan escribir a los
// entrenadores).
const CONFIG = doc(db, 'config', 'fichaMedica');

// "03/01/2001" → 25 (años cumplidos hoy).
function edadDe(fecha) {
  const m = String(fecha ?? '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return '';
  const nac = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  const hoy = new Date();
  let edad = hoy.getFullYear() - nac.getFullYear();
  if (hoy < new Date(hoy.getFullYear(), nac.getMonth(), nac.getDate())) edad -= 1;
  return edad > 0 && edad < 120 ? String(edad) : '';
}

function datosDelSocio(socio, cuenta) {
  const nombre = [socio?.nombre, socio?.apellido].filter(Boolean).join(' ')
    || [cuenta?.nombre, cuenta?.apellido].filter(Boolean).join(' ');
  const sexo = /^m/i.test(cuenta?.sexo ?? '') ? 'M' : /^f/i.test(cuenta?.sexo ?? '') ? 'F' : null;
  return {
    nombre,
    dni: socio?.dni ?? cuenta?.dni ?? '',
    nacimiento: cuenta?.fechaNacimiento ?? '',
    edad: edadDe(cuenta?.fechaNacimiento),
    sexo,
    altura: cuenta?.altura ? `${cuenta.altura} cm` : '',
    direccion: socio?.direccion ?? '',
    localidad: socio?.localidad ?? '',
    email: socio?.email || cuenta?.email || '',
    celular: socio?.telefono ?? '',
    aclaracion: nombre,
  };
}

export default function FichaMedicaPage() {
  const { dni } = useParams();
  const [anio, setAnio] = useState(String(new Date().getFullYear()));
  const [guardado, setGuardado] = useState('');
  const [datos, setDatos] = useState(dni ? null : {});
  const [conDatos, setConDatos] = useState(true);
  const timer = useRef(null);

  useEffect(() => {
    getDoc(CONFIG).then((s) => { if (s.exists() && s.data().anio) setAnio(String(s.data().anio)); }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!dni) { document.title = 'Ficha médica'; return; }
    Promise.all([getSocioByDni(dni).catch(() => null), getUserByDni(dni).catch(() => null)]).then(([s, c]) => {
      const d = datosDelSocio(s, c);
      setDatos(d);
      document.title = `Ficha médica - ${d.nombre || dni}`;
    });
  }, [dni]);

  // Guarda el año para todos (un ratito después de escribir).
  function cambiarAnio(v) {
    const limpio = v.replace(/\D/g, '').slice(0, 4);
    setAnio(limpio);
    setGuardado('');
    clearTimeout(timer.current);
    if (limpio.length !== 4) return;
    timer.current = setTimeout(() => {
      setDoc(CONFIG, { anio: Number(limpio) }, { merge: true })
        .then(() => setGuardado('Guardado para todos'))
        .catch(() => setGuardado('No se pudo guardar'));
    }, 600);
  }

  if (!datos) return <p style={{ padding: 24, color: '#fff' }}>Cargando…</p>;

  return (
    <div className="planilla-pantalla">
      <div className="planilla-barra">
        <label style={{ color: '#cbd2dd', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          Validez por el año
          <input
            value={anio}
            onChange={(e) => cambiarAnio(e.target.value)}
            inputMode="numeric"
            className="input"
            style={{ width: 80, padding: '6px 8px', textAlign: 'center' }}
          />
        </label>
        {guardado && <span style={{ color: '#9aa3b2', fontSize: 12 }}>{guardado}</span>}
        {dni && (
          <label style={{ color: '#cbd2dd', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
            <input type="checkbox" checked={conDatos} onChange={(e) => setConDatos(e.target.checked)} />
            Con los datos del socio
          </label>
        )}
        <button className="btn-primary" onClick={() => window.print()}>Imprimir</button>
        <button className="btn-ghost" onClick={() => window.close()}>Cerrar</button>
        <span style={{ color: '#9aa3b2', fontSize: 12, marginLeft: 8 }}>
          Tocá cualquier renglón para escribir o corregir, y los círculos para marcarlos. Papel A4, sin márgenes.
        </span>
      </div>
      {/* key: al cambiar "con datos / en blanco" la hoja arranca de cero. */}
      <FichaMedica key={conDatos ? 'con' : 'sin'} datos={conDatos ? datos : {}} anio={anio || '____'} />
    </div>
  );
}
