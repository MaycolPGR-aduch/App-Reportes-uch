import { ReportForm } from "@/components/report-form";

export default function ReportPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <section className="rounded-3xl border border-white/60 bg-white/75 p-6 shadow-sm">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-emerald-700">
          Campus Alertas
        </p>
        <h1 className="mt-2 font-heading text-3xl font-bold text-emerald-950 sm:text-4xl">
          Reporta en menos de 30 segundos
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-600 sm:text-base">
          Cuéntanos qué ocurrió, adjunta una foto y confirma la ubicación. Revisaremos el reporte
          para que pueda ser atendido por el área correspondiente.
        </p>
      </section>
      <ReportForm />
    </main>
  );
}
