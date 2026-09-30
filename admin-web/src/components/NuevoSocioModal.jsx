import { useState } from 'react';
import { createSocio } from '../services/sociosService';
import { avisarGuardado, avisarError } from '../utils/avisos';
import { inputAFecha, fechaAInput, hoySinHora, sumarMeses } from '../utils/fechas';
import Modal from './Modal';

function Campo({ label, children }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

// Alta de socio. Va a Firestore y a la fila nueva del Excel en el mismo
// paso, con el nombre completo y el vencimiento que espera la planilla.
export default function NuevoSocioModal({ dniInicial = '', onClose, onCreated }) {
  const [dni, setDni]           = useState(dniInicial);
  const [nombre, setNombre]     = useState('');
  const [apellido, setApellido] = useState('');
  // Por defecto un mes desde hoy: sin fecha, el control de acceso lo dejaría
  // pasar como "al día" para siempre.
  const [vencimiento, setVencimiento] = useState(fechaAInput(sumarMeses(hoySinHora(), 1)));
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!dni.trim() || !nombre.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const { id, excel } = await createSocio(dni, {
        nombre: `${nombre} ${apellido}`.trim(),
        fechaVencimiento: inputAFecha(vencimiento),
      });
      avisarGuardado('Socio creado', excel);
      onCreated(id);
    } catch (err) {
      if (err.message?.startsWith('Ya existe')) setError(err.message);
      else avisarError('No se pudo crear el socio', err);
      setSaving(false);
    }
  }

  return (
    <Modal title="Nuevo socio" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Campo label="DNI">
          <input
            value={dni}
            onChange={(e) => setDni(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            required
            autoFocus={!dniInicial}
            className="input num"
          />
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Nombre">
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} required autoFocus={!!dniInicial} className="input" />
          </Campo>
          <Campo label="Apellido">
            <input value={apellido} onChange={(e) => setApellido(e.target.value)} className="input" />
          </Campo>
        </div>
        <Campo label="Vencimiento de cuota">
          <input type="date" value={vencimiento} onChange={(e) => setVencimiento(e.target.value)} className="input num" />
        </Campo>

        {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}

        <p className="text-xs text-textTertiary">
          Se agrega también como fila nueva en el Excel.
        </p>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Creando...' : 'Crear socio'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
