import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, Download, TrendingUp } from "lucide-react";
import db, { getFestivalBars } from "../lib/db";
import { useAuth } from "../lib/AuthContext";

const CHARTJS_CDN = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js";
const COMPARE_COLORS = ["#1D9E75", "#7F77DD", "#EF9F27"];

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

// Returns per-product-per-bar-per-day breakdown plus aggregates
function computeDetailed(reports, movements, bars, dayNames) {
  // productData[name] = { unit, consumed, waste, byBar: {barId: consumed}, byDay: {day: consumed} }
  const productData = {};
  const barTotals = {};
  const dayTotals = {};

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

        if (!productData[name]) productData[name] = { unit, consumed: 0, waste: 0, byBar: {}, byDay: {} };
        productData[name].consumed += consumed;
        productData[name].byBar[bar.id] = (productData[name].byBar[bar.id] || 0) + consumed;
        productData[name].byDay[day] = (productData[name].byDay[day] || 0) + consumed;
        dayTotals[day] = (dayTotals[day] || 0) + consumed;
        if (barTotals[bar.id]) barTotals[bar.id].consumed += consumed;
      });
    });

    // Waste: final closing per bar
    const lastDay = [...dayNames].reverse().find(day =>
      reports.some(r => r.bar_id === bar.id && r.festival_day === day && r.report_type === "closing")
    );
    if (!lastDay) return;
    const lc = reports.find(r => r.bar_id === bar.id && r.festival_day === lastDay && r.report_type === "closing");
    (lc?.items || []).forEach(item => {
      if (!productData[item.product_name]) return;
      productData[item.product_name].waste += Number(item.quantity) || 0;
    });
  });

  const totalConsumed = Object.values(productData).reduce((s, p) => s + p.consumed, 0);
  const topProduct = Object.entries(productData).sort((a, b) => b[1].consumed - a[1].consumed)[0];
  const topBar = Object.values(barTotals).sort((a, b) => b.consumed - a.consumed)[0];

  return { productData, barTotals, dayTotals, totalConsumed, topProduct, topBar };
}

// Compute stats filtered to a single product (or all if productFilter is null)
function computeFilteredStats(fullStats, bars, dayNames, productFilter) {
  if (!productFilter) return {
    totalConsumed: fullStats.totalConsumed,
    topProduct: fullStats.topProduct,
    topBar: fullStats.topBar,
    dayTotals: fullStats.dayTotals,
    barTotals: fullStats.barTotals,
    unit: null,
  };

  const pd = fullStats.productData[productFilter];
  if (!pd) return { totalConsumed: 0, topProduct: null, topBar: null, dayTotals: {}, barTotals: {}, unit: "" };

  const dayTotals = {};
  dayNames.forEach(d => { dayTotals[d] = pd.byDay[d] || 0; });

  const barTotals = {};
  bars.forEach(b => { barTotals[b.id] = { name: b.name, consumed: pd.byBar[b.id] || 0 }; });

  const topBar = Object.values(barTotals).sort((a, b) => b.consumed - a.consumed)[0];

  return {
    totalConsumed: pd.consumed,
    topProduct: null,
    topBar,
    dayTotals,
    barTotals,
    unit: pd.unit,
  };
}

function wasteBadge(pct) {
  if (pct < 5) return { label: "Bom", color: "bg-emerald-100 text-emerald-700" };
  if (pct <= 15) return { label: "Médio", color: "bg-amber-100 text-amber-700" };
  return { label: "Alto", color: "bg-red-100 text-red-700" };
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

// ─── Resumo tab ───────────────────────────────────────────────────────────────
function ResumoTab({ stats, bars, dayNames, chartJSReady, productFilter, setProductFilter, setTab }) {
  const dayCanvasRef = useRef(null);
  const barCanvasRef = useRef(null);
  const dayChartInst = useRef(null);
  const barChartInst = useRef(null);

  const filtered = computeFilteredStats(stats, bars, dayNames, productFilter);
  const productNames = Object.keys(stats.productData).sort();

  const wasteRows = Object.entries(stats.productData)
    .filter(([name]) => !productFilter || name === productFilter)
    .sort((a, b) => b[1].consumed - a[1].consumed)
    .map(([name, { consumed, unit, waste = 0 }]) => {
      const total = consumed + waste;
      const pct = total > 0 ? Math.round((waste / total) * 100) : 0;
      const { label, color } = wasteBadge(pct);
      return { name, consumed, waste, pct, badge: label, color, unit };
    });

  const barPerfRows = bars.map(bar => {
    const expected = dayNames.length * 2;
    const actual = stats._reports
      ? stats._reports.filter(r => r.bar_id === bar.id && ["opening", "closing"].includes(r.report_type)).length
      : 0;
    const pct = expected > 0 ? Math.round((actual / expected) * 100) : 0;
    const badge = pct >= 90 ? "Excelente" : pct >= 70 ? "Médio" : "Melhorar";
    const color = pct >= 90 ? "bg-emerald-100 text-emerald-700" : pct >= 70 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700";
    return { bar, actual, expected, pct, badge, color };
  });

  useLayoutEffect(() => {
    if (!chartJSReady) return;
    const Chart = window.Chart;

    if (dayChartInst.current) { dayChartInst.current.destroy(); dayChartInst.current = null; }
    if (barChartInst.current) { barChartInst.current.destroy(); barChartInst.current = null; }

    if (dayCanvasRef.current) {
      dayChartInst.current = new Chart(dayCanvasRef.current, {
        type: "bar",
        data: {
          labels: dayNames,
          datasets: [{ label: "Consumo", data: dayNames.map(d => filtered.dayTotals[d] || 0), backgroundColor: "#1D9E75", borderRadius: 6 }],
        },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } },
      });
    }

    if (barCanvasRef.current) {
      const total = filtered.totalConsumed || 1;
      const entries = Object.values(filtered.barTotals).sort((a, b) => b.consumed - a.consumed);
      barChartInst.current = new Chart(barCanvasRef.current, {
        type: "bar",
        data: {
          labels: entries.map(e => e.name),
          datasets: [{ label: "%", data: entries.map(e => Math.round((e.consumed / total) * 100)), backgroundColor: "#7F77DD", borderRadius: 6 }],
        },
        options: {
          indexAxis: "y",
          responsive: true,
          plugins: { legend: { display: false } },
          scales: { x: { beginAtZero: true, max: 100, ticks: { callback: v => v + "%" } } },
        },
      });
    }

    return () => {
      if (dayChartInst.current) { dayChartInst.current.destroy(); dayChartInst.current = null; }
      if (barChartInst.current) { barChartInst.current.destroy(); barChartInst.current = null; }
    };
  }, [chartJSReady, productFilter, stats, dayNames.join(",")]);

  return (
    <div className="space-y-8">
      {/* Product filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-neutral-500">Filtrar por produto:</span>
        <select
          value={productFilter || ""}
          onChange={e => setProductFilter(e.target.value || null)}
          className="border border-neutral-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900"
        >
          <option value="">Todos os produtos</option>
          {productNames.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        {productFilter && (
          <button onClick={() => setProductFilter(null)} className="text-xs text-neutral-400 hover:text-neutral-700 underline">
            Limpar filtro
          </button>
        )}
      </div>

      {/* Metric cards */}
      <div className={`grid gap-4 ${productFilter ? "grid-cols-2" : "grid-cols-3"}`}>
        <StatCard
          label="Total consumido"
          value={`${filtered.totalConsumed}${filtered.unit ? " " + filtered.unit : ""}`}
        />
        {productFilter ? (
          <StatCard
            label="Unidade"
            value={stats.productData[productFilter]?.unit || "—"}
          />
        ) : (
          <StatCard
            label="Produto mais consumido"
            value={filtered.topProduct?.[0] || "—"}
            sub={filtered.topProduct ? `${filtered.topProduct[1].consumed} ${filtered.topProduct[1].unit}` : undefined}
          />
        )}
        <StatCard
          label="Bar mais ativo"
          value={filtered.topBar?.name || "—"}
          sub={filtered.topBar && filtered.totalConsumed > 0
            ? `${Math.round((filtered.topBar.consumed / filtered.totalConsumed) * 100)}% do consumo total`
            : undefined}
        />
      </div>

      {/* Charts */}
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

      {/* Waste table */}
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

      {/* Bar performance */}
      {barPerfRows.length > 0 && !productFilter && (
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
  );
}

// ─── Por produto tab ──────────────────────────────────────────────────────────
function PorProdutoTab({ stats, bars, dayNames, setProductFilter, setTab }) {
  const rows = Object.entries(stats.productData)
    .sort((a, b) => b[1].consumed - a[1].consumed)
    .map(([name, pd]) => {
      const total = pd.consumed + (pd.waste || 0);
      const pct = total > 0 ? Math.round(((pd.waste || 0) / total) * 100) : 0;
      const { label, color } = wasteBadge(pct);

      const topBarEntry = Object.entries(pd.byBar).sort((a, b) => b[1] - a[1])[0];
      const topBarName = topBarEntry ? (bars.find(b => b.id === topBarEntry[0])?.name || topBarEntry[0]) : "—";
      const topBarQty = topBarEntry ? topBarEntry[1] : 0;

      const peakDay = Object.entries(pd.byDay).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";

      return { name, unit: pd.unit, consumed: pd.consumed, topBarName, topBarQty, peakDay, pct, badge: label, color };
    });

  return (
    <div>
      <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50">
            <tr>
              <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">Produto</th>
              <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">Unidade</th>
              <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">Total consumido</th>
              <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">Bar que mais consumiu</th>
              <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">Dia de pico</th>
              <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">% Desperdício</th>
              <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-50">
            {rows.map(row => (
              <tr
                key={row.name}
                className="hover:bg-neutral-50 cursor-pointer"
                onClick={() => { setProductFilter(row.name); setTab("resumo"); }}
                title="Ver detalhe no Resumo"
              >
                <td className="px-6 py-3 font-medium text-neutral-800 hover:underline">{row.name}</td>
                <td className="px-4 py-3 text-center text-neutral-500">{row.unit || "—"}</td>
                <td className="px-4 py-3 text-center text-neutral-700 font-medium">{row.consumed}</td>
                <td className="px-4 py-3 text-neutral-600">{row.topBarName} <span className="text-neutral-400">({row.topBarQty})</span></td>
                <td className="px-4 py-3 text-center text-neutral-600">{row.peakDay}</td>
                <td className="px-4 py-3 text-center text-neutral-600">{row.pct}%</td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${row.color}`}>{row.badge}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-neutral-400 mt-3">Clica numa linha para ver o detalhe desse produto no Resumo.</p>
    </div>
  );
}

// ─── Por bar tab ──────────────────────────────────────────────────────────────
function PorBarTab({ stats, bars, dayNames, reports }) {
  const cards = bars
    .map(bar => {
      const total = stats.barTotals[bar.id]?.consumed || 0;
      const daysWithData = dayNames.filter(day =>
        reports.some(r => r.bar_id === bar.id && r.festival_day === day && r.report_type === "closing")
      ).length;

      const expected = dayNames.length * 2;
      const actual = reports.filter(r => r.bar_id === bar.id && ["opening", "closing"].includes(r.report_type)).length;
      const pct = expected > 0 ? Math.round((actual / expected) * 100) : 0;

      // Top 3 products for this bar
      const topProducts = Object.entries(stats.productData)
        .map(([name, pd]) => ({ name, unit: pd.unit, consumed: pd.byBar[bar.id] || 0 }))
        .filter(p => p.consumed > 0)
        .sort((a, b) => b.consumed - a.consumed)
        .slice(0, 3);

      return { bar, total, daysWithData, pct, topProducts };
    })
    .sort((a, b) => b.total - a.total);

  if (!cards.length) {
    return <div className="text-center py-20 text-neutral-400 text-sm">Sem dados de bares.</div>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {cards.map(({ bar, total, daysWithData, pct, topProducts }) => (
        <div key={bar.id} className="bg-white rounded-2xl border border-neutral-100 p-5 shadow-sm">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="font-bold text-neutral-900">{bar.name}</div>
              <div className="text-xs text-neutral-400 mt-0.5">{daysWithData} {daysWithData === 1 ? "dia" : "dias"} com dados</div>
            </div>
            <div className="text-right">
              <div className="text-xl font-bold text-neutral-900">{total}</div>
              <div className="text-xs text-neutral-400">unidades consumidas</div>
            </div>
          </div>

          {topProducts.length > 0 && (
            <div className="border-t border-neutral-50 pt-3 mb-3">
              <div className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-2">Top produtos</div>
              <table className="w-full text-sm">
                <tbody>
                  {topProducts.map(p => (
                    <tr key={p.name}>
                      <td className="py-0.5 text-neutral-700">{p.name}</td>
                      <td className="py-0.5 text-right text-neutral-500">{p.consumed} {p.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-neutral-50 pt-3">
            <span className="text-xs text-neutral-400">Relatórios submetidos</span>
            <span className="text-xs font-medium text-neutral-700">{pct}%</span>
          </div>
          <div className="w-full bg-neutral-100 rounded-full h-1.5 mt-1">
            <div
              className={`h-1.5 rounded-full ${pct >= 90 ? "bg-emerald-500" : pct >= 70 ? "bg-amber-400" : "bg-red-400"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Comparar festivais tab ───────────────────────────────────────────────────
function CompararTab({ festivals, chartJSReady }) {
  const [selected, setSelected] = useState([]);
  const [dataByFest, setDataByFest] = useState({});
  const [loadingIds, setLoadingIds] = useState([]);
  const chartRef = useRef(null);
  const chartInst = useRef(null);

  const toggle = id => {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= 3) return prev;
      return [...prev, id];
    });
  };

  // Load data for any newly selected festival
  useEffect(() => {
    const missing = selected.filter(id => !dataByFest[id] && !loadingIds.includes(id));
    if (!missing.length) return;
    setLoadingIds(prev => [...prev, ...missing]);
    missing.forEach(id => {
      const fest = festivals.find(f => f.id === id);
      if (!fest) return;
      Promise.all([
        getFestivalBars(fest),
        db.StockReport.filterByFestival(id),
        db.Movement.filterByFestival(id),
      ]).then(([b, r, m]) => {
        const dayNames = fest.day_names?.length
          ? fest.day_names
          : Array.from({ length: fest.num_days || 1 }, (_, i) => `Dia ${i + 1}`);
        const det = computeDetailed(r, m, b, dayNames);
        setDataByFest(prev => ({ ...prev, [id]: { ...det, dayNames, bars: b, name: fest.name } }));
        setLoadingIds(prev => prev.filter(x => x !== id));
      });
    });
  }, [selected, festivals]);

  const readyData = selected.filter(id => dataByFest[id]);

  // All products across selected festivals
  const allProducts = [...new Set(readyData.flatMap(id => Object.keys(dataByFest[id].productData)))].sort();

  // Chart: total consumption per day per festival
  // Use max day count across selected
  const allDayNames = readyData.length
    ? readyData.reduce((acc, id) => {
        const dn = dataByFest[id].dayNames;
        return dn.length > acc.length ? dn : acc;
      }, [])
    : [];

  useLayoutEffect(() => {
    if (!chartJSReady || !readyData.length) return;
    const Chart = window.Chart;
    if (chartInst.current) { chartInst.current.destroy(); chartInst.current = null; }
    if (!chartRef.current) return;

    chartInst.current = new Chart(chartRef.current, {
      type: "bar",
      data: {
        labels: allDayNames,
        datasets: readyData.map((id, i) => ({
          label: dataByFest[id].name,
          data: allDayNames.map(d => dataByFest[id].dayTotals[d] || 0),
          backgroundColor: COMPARE_COLORS[i % COMPARE_COLORS.length],
          borderRadius: 4,
        })),
      },
      options: {
        responsive: true,
        plugins: { legend: { position: "bottom" } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      },
    });
    return () => { if (chartInst.current) { chartInst.current.destroy(); chartInst.current = null; } };
  }, [chartJSReady, readyData.join(","), allDayNames.join(",")]);

  if (festivals.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center mb-4">
          <TrendingUp className="w-6 h-6 text-neutral-300" />
        </div>
        <div className="font-semibold text-neutral-500">Precisas de pelo menos 2 festivais para comparar</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Festival selector */}
      <div>
        <div className="text-sm font-semibold text-neutral-700 mb-3">Seleciona até 3 festivais</div>
        <div className="flex flex-wrap gap-2">
          {festivals.map((f, i) => {
            const isSelected = selected.includes(f.id);
            const color = isSelected ? COMPARE_COLORS[selected.indexOf(f.id)] : null;
            return (
              <button
                key={f.id}
                onClick={() => toggle(f.id)}
                disabled={!isSelected && selected.length >= 3}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                  isSelected
                    ? "text-white border-transparent"
                    : "bg-white border-neutral-200 text-neutral-600 hover:border-neutral-400 disabled:opacity-40 disabled:cursor-not-allowed"
                }`}
                style={isSelected ? { backgroundColor: color, borderColor: color } : {}}
              >
                {f.name}{f.is_closed ? " ✓" : ""}
              </button>
            );
          })}
        </div>
        {loadingIds.length > 0 && (
          <div className="text-xs text-neutral-400 mt-2">A carregar dados...</div>
        )}
      </div>

      {readyData.length >= 2 && (
        <>
          {/* Comparison table */}
          <div>
            <h2 className="text-sm font-semibold text-neutral-700 mb-3">Consumo por produto</h2>
            <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">Produto</th>
                    {readyData.map((id, i) => (
                      <th key={id} className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">
                        <span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: COMPARE_COLORS[i] }} />
                        {dataByFest[id].name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {allProducts.map(name => (
                    <tr key={name} className="hover:bg-neutral-50">
                      <td className="px-6 py-3 font-medium text-neutral-800">{name}</td>
                      {readyData.map(id => {
                        const val = dataByFest[id].productData[name]?.consumed || 0;
                        const unit = dataByFest[id].productData[name]?.unit || "";
                        return (
                          <td key={id} className="px-4 py-3 text-center text-neutral-600">
                            {val > 0 ? `${val} ${unit}` : <span className="text-neutral-300">—</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Grouped bar chart */}
          <div className="bg-white rounded-2xl border border-neutral-100 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-neutral-700 mb-4">Consumo total por dia</h3>
            <canvas ref={chartRef} />
          </div>
        </>
      )}

      {readyData.length === 1 && (
        <div className="text-center py-10 text-neutral-400 text-sm">Seleciona mais um festival para comparar</div>
      )}
      {readyData.length === 0 && selected.length === 0 && (
        <div className="text-center py-10 text-neutral-400 text-sm">Seleciona festivais acima para começar a comparar</div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Analytics() {
  const chartJSReady = useChartJS();

  const [festivals, setFestivals] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [bars, setBars] = useState([]);
  const [reports, setReports] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("resumo");
  const [productFilter, setProductFilter] = useState(null);

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
    setProductFilter(null);
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
    ? { ...computeDetailed(reports, movements, bars, dayNames), _reports: reports }
    : null;

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
              {t.key === "resumo" && productFilter && (
                <span className="ml-2 text-xs bg-white/20 px-1.5 py-0.5 rounded-full">{productFilter}</span>
              )}
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
              stats ? (
                <ResumoTab
                  stats={stats}
                  bars={bars}
                  dayNames={dayNames}
                  chartJSReady={chartJSReady}
                  productFilter={productFilter}
                  setProductFilter={setProductFilter}
                  setTab={setTab}
                />
              ) : (
                <div className="bg-white rounded-2xl border border-neutral-100 p-8 text-center text-neutral-400 text-sm">
                  Sem dados suficientes. Submete relatórios de abertura e fecho para ver a análise.
                </div>
              )
            )}

            {tab === "por_produto" && (
              stats ? (
                <PorProdutoTab
                  stats={stats}
                  bars={bars}
                  dayNames={dayNames}
                  setProductFilter={setProductFilter}
                  setTab={setTab}
                />
              ) : (
                <div className="bg-white rounded-2xl border border-neutral-100 p-8 text-center text-neutral-400 text-sm">
                  Sem dados suficientes para mostrar produtos.
                </div>
              )
            )}

            {tab === "por_bar" && (
              stats ? (
                <PorBarTab
                  stats={stats}
                  bars={bars}
                  dayNames={dayNames}
                  reports={reports}
                />
              ) : (
                <div className="bg-white rounded-2xl border border-neutral-100 p-8 text-center text-neutral-400 text-sm">
                  Sem dados suficientes para mostrar bares.
                </div>
              )
            )}

            {tab === "comparar" && (
              <CompararTab
                festivals={festivals}
                chartJSReady={chartJSReady}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
