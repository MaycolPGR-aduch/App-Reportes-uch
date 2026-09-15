import { ReportForm } from "@/components/report-form";

export default function ReportPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-8 sm:px-6">
      <header>
        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-brand-text">
          Campus Alertas
        </p>
        <h1 className="mt-1.5 font-display text-3xl font-bold sm:text-4xl">
          Reporta en menos de 30 segundos
        </h1>
        <p className="mt-2.5 max-w-2xl text-sm text-muted sm:text-base">
          Cuéntanos qué ocurrió, adjunta una foto y confirma la ubicación. Revisaremos el reporte
          para que pueda ser atendido por el área correspondiente.
        </p>
      </header>
      <ReportForm />
    </main>
  );
}
