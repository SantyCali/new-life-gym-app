// Material Symbols: el nombre del ícono va como contenido de texto y la
// ligadura de la fuente lo convierte en glifo.
export default function Icon({ name, className = 'text-lg' }) {
  return (
    <span aria-hidden="true" className={`icon ${className}`}>
      {name}
    </span>
  );
}
