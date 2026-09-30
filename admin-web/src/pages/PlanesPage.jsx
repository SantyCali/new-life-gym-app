import { useEffect, useState } from 'react';
import { getCatalogoPlanes, createPlan, updatePlan, deletePlan } from '../services/planesService';
import Modal from '../components/Modal';
import Badge from '../components/Badge';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import Icon from '../components/Icon';
import { SkeletonRows } from '../components/Skeleton';
import { Field } from './SociosPage';

export default function PlanesPage() {
  const [planes, setPlanes]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNuevo, setShowNuevo] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setPlanes(await getCatalogoPlanes());
    setLoading(false);
  }

  async function handleToggleHabilitado(plan) {
    await updatePlan(plan.id, { habilitado: !plan.habilitado });
    await load();
  }

  async function handleDelete(plan) {
    if (!confirm(`¿Eliminar el plan "${plan.nombre}" del catálogo?`)) return;
    await deletePlan(plan.id);
    await load();
  }

  return (
    <div>
      <PageHeader
        title="Planes"
        description="Catálogo de planes que se pueden asignar a los socios."
      >
        <button onClick={() => setShowNuevo(true)} className="btn-primary">
          <Icon name="add" className="text-base" />
          Nuevo plan
        </button>
      </PageHeader>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surfaceHigh text-xs uppercase tracking-wide text-textTertiary">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">Nombre</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Actividad</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Duración</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Días/mes</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Precio</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Estado</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading && <SkeletonRows rows={5} cols={7} />}
              {!loading && planes.map((p) => (
                <tr key={p.id} className="border-t border-border transition-colors duration-150 hover:bg-surfaceHigh">
                  <td className="px-4 py-2.5 font-medium text-text">{p.nombre}</td>
                  <td className="px-4 py-2.5 text-textSecondary">{p.grupoActividad || '—'}</td>
                  <td className="num px-4 py-2.5 text-right text-textSecondary">
                    {p.cantidadMeses} {p.cantidadMeses === 1 ? 'mes' : 'meses'}
                  </td>
                  <td className="num px-4 py-2.5 text-right text-textSecondary">{p.diasPorMes || '—'}</td>
                  <td className="num px-4 py-2.5 text-right font-medium text-text">
                    ${Number(p.precio).toLocaleString('es-AR')}
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={() => handleToggleHabilitado(p)}
                      className="cursor-pointer"
                      title={p.habilitado ? 'Deshabilitar plan' : 'Habilitar plan'}
                    >
                      {p.habilitado
                        ? <Badge variant="success">Habilitado</Badge>
                        : <Badge variant="neutral">Deshabilitado</Badge>}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => setEditing(p)} className="btn-ghost btn-sm">Editar</button>
                    <button onClick={() => handleDelete(p)} className="btn-danger btn-sm">Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!loading && planes.length === 0 && (
            <EmptyState
              icon={<Icon name="card_membership" className="text-xl" />}
              title="Todavía no hay planes"
              description="Creá los planes del gimnasio para poder asignárselos a los socios."
              action={
                <button onClick={() => setShowNuevo(true)} className="btn-primary btn-sm">
                  Crear el primero
                </button>
              }
            />
          )}
        </div>
      </div>

      {showNuevo && (
        <PlanFormModal onClose={() => setShowNuevo(false)} onSaved={async () => { setShowNuevo(false); await load(); }} />
      )}
      {editing && (
        <PlanFormModal
          plan={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await load(); }}
        />
      )}
    </div>
  );
}

function PlanFormModal({ plan, onClose, onSaved }) {
  const [form, setForm] = useState({
    nombre: plan?.nombre ?? '',
    grupoActividad: plan?.grupoActividad ?? '',
    cantidadMeses: plan?.cantidadMeses ?? 1,
    diasPorMes: plan?.diasPorMes ?? 0,
    precio: plan?.precio ?? 0,
  });
  const [saving, setSaving] = useState(false);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    if (plan) {
      await updatePlan(plan.id, {
        ...form,
        cantidadMeses: Number(form.cantidadMeses),
        diasPorMes: Number(form.diasPorMes),
        precio: Number(form.precio),
      });
    } else {
      await createPlan(form);
    }
    onSaved();
  }

  return (
    <Modal title={plan ? 'Editar plan' : 'Nuevo plan'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nombre">
          <input className="input" value={form.nombre} onChange={(e) => set('nombre', e.target.value)} required autoFocus />
        </Field>
        <Field label="Grupo de actividad">
          <input className="input" value={form.grupoActividad} onChange={(e) => set('grupoActividad', e.target.value)} placeholder="Ej: GIMNASIO" />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Meses">
            <input className="input num" type="number" min="1" value={form.cantidadMeses} onChange={(e) => set('cantidadMeses', e.target.value)} />
          </Field>
          <Field label="Días/mes">
            <input className="input num" type="number" min="0" value={form.diasPorMes} onChange={(e) => set('diasPorMes', e.target.value)} />
          </Field>
          <Field label="Precio">
            <input className="input num" type="number" min="0" value={form.precio} onChange={(e) => set('precio', e.target.value)} />
          </Field>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-ghost">Cancelar</button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

