import { ReportForm } from "@/components/report-form";

export default function ReportPage() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <section className="rounded-3xl border border-white/60 bg-white/75 p-6 shadow-sm">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-emerald-700">
          Campus Incident MVP
        </p>
        <h1 className="mt-2 font-heading text-3xl font-bold text-emerald-950 sm:text-4xl">
          Reporta en menos de 30 segundos
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-slate-600 sm:text-base">
          Captura evidencia, GPS y una descripcion corta desde tu navegador. El backend procesa
          la incidencia, estima prioridad con IA y notifica por correo segun reglas de atencion.
        </p>
      </section>
      <ReportForm />
    </main>
  );
}

