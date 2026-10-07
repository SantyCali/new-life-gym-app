const VARIANTS = {
  success: { chip: 'bg-accent/10 text-accent',   dot: 'bg-accent' },
  warning: { chip: 'bg-cyan/10 text-cyan',       dot: 'bg-cyan' },
  danger:  { chip: 'bg-danger/10 text-danger',   dot: 'bg-danger' },
  hoy:     { chip: 'bg-[#ff9f1a]/15 text-[#ff9f1a] ring-1 ring-[#ff9f1a]/40', dot: 'bg-[#ff9f1a] animate-pulse' },
  neutral: { chip: 'bg-surfaceHigh text-textSecondary', dot: 'bg-textTertiary' },
};

// El punto acompaña al color para que el estado no dependa solo del tono
// (daltonismo, monitores mal calibrados).
export default function Badge({ variant = 'neutral', children }) {
  const style = VARIANTS[variant];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-display text-[0.6875rem] font-bold uppercase tracking-caps ${style.chip}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {children}
    </span>
  );
}
