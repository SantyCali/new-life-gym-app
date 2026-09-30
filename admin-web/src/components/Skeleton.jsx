export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded bg-surfaceHigh ${className}`} />;
}

// Reserva el alto exacto de las filas reales para que la tabla no salte
// cuando termina de cargar.
export function SkeletonRows({ rows = 6, cols = 5 }) {
  return Array.from({ length: rows }, (_, r) => (
    <tr key={r} className="border-t border-border">
      {Array.from({ length: cols }, (_, c) => (
        <td key={c} className="px-4 py-3">
          <Skeleton className={`h-4 ${c === 1 ? 'w-40' : 'w-20'}`} />
        </td>
      ))}
    </tr>
  ));
}
