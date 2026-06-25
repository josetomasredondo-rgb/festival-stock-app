import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, Download, TrendingUp } from "lucide-react";
import db, { getFestivalBars } from "../lib/db";
import { useAuth } from "../lib/AuthContext";

const CHARTJS_CDN = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js";

function useChartJS() {
  const [ready, setReady] = useState(typeof window !== "undefined" && !!window.Chart);
  useEffect(() => {
    if (window.Chart) { setReady(true); return; }
    const existing = document.querySelector("[data-chartjs]");
    if (existing) {
      const t = setInterval(() => { if (window.Chart) { setReady(true); clearInterval(t); } }, 50);
      return () => clearInterval(t);
    }
    const s = document.createElement("script");
    s.src = CHARTJS_CDN;
    s.setAttribute("data-chartjs", "1");
    s.onload = () => setReady(true);
    document.head.appendChild(s);
  }, []);
  return ready;
}

function computeStats(reports, movements, bars, dayNames) {
  const productMap = {};
  const dayTotals = {};
  const barTotals = {};

  dayNames.forEach(d => { dayTotals[d] = 0; });
  bars.forEach(b => { barTotals[b.id] = { name: b.name, consumed: 0 }; });

  bars.forEach(bar => {
    dayNames.forEach(day => {
      const dr = reports.filter(r => r.bar_id === bar.id && r.festival_day === day);
      const opening = dr.find(r => r.report_type === "opening");
      const closing = dr.find(r => r.report_type === "closing");
      if (!opening || !closing) return;

      const delivs = dr.filter(r => ["delivery", "night_delivery"].includes(r.report_type));
      const dm = movements.filter(m => m.festival_day === day);
      const inMov = dm.filter(m => m.destination_type === "bar" && m.destination_id === bar.id);
      const outMov = dm.filter(m => m.origin_type === "bar" && m.origin_id === bar.id);

      const names = [...new Set([
        ...(opening.items || []).map(i => i.product_name),
        ...(closing.items || []).map(i => i.product_name),
      ])].filter(Boolean);

      names.forEach(name => {
        const oQty = Number((opening.items || []).find(i => i.product_name === name)?.quantity);
        const cQty = Number((closing.items || []).find(i => i.product_name === name)?.quantity);
        if (isNaN(oQty) || isNaN(cQty)) return;

        const unit = (opening.items || []).find(i => i.product_name === name)?.unit || "";
        const dQty = delivs.reduce((s, d) => s + (Number((d.items || []).find(i => i.product_name === name)?.quantity) || 0), 0);
        const iQty = inMov.reduce((s, m) => s + (Number((m.items || []).find(i => i.product_name === name)?.quantity) || 0), 0);
        const eQty = outMov.reduce((s, m) => s + (Number((m.items || []).find(i => i.product_name === name)?.quantity) || 0), 0);

        const consumed = oQty + dQty + iQty - eQty - cQty;
        if (consumed <= 0) return;

        if (!productMap[name]) productMap[name] = { consumed: 0, unit };
        productMap[name].consumed += consumed;
        dayTotals[day] = (dayTotals[day] || 0) + consumed;
        if (barTotals[bar.id]) barTotals[bar.id].consumed += consumed;
      });
    });

    // Waste: final closing per bar (last day with a closing report)
    const lastDay = [...dayNames].reverse().find(day =>
      reports.some(r => r.bar_id === bar.id && r.festival_day === day && r.report_type === "closing")
    );
    if (!lastDay) return;
    const lc = reports.find(r => r.bar_id === bar.id && r.festival_day === lastDay && r.report_type === "closing");
    (lc?.items || []).forEach(item => {
      if (!productMap[item.product_name]) return;
      if (!productMap[item.product_name].waste) productMap[item.product_name].waste = 0;
      productMap[item.product_name].waste += Number(item.quantity) || 0;
    });
  });

  const totalConsumed = Object.values(productMap).reduce((s, p) => s + p.consumed, 0);
  const topProduct = Object.entries(productMap).sort((a, b) => b[1].consumed - a[1].consumed)[0];
  const topBar = Object.values(barTotals).sort((a, b) => b.consumed - a.consumed)[0];

  return { productMap, dayTotals, barTotals, totalConsumed, topProduct, topBar };
}

const TABS = [
  { key: "resumo", label: "Resumo" },
  { key: "por_produto", label: "Por produto" },
  { key: "por_bar", label: "Por bar" },
  { key: "comparar", label: "Comparar festivais" },
];

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-white rounded-2xl border border-neutral-100 p-5 shadow-sm">
      <div className="text-xl font-bold text-neutral-900 truncate">{value}</div>
      {sub && <div className="text-sm text-neutral-500 mt-0.5">{sub}</div>}
      <div className="text-xs text-neutral-400 mt-2">{label}</div>
    </div>
  );
}

function ComingSoon({ label }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center mb-4">
        <TrendingUp className="w-6 h-6 text-neutral-300" />
      </div>
      <div className="font-semibold text-neutral-500">{label} — em breve</div>
      <div className="text-sm text-neutral-400 mt-1">Esta secção está a ser desenvolvida</div>
    </div>
  );
}

export default function Analytics() {
  const chartJSReady = useChartJS();

  const [festivals, setFestivals] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [bars, setBars] = useState([]);
  const [reports, setReports] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("resumo");

  const dayCanvasRef = useRef(null);
  const barCanvasRef = useRef(null);
  const dayChartInst = useRef(null);
  const barChartInst = useRef(null);

  useEffect(() => {
    db.Festival.list().then(fs => {
      setFestivals(fs);
      if (fs.length) setSelectedId(fs[0].id);
    });
  }, []);

  const selectedFestival = festivals.find(f => f.id === selectedId);

  useEffect(() => {
    if (!selectedId || !selectedFestival) { setBars([]); setReports([]); setMovements([]); return; }
    setLoading(true);
    Promise.all([
      getFestivalBars(selectedFestival),
      db.StockReport.filterByFestival(selectedId),
      db.Movement.filterByFestival(selectedId),
    ]).then(([b, r, m]) => { setBars(b); setReports(r); setMovements(m); setLoading(false); });
  }, [selectedId]);

  const dayNames = selectedFestival?.day_names?.length
    ? selectedFestival.day_names
    : Array.from({ length: selectedFestival?.num_days || 1 }, (_, i) => `Dia ${i + 1}`);

  const stats = (!loading && reports.length > 0)
    ? computeStats(reports, movements, bars, dayNames)
    : null;

  useLayoutEffect(() => {
    if (!chartJSReady || !stats || tab !== "resumo") return;
    const Chart = window.Chart;

    if (dayChartInst.current) { dayChartInst.current.destroy(); dayChartInst.current = null; }
    if (barChartInst.current) { barChartInst.current.destroy(); barChartInst.current = null; }

    if (dayCanvasRef.current) {
      dayChartInst.current = new Chart(dayCanvasRef.current, {
        type: "bar",
        data: {
          labels: dayNames,
          datasets: [{ label: "Consumo", data: dayNames.map(d => stats.dayTotals[d] || 0), backgroundColor: "#1D9E75", borderRadius: 6 }]
        },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
      });
    }

    if (barCanvasRef.current) {
      const total = stats.totalConsumed || 1;
      const entries = Object.values(stats.barTotals).sort((a, b) => b.consumed - a.consumed);
      barChartInst.current = new Chart(barCanvasRef.current, {
        type: "bar",
        data: {
          labels: entries.map(e => e.name),
          datasets: [{ label: "%", data: entries.map(e => Math.round((e.consumed / total) * 100)), backgroundColor: "#7F77DD", borderRadius: 6 }]
        },
        options: {
          indexAxis: "y",
          responsive: true,
          plugins: { legend: { display: false } },
          scales: { x: { beginAtZero: true, max: 100, ticks: { callback: v => v + "%" } } }
        }
      });
    }

    return () => {
      if (dayChartInst.current) { dayChartInst.current.destroy(); dayChartInst.current = null; }
      if (barChartInst.current) { barChartInst.current.destroy(); barChartInst.current = null; }
    };
  }, [chartJSReady, stats, tab]);

  const wasteRows = stats ? Object.entries(stats.productMap)
    .sort((a, b) => b[1].consumed - a[1].consumed)
    .map(([name, { consumed, unit, waste = 0 }]) => {
      const total = consumed + waste;
      const pct = total > 0 ? Math.round((waste / total) * 100) : 0;
      const badge = pct < 5 ? "Bom" : pct <= 15 ? "Médio" : "Alto";
      const color = pct < 5 ? "bg-emerald-100 text-emerald-700" : pct <= 15 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700";
      return { name, consumed, waste, pct, badge, color, unit };
    }) : [];

  const barPerfRows = bars.map(bar => {
    const expected = dayNames.length * 2;
    const actual = reports.filter(r => r.bar_id === bar.id && ["opening", "closing"].includes(r.report_type)).length;
    const pct = expected > 0 ? Math.round((actual / expected) * 100) : 0;
    const badge = pct >= 90 ? "Excelente" : pct >= 70 ? "Médio" : "Melhorar";
    const color = pct >= 90 ? "bg-emerald-100 text-emerald-700" : pct >= 70 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700";
    return { bar, actual, expected, pct, badge, color };
  });

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <Link to="/Dashboard" className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-700 transition-colors mb-8 print:hidden">
          <ChevronLeft className="w-4 h-4" /> Voltar
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-neutral-900">Análise</h1>
            <p className="text-neutral-400 mt-1">Consumo e desempenho por festival</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
              className="border border-neutral-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 min-w-[200px]">
              <option value="">Selecionar festival...</option>
              {festivals.map(f => <option key={f.id} value={f.id}>{f.name}{f.is_closed ? " (fechado)" : ""}</option>)}
            </select>
            <button onClick={() => window.print()}
              className="print:hidden flex items-center gap-2 px-4 py-2.5 bg-neutral-900 text-white rounded-xl text-sm font-medium hover:bg-neutral-700 transition-colors">
              <Download className="w-4 h-4" /> Exportar
            </button>
          </div>
        </div>

        <div className="flex gap-2 mb-6 flex-wrap print:hidden">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-5 py-2 rounded-xl text-sm font-medium transition-all ${tab === t.key ? "bg-neutral-900 text-white" : "bg-white border border-neutral-200 text-neutral-600 hover:border-neutral-400"}`}>
              {t.label}
            </button>
          ))}
        </div>

        {!selectedId ? (
          <div className="text-center py-20 text-neutral-400 text-sm">Seleciona um festival para ver a análise</div>
        ) : loading ? (
          <div className="text-center py-20 text-neutral-300 text-sm">A carregar...</div>
        ) : (
          <>
            {tab === "resumo" && (
              <div className="space-y-8">
                {stats ? (
                  <div className="grid grid-cols-3 gap-4">
                    <StatCard label="Total consumido" value={stats.totalConsumed} />
                    <StatCard label="Produto mais consumido"
                      value={stats.topProduct?.[0] || "—"}
                      sub={stats.topProduct ? `${stats.topProduct[1].consumed} ${stats.topProduct[1].unit}` : undefined} />
                    <StatCard label="Bar mais ativo"
                      value={stats.topBar?.name || "—"}
                      sub={stats.topBar && stats.totalConsumed > 0
                        ? `${Math.round((stats.topBar.consumed / stats.totalConsumed) * 100)}% do consumo total`
                        : undefined} />
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-neutral-100 p-8 text-center text-neutral-400 text-sm">
                    Sem dados suficientes. Submete relatórios de abertura e fecho para ver a análise.
                  </div>
                )}

                {stats && (
                  <div className="grid grid-cols-2 gap-6">
                    <div className="bg-white rounded-2xl border border-neutral-100 p-5 shadow-sm">
                      <h3 className="text-sm font-semibold text-neutral-700 mb-4">Consumo por dia</h3>
                      <canvas ref={dayCanvasRef} />
                    </div>
                    <div className="bg-white rounded-2xl border border-neutral-100 p-5 shadow-sm">
                      <h3 className="text-sm font-semibold text-neutral-700 mb-4">Consumo por bar (%)</h3>
                      <canvas ref={barCanvasRef} />
                    </div>
                  </div>
                )}

                {wasteRows.length > 0 && (
                  <div>
                    <h2 className="text-sm font-semibold text-neutral-700 mb-3">Top Produtos — Consumo vs Desperdício</h2>
                    <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-neutral-50">
                          <tr>
                            <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">Produto</th>
                            <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">Consumido</th>
                            <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">Desperdiçado</th>
                            <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">% Desperdício</th>
                            <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-50">
                          {wasteRows.map(row => (
                            <tr key={row.name} className="hover:bg-neutral-50">
                              <td className="px-6 py-3 font-medium text-neutral-800">{row.name}</td>
                              <td className="px-4 py-3 text-center text-neutral-600">{row.consumed} {row.unit}</td>
                              <td className="px-4 py-3 text-center text-neutral-500">{row.waste} {row.unit}</td>
                              <td className="px-4 py-3 text-center text-neutral-600">{row.pct}%</td>
                              <td className="px-4 py-3 text-center">
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${row.color}`}>{row.badge}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {barPerfRows.length > 0 && (
                  <div>
                    <h2 className="text-sm font-semibold text-neutral-700 mb-3">Desempenho dos Bares</h2>
                    <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-neutral-50">
                          <tr>
                            <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">Bar</th>
                            <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">Relatórios a tempo</th>
                            <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">Score</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-50">
                          {barPerfRows.map(({ bar, actual, expected, pct, badge, color }) => (
                            <tr key={bar.id} className="hover:bg-neutral-50">
                              <td className="px-6 py-3 font-medium text-neutral-800">{bar.name}</td>
                              <td className="px-4 py-3 text-center text-neutral-600">{actual}/{expected} ({pct}%)</td>
                              <td className="px-4 py-3 text-center">
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${color}`}>{badge}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab !== "resumo" && <ComingSoon label={TABS.find(t => t.key === tab)?.label || tab} />}
          </>
        )}
      </div>
    </div>
  );
}
