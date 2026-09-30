import { toImageSrc } from '../utils/image';

const SIZES = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-16 w-16 text-lg',
};

// El nombre suele venir completo en un solo campo ("Santiago Calivares"):
// se toma la inicial de la primera y la última palabra.
export function iniciales(nombre = '', apellido = '') {
  const palabras = `${nombre} ${apellido}`.trim().split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return '?';
  const primera = palabras[0][0];
  const ultima = palabras.length > 1 ? palabras[palabras.length - 1][0] : '';
  return (primera + ultima).toUpperCase();
}

export default function Avatar({ nombre, apellido, foto, size = 'md' }) {
  const src = toImageSrc(foto);
  if (src) {
    return (
      <img
        src={src}
        alt={`Foto de ${nombre} ${apellido}`.trim()}
        className={`${SIZES[size]} shrink-0 rounded-full object-cover`}
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      className={`${SIZES[size]} flex shrink-0 items-center justify-center rounded-full bg-surfaceHighest font-display font-bold text-cyan`}
    >
      {iniciales(nombre, apellido)}
    </div>
  );
}
