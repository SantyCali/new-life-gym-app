// Cartelito "¡Nuevo!" titilando suave (igual al del botón de Rutina). Se
// muestra solo mientras `mostrar` sea true (ver utils/novedades.js: se van
// solos).
//   - En la esquina de un botón (el botón tiene que tener `relative`).
//   - enLinea: al lado del texto, para botones o textos chicos donde en la
//     esquina taparía lo que dice.
export default function NuevoBadge({ mostrar = true, enLinea = false }) {
  if (!mostrar) return null;
  return (
    <span className={enLinea ? 'pointer-events-none relative ml-1.5 inline-flex align-middle' : 'pointer-events-none absolute -right-2 -top-2.5 z-10 flex'}>
      <span className="absolute inline-flex h-full w-full ping-suave rounded-full bg-cyan" />
      <span className="relative rounded-full bg-cyan px-1.5 py-0.5 font-display text-[0.625rem] font-extrabold uppercase leading-none tracking-caps text-onAccent shadow-lg">
        ¡Nuevo!
      </span>
    </span>
  );
}
