/*
 * Pie común a todas las páginas. Es un componente de servidor: el año se
 * calcula al generar la página, sin JavaScript en el cliente.
 */
export function AppFooter() {
  const anio = new Date().getFullYear();

  return (
    <footer className="border-t border-line bg-card/85">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-1 px-4 py-4 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>© {anio} Campus Alertas</p>
        <p>Universidad de Ciencias y Humanidades · Lima, Perú</p>
      </div>
    </footer>
  );
}
