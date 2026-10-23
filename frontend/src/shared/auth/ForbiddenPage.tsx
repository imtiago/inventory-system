export function ForbiddenPage() {
  return (
    <div role="alert" className="flex flex-col items-center gap-2 py-16 text-center">
      <h1 className="text-2xl font-semibold">403</h1>
      <p className="text-slate-600">Você não tem acesso a esta página.</p>
    </div>
  );
}
