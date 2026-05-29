import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, Download } from "lucide-react";
import db from "../lib/db";

const DAYS = ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5"];

export default function FestivalReport() {
  const [bars, setBars] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([db.Bar.list(), db.StockReport.list("-created_date", 500)])
      .then(([b, r]) => { setBars(b); setReports(r); setLoading(false); });
  }, []);

  const computeConsumed = (barId, day) => {
    const dayReports = reports.filter(r => r.bar_id === barId && r.festival_day === day);
    const opening = dayReports.find(r => r.report_type === "opening");
    const deliveries = dayReports.filter(r => r.report_type === "delivery");
    const closing = dayReports.find(r => r.report_type === "closing");
    const allProducts = [...new Set([...(opening?.items||[]), ...deliveries.flatMap(d=>d.items||[]), ...(closing?.items||[])].map(i=>i.product_name))].filter(Boolean);
    return allProducts.map(name => {
      const openQty = (opening?.items||[]).find(i=>i.product_name===name)?.quantity ?? null;
      const delivQty = deliveries.reduce((s,d) => { const f=(d.items||[]).find(i=>i.product_name===name); return s+(f?Number(f.quantity)||0:0); }, 0);
      const closeQty = (closing?.items||[]).find(i=>i.product_name===name)?.quantity ?? null;
      const unit = [...(opening?.items||[]), ...(closing?.items||[])].find(i=>i.product_name===name)?.unit || "";
      let consumed = null;
      if (openQty !== null && closeQty !== null) consumed = (Number(openQty) + delivQty) - Number(closeQty);
      return { name, openQty, delivQty, closeQty, consumed, unit };
    });
  };

  // Aggregate totals across all bars and days
  const productTotals = {};
  bars.forEach(bar => {
    DAYS.forEach(day => {
      computeConsumed(bar.id, day).forEach(row => {
        if (row.consumed !== null) {
          if (!productTotals[row.name]) productTotals[row.name] = { consumed: 0, unit: row.unit };
          productTotals[row.name].consumed += row.consumed;
        }
      });
    });
  });

  const barDayData = bars.map(bar => ({
    bar,
    days: DAYS.map(day => {
      const rows = computeConsumed(bar.id, day);
      const hasData = reports.some(r => r.bar_id === bar.id && r.festival_day === day);
      return { day, rows, hasData };
    })
  }));

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <Link to="/Dashboard" className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-700 transition-colors mb-8 print:hidden">
          <ChevronLeft className="w-4 h-4" /> Voltar
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-neutral-900">Relatório Final do Festival</h1>
            <p className="text-neutral-400 mt-1">Resumo completo de stock em todos os bares e dias</p>
          </div>
          <button onClick={() => window.print()}
            className="print:hidden inline-flex items-center gap-2 px-4 py-2.5 bg-neutral-900 text-white rounded-xl text-sm font-medium hover:bg-neutral-700 transition-colors">
            <Download className="w-4 h-4" /> Imprimir / Exportar
          </button>
        </div>

        {loading ? (
          <div className="text-center py-20 text-neutral-300">A carregar...</div>
        ) : (
          <>
            <section className="mb-10">
              <h2 className="text-lg font-bold text-neutral-800 mb-4">Consumo Total (Todos os Bares · Todos os Dias)</h2>
              <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50">
                    <tr>
                      <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">Produto</th>
                      <th className="text-center px-6 py-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">Total Consumido</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">Unid.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {Object.entries(productTotals).length === 0 ? (
                      <tr><td colSpan={3} className="px-6 py-8 text-center text-neutral-300">Sem dados disponíveis</td></tr>
                    ) : Object.entries(productTotals).map(([name, { consumed, unit }]) => (
                      <tr key={name} className="hover:bg-neutral-50">
                        <td className="px-6 py-3 font-medium text-neutral-800">{name}</td>
                        <td className="px-6 py-3 text-center font-bold text-neutral-900">{consumed}</td>
                        <td className="px-6 py-3 text-neutral-400 text-xs">{unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-neutral-800 mb-4">Detalhe por Bar</h2>
              <div className="space-y-8">
                {barDayData.map(({ bar, days }) => (
                  <div key={bar.id} className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-neutral-100 bg-neutral-50">
                      <div className="font-bold text-neutral-900">{bar.name}</div>
                      {bar.leader_name && <div className="text-xs text-neutral-400">Responsável: {bar.leader_name}</div>}
                    </div>
                    {days.map(({ day, rows, hasData }) => (
                      hasData && rows.length > 0 ? (
                        <div key={day}>
                          <div className="px-6 py-2 bg-neutral-50 border-t border-neutral-100">
                            <span className="text-xs font-semibold uppercase tracking-widest text-neutral-500">{day}</span>
                          </div>
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-t border-neutral-50">
                                <th className="text-left px-6 py-2 text-xs font-semibold text-neutral-400">Produto</th>
                                <th className="text-center px-4 py-2 text-xs font-semibold text-blue-400">Abertura</th>
                                <th className="text-center px-4 py-2 text-xs font-semibold text-amber-400">Entrega</th>
                                <th className="text-center px-4 py-2 text-xs font-semibold text-emerald-400">Fecho</th>
                                <th className="text-center px-4 py-2 text-xs font-semibold text-neutral-400">Consumido</th>
                                <th className="text-left px-4 py-2 text-xs font-semibold text-neutral-400">Unid.</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-50">
                              {rows.map(row => (
                                <tr key={row.name} className="hover:bg-neutral-50">
                                  <td className="px-6 py-2.5 font-medium text-neutral-800">{row.name}</td>
                                  <td className="px-4 py-2.5 text-center text-neutral-600">{row.openQty ?? "-"}</td>
                                  <td className="px-4 py-2.5 text-center text-neutral-600">{row.delivQty > 0 ? row.delivQty : "-"}</td>
                                  <td className="px-4 py-2.5 text-center text-neutral-600">{row.closeQty ?? "-"}</td>
                                  <td className="px-4 py-2.5 text-center font-semibold text-neutral-900">{row.consumed ?? "-"}</td>
                                  <td className="px-4 py-2.5 text-neutral-400 text-xs">{row.unit}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : null
                    ))}
                    {days.every(d => !d.hasData) && (
                      <div className="px-6 py-6 text-center text-sm text-neutral-300">Sem relatórios submetidos para este bar</div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
