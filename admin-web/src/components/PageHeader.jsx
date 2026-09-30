export default function PageHeader({ title, description, children }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 pb-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-text">{title}</h1>
        {description && <p className="mt-1 text-sm text-textSecondary">{description}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
