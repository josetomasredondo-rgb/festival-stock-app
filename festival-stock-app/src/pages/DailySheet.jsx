import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, Loader2, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import db, { getFestivalBars } from "../lib/db";
import { useAuth, useFestivalSettings } from "../lib/AuthContext";

const TYPE_COLOR = {
  opening: "bg-blue-100 text-blue-700",
  delivery: "bg-amber-100 text-amber-700",
  night_delivery: "bg-indigo-100 text-indigo-700",
  closing: "bg-emerald-100 text-emerald-700"
};

function computeWarehouseStock(warehouse, allMovements) {
  const map = {};
  (warehouse.initial_stock || []).forEach(i => {
    map[i.product_name] = { product_name: i.product_name, unit: i.unit, initial: Number(i.quantity) || 0, current: Number(i.quantity) || 0 };
  });
  allMovements
    .filter(m => m.origin_type === "warehouse" && m.origin_id === warehouse.id)
    .forEach(m => (m.items || []).forEach(i => {
      if (!map[i.product_name]) map[i.product_name] = { product_name: i.product_name, unit: i.unit, initial: 0, current: 0 };
      map[i.product_name].current -= Number(i.quantity) || 0;
    }));
  allMovements
    .filter(m => m.type === "restock" && m.destination_id === warehouse.id)
    .forEach(m => (m.items || []).forEach(i => {
      if (!map[i.product_name]) map[i.product_name] = { product_name: i.product_name, unit: i.unit, initial: 0, current: 0 };
      map[i.product_name].current += Number(i.quantity) || 0;
    }));
  return Object.values(map);
}

export default function DailySheet() {
  const { role, user, currentFestival } = useAuth();
  const { dayNames, reportTypeLabels } = useFestivalSettings();
  const [bars, setBars] = useState([]);
  const [reports, setReports] = useState([]);
  const [movements, setMovements] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null);
  const [expandedBars, setExpandedBars] = useState({});

  const TYPE_LABEL = {
    opening: reportTypeLabels.opening,
    delivery: reportTypeLabels.delivery,
    night_delivery: reportTypeLabels.night_delivery,
    closing: reportTypeLabels.closing,
  };

  const festivalId = currentFestival?.id;
  const canSeeSaidas = ["event_coordinator", "manager"].includes(role);
  const canSeeWarehouse = ["event_coordinator", "manager"].includes(role);

  const reportDays = [...new Set(reports.map(r => r.festival_day).filter(Boolean))];
  const allDays = [...new Set([...dayNames, ...reportDays])];
  const days = allDays.length > 0 ? allDays : dayNames;
  const activeDay = (selectedDay && days.includes(selectedDay)) ? selectedDay : days[0];

  useEffect(() => {
    if (!festivalId) { setLoading(false); return; }
    Promise.all([
      getFestivalBars(currentFestival),
      db.StockReport.filterByFestival(festivalId, "-created_date"),
      db.Movement.filterByFestival(festivalId),
      db.Warehouse.filterByFestival(festivalId),
    ]).then(([b, r, m, w]) => {
      let visibleBars = b;
      if (role === "bar_leader" && user?.bar_id) {
        visibleBars = b.filter(bar => bar.id === user.bar_id);
      }
      setBars(visibleBars);
      setReports(r);
      setMovements(m);
      setWarehouses(w);
      setLoading(false);
    });
  }, [festivalId]);

  const dayReports = reports.filter(r => r.festival_day === activeDay);
  const dayMovements = movements.filter(m => m.festival_day === activeDay);

  const barData = bars.map(bar => {
    const barReports = dayReports.filter(r => r.bar_id === bar.id);
    const opening = barReports.find(r => r.report_type === "opening");
    const deliveries = barReports.filter(r => ["delivery", "night_delivery"].includes(r.report_type));
    const closing = barReports.find(r => r.report_type === "closing");
    const incomingMovements = dayMovements.filter(m => m.destination_type === "bar" && m.destination_id === bar.id);
    const outgoingMovements = dayMovements.filter(m => m.origin_type === "bar" && m.origin_id === bar.id);

    const allProductNames = [...new Set([
      ...(opening?.items || []).map(i => i.product_name),
      ...deliveries.flatMap(d => d.items || []).map(i => i.product_name),
      ...(closing?.items || []).map(i => i.product_name),
      ...incomingMovements.flatMap(m => m.items || []).map(i => i.product_name),
      ...outgoingMovements.flatMap(m => m.items || []).map(i => i.product_name),
    ])].filter(Boolean);

    const rows = allProductNames.map(name => {
      const openQty = (opening?.items || []).find(i => i.product_name === name)?.quantity ?? "-";

      const delivQtyFromReports = deliveries.reduce((sum, d) => {
        const f = (d.items || []).find(i => i.product_name === name);
        return sum + (f ? Number(f.quantity) || 0 : 0);
      }, 0);
      const incomingMovQty = incomingMovements.reduce((sum, m) => {
        const f = (m.items || []).find(i => i.product_name === name);
        return sum + (f ? Number(f.quantity) || 0 : 0);
      }, 0);
      const entradas = delivQtyFromReports + incomingMovQty;

      const saidas = outgoingMovements.reduce((sum, m) => {
        const f = (m.items || []).find(i => i.product_name === name);
        return sum + (f ? Number(f.quantity) || 0 : 0);
      }, 0);

      const closeQty = (closing?.items || []).find(i => i.product_name === name)?.quantity ?? "-";
      const unit = [...(opening?.items || []), ...(closing?.items || [])].find(i => i.product_name === name)?.unit || "";

      let consumed = "-";
      if (openQty !== "-" && closeQty !== "-") {
        consumed = (Number(openQty) + entradas - saidas) - Number(closeQty);
      }

      const hasDelivReport = delivQtyFromReports > 0;
      const hasIncomingMov = incomingMovQty > 0;
      const hasDuplicate = hasDelivReport && hasIncomingMov;

      const hasEntrada = deliveries.length > 0 || incomingMovements.length > 0;
      const hasSaida = outgoingMovements.length > 0;

      return {
        name, openQty,
        entradas: hasEntrada ? entradas : "-",
        saidas: hasSaida ? saidas : "-",
        closeQty, consumed, unit, hasDuplicate, incomingMovQty, delivQtyFromReports,
      };
    });

    const hasData = barReports.length > 0 || incomingMovements.length > 0 || outgoingMovements.length > 0;
    const needsDelivery = rows.some(r => r.closeQty !== "-" && r.consumed !== "-" && Number(r.closeQty) < Number(r.consumed));
    return { bar, opening, deliveries, closing, incomingMovements, outgoingMovements, rows, hasData, needsDelivery };
  });

  const toggleBar = (barId) => setExpandedBars(prev => ({ ...prev, [barId]: !prev[barId] }));

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <Link to="/Dashboard" className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-700 transition-colors mb-8">
          <ChevronLeft className="w-4 h-4" /> Voltar
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-neutral-900">Folha Diária</h1>
            <p className="text-neutral-400 mt-1">{currentFestival?.name} · Visão geral do stock de todos os bares</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {days.map(d => (
              <button key={d} onClick={() => setSelectedDay(d)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeDay === d ? "bg-neutral-900 text-white" : "bg-white border border-neutral-200 text-neutral-600 hover:border-neutral-400"}`}>
                {d}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-neutral-400" /></div>
        ) : (
          <div className="space-y-4">
            {/* ── Warehouse card ── */}
            {canSeeWarehouse && warehouses.length > 0 && (
              <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-neutral-100 bg-emerald-50">
                  <div className="font-bold text-emerald-900">
                    {warehouses.length === 1 ? warehouses[0].name : "Armazéns"}
                  </div>
                  <div className="text-xs text-emerald-600 mt-0.5">Stock atual do armazém (Inicial → Atual)</div>
                </div>
                {warehouses.map(wh => {
                  const stock = computeWarehouseStock(wh, movements);
                  if (stock.length === 0) return null;
                  return (
                    <div key={wh.id}>
                      {warehouses.length > 1 && (
                        <div className="px-6 py-2 bg-neutral-50 border-t border-neutral-100 text-xs font-semibold text-neutral-500">{wh.name}</div>
                      )}
                      <table className="w-full text-sm">
                        <thead className="bg-neutral-50">
                          <tr>
                            <th className="text-left px-6 py-2 text-xs font-semibold text-neutral-400">Produto</th>
                            <th className="text-center px-4 py-2 text-xs font-semibold text-neutral-400">Inicial</th>
                            <th className="text-center px-4 py-2 text-xs font-semibold text-emerald-600">Atual</th>
                            <th className="text-left px-4 py-2 text-xs font-semibold text-neutral-400">Unid.</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-50">
                          {stock.map(row => (
                            <tr key={row.product_name} className="hover:bg-neutral-50">
                              <td className="px-6 py-2.5 font-medium text-neutral-800">{row.product_name}</td>
                              <td className="px-4 py-2.5 text-center text-neutral-400">{row.initial}</td>
                              <td className="px-4 py-2.5 text-center font-semibold">
                                <span className={row.current < 0 ? "text-red-500" : row.current === 0 ? "text-neutral-400" : "text-emerald-700"}>
                                  {row.current}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-neutral-400 text-xs">{row.unit}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Bar cards ── */}
            {barData.map(({ bar, opening, deliveries, closing, incomingMovements, outgoingMovements, rows, hasData, needsDelivery }) => {
              const isExpanded = expandedBars[bar.id] !== false;
              const statusFlags = [
                { key: "opening", done: !!opening },
                { key: "delivery", done: deliveries.length > 0 || incomingMovements.length > 0 },
                { key: "closing", done: !!closing }
              ];
              return (
                <div key={bar.id} className={`bg-white rounded-2xl border overflow-hidden shadow-sm transition-all ${needsDelivery ? "border-orange-300 ring-2 ring-orange-100" : hasData ? "border-neutral-100" : "border-neutral-100 opacity-60"}`}>
                  <button onClick={() => toggleBar(bar.id)}
                    className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-neutral-50 transition-colors">
                    <div className="flex items-center gap-4 flex-wrap">
                      <div>
                        <div className="font-semibold text-neutral-900">{bar.name}</div>
                        {bar.leader_name && <div className="text-xs text-neutral-400 mt-0.5">Responsável: {bar.leader_name}</div>}
                      </div>
                      <div className="flex gap-1.5 flex-wrap">
                        {statusFlags.map(s => (
                          <span key={s.key} className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.done ? TYPE_COLOR[s.key] : "bg-neutral-100 text-neutral-400"}`}>
                            {TYPE_LABEL[s.key]}
                          </span>
                        ))}
                        {needsDelivery && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-orange-100 text-orange-700 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> Necessita Entrega
                          </span>
                        )}
                        {outgoingMovements.length > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-purple-100 text-purple-700">
                            {outgoingMovements.length} saída{outgoingMovements.length !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-neutral-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-neutral-400 shrink-0" />}
                  </button>

                  {isExpanded && rows.length > 0 && (
                    <div className="overflow-x-auto border-t border-neutral-100">
                      <table className="w-full text-sm">
                        <thead className="bg-neutral-50">
                          <tr>
                            <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">Produto</th>
                            <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-widest text-blue-400">Abertura</th>
                            <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-widest text-amber-400">Entradas</th>
                            {canSeeSaidas && (
                              <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-widest text-purple-400">Saídas</th>
                            )}
                            <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-widest text-emerald-400">Fecho</th>
                            <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">Consumido</th>
                            <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">Unid.</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-50">
                          {rows.map(row => (
                            <tr key={row.name} className="hover:bg-neutral-50 transition-colors">
                              <td className="px-6 py-3 font-medium text-neutral-800">{row.name}</td>
                              <td className="px-4 py-3 text-center text-neutral-600">{row.openQty}</td>
                              <td className="px-4 py-3 text-center">
                                <span className="text-neutral-600">{row.entradas}</span>
                                {row.hasDuplicate && (
                                  <div className="flex items-center justify-center gap-1 text-xs text-amber-600 mt-0.5">
                                    <AlertTriangle className="w-3 h-3" /> possível entrada duplicada
                                  </div>
                                )}
                              </td>
                              {canSeeSaidas && (
                                <td className="px-4 py-3 text-center text-purple-600 font-medium">{row.saidas}</td>
                              )}
                              <td className="px-4 py-3 text-center text-neutral-600">{row.closeQty}</td>
                              <td className="px-4 py-3 text-center">
                                {row.consumed !== "-" ? (
                                  <span className={`font-semibold ${Number(row.consumed) < 0 ? "text-red-500" : "text-neutral-800"}`}>{row.consumed}</span>
                                ) : <span className="text-neutral-300">-</span>}
                              </td>
                              <td className="px-4 py-3 text-neutral-400 text-xs">{row.unit}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {isExpanded && !hasData && (
                    <div className="px-6 py-6 text-center text-sm text-neutral-300 border-t border-neutral-50">
                      Ainda sem relatórios submetidos para este dia
                    </div>
                  )}
                  {isExpanded && hasData && rows.length === 0 && (
                    <div className="px-6 py-6 text-center text-sm text-neutral-300 border-t border-neutral-50">
                      Relatórios submetidos mas sem produtos registados
                    </div>
                  )}
                </div>
              );
            })}
            {barData.length === 0 && (
              <div className="text-center py-16 text-neutral-300 text-sm">Sem bares neste festival</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
