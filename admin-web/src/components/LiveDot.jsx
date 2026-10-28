// Punto con una onda que se expande y se desvanece en loop: la señal visual
// de "esto se está actualizando en vivo".
export default function LiveDot({ color = '#c3f400', size = 'md' }) {
  const dim = size === 'sm' ? 'h-1.5 w-1.5' : size === 'lg' ? 'h-3 w-3' : 'h-2 w-2';
  return (
    // transform-gpu: el punto y su onda en una capa propia que se mueve junto
    // con lo de alrededor al scrollear (si no, quedaban corridos un instante).
    <span className={`relative flex shrink-0 transform-gpu ${dim}`}>
      <span
        className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
        style={{ backgroundColor: color }}
      />
      <span
        className={`relative inline-flex rounded-full ${dim}`}
        style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
      />
    </span>
  );
}
