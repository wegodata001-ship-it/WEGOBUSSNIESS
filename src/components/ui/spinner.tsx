export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-slate-500">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[var(--brand-primary)]" />
      {label ? <p className="text-sm">{label}</p> : null}
    </div>
  );
}
