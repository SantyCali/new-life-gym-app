import PageHeader from './PageHeader';
import Icon from './Icon';

// Placeholder para secciones cuya funcionalidad todavía no fue confirmada
// contra el sistema de referencia (Caja, Reportes, Configuración). Deja la
// ruta y el ítem de navegación preparados sin inventar comportamiento.
export default function ComingSoon({ title }) {
  return (
    <div>
      <PageHeader title={title} />
      <div className="card flex flex-col items-center justify-center border-dashed px-6 py-16 text-center">
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-surfaceHigh text-textTertiary">
          <Icon name="schedule" className="text-2xl" />
        </span>
        <p className="font-display text-base font-bold text-text">Sección en preparación</p>
        <p className="mt-1 max-w-sm text-sm text-textSecondary">
          Todavía no está implementada. Se incorporará más adelante.
        </p>
      </div>
    </div>
  );
}
