import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, Loader2, PackageOpen, Plus, CheckCircle, AlertTriangle, X } from "lucide-react";
import db, { getFestivalBars, getFestivalProducts } from "../lib/db";
import { useAuth, useFestivalSettings } from "../lib/AuthContext";

// For stock display tab (returns array)
function computeWarehouseStockDisplay(warehouse, allMovements) {
  const stockMap = {};
  (warehouse.initial_stock || []).forEach(item => {
    stockMap[item.product_name] = {
      product_id: item.product_id,
      product_name: item.product_name,
      unit: item.unit,
      initial: Number(item.quantity) || 0,
      current: Number(item.quantity) || 0,
    };
  });
  allMovements
    .filter(m => m.origin_type === "warehouse" && m.origin_id === warehouse.id)
    .forEach(m => (m.items || []).forEach(item => {
      if (!stockMap[item.product_name]) stockMap[item.product_name] = { product_id: item.product_id, product_name: item.product_name, unit: item.unit, initial: 0, current: 0 };
      stockMap[item.product_name].current -= Number(item.quantity) || 0;
    }));
  allMovements
    .filter(m => m.type === "restock" && m.destination_id === warehouse.id)
    .forEach(m => (m.items || []).forEach(item => {
      if (!stockMap[item.product_name]) stockMap[item.product_name] = { product_id: item.product_id, product_name: item.product_name, unit: item.unit, initial: 0, current: 0 };
      stockMap[item.product_name].current += Number(item.quantity) || 0;
    }));
  return Object.values(stockMap);
}

// For movement form availability (returns map keyed by product_id)
function computeWarehouseAvail(warehouse, allMovements) {
  const map = {};
  (warehouse.initial_stock || []).forEach(i => {
    map[i.product_id] = { product_id: i.product_id, product_name: i.product_name, unit: i.unit, current: Number(i.quantity) || 0 };
  });
  allMovements
    .filter(m => m.origin_type === "warehouse" && m.origin_id === warehouse.id)
    .forEach(m => (m.items || []).forEach(i => {
      if (!map[i.product_id]) map[i.product_id] = { product_id: i.product_id, product_name: i.product_name, unit: i.unit, current: 0 };
      map[i.product_id].current -= Number(i.quantity) || 0;
    }));
  allMovements
    .filter(m => m.type === "restock" && m.destination_id === warehouse.id)
    .forEach(m => (m.items || []).forEach(i => {
      if (!map[i.product_id]) map[i.product_id] = { product_id: i.product_id, product_name: i.product_name, unit: i.unit, current: 0 };
      map[i.product_id].current += Number(i.quantity) || 0;
    }));
  return map;
}

function computeBarStock(barId, festivalDay, reports, allMovements) {
  const dayReports = reports.filter(r => r.bar_id === barId && r.festival_day === festivalDay);
  const opening = dayReports.find(r => r.report_type === "opening");
  const deliveries = dayReports.filter(r => ["delivery", "night_delivery"].includes(r.report_type));
  const dayMovements = allMovements.filter(m => m.festival_day === festivalDay);
  const incoming = dayMovements.filter(m => m.destination_type === "bar" && m.destination_id === barId);
  const outgoing = dayMovements.filter(m => m.origin_type === "bar" && m.origin_id === barId);
  const map = {};
  const add = (items, mult = 1) => (items || []).forEach(i => {
    const key = i.product_id || i.product_name;
    if (!map[key]) map[key] = { product_id: i.product_id, product_name: i.product_name, unit: i.unit, current: 0 };
    map[key].current += mult * (Number(i.quantity) || 0);
  });
  add(opening?.items, 1);
  deliveries.forEach(d => add(d.items, 1));
  incoming.forEach(m => add(m.items, 1));
  outgoing.forEach(m => add(m.items, -1));
  return map;
}

const MOV_TYPE_LABELS = { warehouse_to_bar: "Armazém → Bar", bar_to_bar: "Bar → Bar", restock: "Reabastecimento" };
const MOV_TYPE_COLORS = {
  warehouse_to_bar: "bg-emerald-100 text-emerald-700 border-emerald-200",
  bar_to_bar: "bg-purple-100 text-purple-700 border-purple-200",
  restock: "bg-blue-100 text-blue-700 border-blue-200",
};

export default function WarehousePage() {
  const { role, user, currentFestival } = useAuth();
  const { dayNames } = useFestivalSettings();
  const festivalId = currentFestival?.id;

  const [activeTab, setActiveTab] = useState("stock");

  // Shared data
  const [bars, setBars] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  // Stock tab state
  const [restockWHId, setRestockWHId] = useState(null);
  const [restockDay, setRestockDay] = useState(dayNames[0] || "");
  const [restockItems, setRestockItems] = useState([]);
  const [restockSubmitting, setRestockSubmitting] = useState(false);
  const [restockSubmitted, setRestockSubmitted] = useState(false);

  // Movimentos tab state
  const [movFilterTab, setMovFilterTab] = useState("all");
  const [showMovForm, setShowMovForm] = useState(false);
  const [movSubmitting, setMovSubmitting] = useState(false);
  const [movSubmitted, setMovSubmitted] = useState(false);
  const [movForm, setMovForm] = useState({
    type: "warehouse_to_bar",
    origin_id: "",
    origin_type: "warehouse",
    origin_name: "",
    destination_id: "",
    destination_type: "bar",
    destination_name: "",
    festival_day: dayNames[0] || "",
    submitted_by: user?.name || "",
  });
  const [movFormItems, setMovFormItems] = useState([]);

  const canEdit = ["manager", "event_coordinator"].includes(role);

  useEffect(() => {
    if (!festivalId) { setLoading(false); return; }
    Promise.all([
      getFestivalBars(currentFestival),
      db.Warehouse.filterByFestival(festivalId),
      db.Movement.filterByFestival(festivalId, "-created_date"),
      getFestivalProducts(currentFestival),
      db.StockReport.filterByFestival(festivalId),
    ]).then(([b, w, m, p, r]) => {
      setBars(b.filter(bar => bar.is_active !== false));
      setWarehouses(w);
      setMovements(m);
      setProducts(p);
      setReports(r);
      setLoading(false);
    });
  }, [festivalId]);

  // Recompute available items for movement form
  useEffect(() => {
    if (!movForm.origin_id) {
      setMovFormItems(products.map(p => ({ product_id: p.id, product_name: p.name, unit: p.unit || "units", quantity: "", available: 0 })));
      return;
    }
    let availMap = {};
    if (movForm.origin_type === "warehouse") {
      const wh = warehouses.find(w => w.id === movForm.origin_id);
      if (wh) availMap = computeWarehouseAvail(wh, movements);
    } else {
      availMap = computeBarStock(movForm.origin_id, movForm.festival_day, reports, movements);
    }
    setMovFormItems(products.map(p => ({
      product_id: p.id,
      product_name: p.name,
      unit: p.unit || "units",
      quantity: "",
      available: availMap[p.id]?.current ?? 0,
    })));
  }, [movForm.origin_id, movForm.origin_type, movForm.festival_day, warehouses, movements, reports, products]);

  // ── Stock tab handlers ────────────────────────────────────────────────────────
  const openRestock = (whId) => {
    const wh = warehouses.find(w => w.id === whId);
    if (!wh) return;
    const stock = computeWarehouseStockDisplay(wh, movements);
    const allItems = products.map(p => {
      const stockItem = stock.find(s => s.product_id === p.id);
      return { product_id: p.id, product_name: p.name, unit: p.unit || "units", current: stockItem?.current ?? 0, addQty: "" };
    });
    setRestockItems(allItems);
    setRestockWHId(whId);
    setRestockDay(dayNames[0] || "");
    setRestockSubmitted(false);
  };

  const handleRestock = async () => {
    const wh = warehouses.find(w => w.id === restockWHId);
    if (!wh) return;
    const items = restockItems
      .filter(i => Number(i.addQty) > 0)
      .map(i => ({ product_id: i.product_id, product_name: i.product_name, unit: i.unit, quantity: Number(i.addQty) }));
    if (!items.length) { setRestockWHId(null); return; }
    setRestockSubmitting(true);
    const created = await db.Movement.create({
      festival_id: festivalId,
      festival_day: restockDay,
      type: "restock",
      origin_type: "external",
      origin_id: null,
      origin_name: "Externo",
      destination_type: "warehouse",
      destination_id: wh.id,
      destination_name: wh.name,
      items,
      submitted_by: user?.name || "",
    });
    if (created) setMovements(prev => [created, ...prev]);
    setRestockSubmitting(false);
    setRestockWHId(null);
    setRestockSubmitted(true);
    setTimeout(() => setRestockSubmitted(false), 3000);
  };

  // ── Movimentos tab handlers ───────────────────────────────────────────────────
  const handleMovTypeChange = (type) => {
    setMovForm(f => ({
      ...f, type,
      origin_type: type === "warehouse_to_bar" ? "warehouse" : "bar",
      origin_id: "", origin_name: "", destination_id: "", destination_name: "",
    }));
  };

  const handleMovOriginChange = (id) => {
    let name = "";
    if (movForm.origin_type === "warehouse") name = warehouses.find(w => w.id === id)?.name || "";
    else name = bars.find(b => b.id === id)?.name || "";
    setMovForm(f => ({ ...f, origin_id: id, origin_name: name }));
  };

  const handleMovDestinationChange = (id) => {
    const name = bars.find(b => b.id === id)?.name || "";
    setMovForm(f => ({ ...f, destination_id: id, destination_name: name }));
  };

  const movHasExceeds = movFormItems.some(i => Number(i.quantity) > 0 && Number(i.quantity) > i.available);
  const movHasItems = movFormItems.some(i => Number(i.quantity) > 0);
  const canSubmitMov = !movSubmitting && !movHasExceeds && movHasItems && movForm.origin_id && movForm.destination_id;

  const handleMovSubmit = async () => {
    if (!canSubmitMov) return;
    setMovSubmitting(true);
    const items = movFormItems
      .filter(i => Number(i.quantity) > 0)
      .map(i => ({ product_id: i.product_id, product_name: i.product_name, unit: i.unit, quantity: Number(i.quantity) }));
    const created = await db.Movement.create({
      festival_id: festivalId,
      festival_day: movForm.festival_day,
      type: movForm.type,
      origin_type: movForm.origin_type,
      origin_id: movForm.origin_id,
      origin_name: movForm.origin_name,
      destination_type: "bar",
      destination_id: movForm.destination_id,
      destination_name: movForm.destination_name,
      items,
      submitted_by: movForm.submitted_by,
    });
    if (created) setMovements(prev => [created, ...prev]);
    setMovSubmitting(false);
    setShowMovForm(false);
    setMovSubmitted(true);
    setTimeout(() => setMovSubmitted(false), 3000);
    setMovForm(f => ({ ...f, origin_id: "", origin_name: "", destination_id: "", destination_name: "" }));
  };

  const filteredMovements = movements.filter(m => {
    if (movFilterTab === "warehouse_to_bar") return m.type === "warehouse_to_bar";
    if (movFilterTab === "bar_to_bar") return m.type === "bar_to_bar";
    return true;
  });

  if (!festivalId) {
    return (
      <div className="min-h-screen bg-[#F7F7F5] flex items-center justify-center">
        <div className="text-neutral-400 text-sm">Nenhum festival selecionado.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <Link to="/Dashboard" className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-700 transition-colors mb-8">
          <ChevronLeft className="w-4 h-4" /> Voltar
        </Link>

        <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-neutral-900">Armazém</h1>
            <p className="text-neutral-400 mt-1">{currentFestival?.name}</p>
          </div>
          <div className="flex items-center gap-3">
            {restockSubmitted && activeTab === "stock" && (
              <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-xl">
                <CheckCircle className="w-4 h-4" /> Reabastecimento registado
              </div>
            )}
            {movSubmitted && activeTab === "movimentos" && (
              <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-xl">
                <CheckCircle className="w-4 h-4" /> Movimento registado
              </div>
            )}
            {activeTab === "movimentos" && !showMovForm && (
              <button onClick={() => setShowMovForm(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-neutral-900 text-white rounded-xl text-sm font-semibold hover:bg-neutral-700 transition-colors">
                <Plus className="w-4 h-4" /> Novo Movimento
              </button>
            )}
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-2 mb-6">
          {[["stock", "Stock"], ["movimentos", "Movimentos"]].map(([key, label]) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`px-5 py-2 rounded-xl text-sm font-medium transition-all ${activeTab === key ? "bg-neutral-900 text-white" : "bg-white border border-neutral-200 text-neutral-600 hover:border-neutral-400"}`}>
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-neutral-400" /></div>
        ) : (
          <>
            {/* ── Stock tab ── */}
            {activeTab === "stock" && (
              warehouses.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl border border-neutral-100 shadow-sm">
                  <PackageOpen className="w-8 h-8 text-neutral-300 mx-auto mb-3" />
                  <div className="text-neutral-400 text-sm">Nenhum armazém configurado para este festival.</div>
                  <div className="text-xs text-neutral-300 mt-1">Configura os armazéns em Definições Globais → Festival.</div>
                </div>
              ) : (
                <div className="space-y-6">
                  {warehouses.map(wh => {
                    const stock = computeWarehouseStockDisplay(wh, movements);
                    const isRestocking = restockWHId === wh.id;
                    return (
                      <div key={wh.id} className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
                          <div>
                            <div className="font-bold text-neutral-900">{wh.name}</div>
                            <div className="text-xs text-neutral-400 mt-0.5">{stock.length} produto{stock.length !== 1 ? "s" : ""}</div>
                          </div>
                          {canEdit && !isRestocking && (
                            <button onClick={() => openRestock(wh.id)}
                              className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-xl text-sm font-medium hover:bg-neutral-700 transition-colors">
                              <Plus className="w-4 h-4" /> Reabastecer
                            </button>
                          )}
                        </div>

                        {stock.length > 0 ? (
                          <table className="w-full text-sm">
                            <thead className="bg-neutral-50">
                              <tr>
                                <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">Produto</th>
                                <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">Inicial</th>
                                <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-widest text-emerald-600">Atual</th>
                                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">Unid.</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-50">
                              {stock.map(row => (
                                <tr key={row.product_name} className="hover:bg-neutral-50 transition-colors">
                                  <td className="px-6 py-3 font-medium text-neutral-800">{row.product_name}</td>
                                  <td className="px-4 py-3 text-center text-neutral-400">{row.initial}</td>
                                  <td className="px-4 py-3 text-center">
                                    <span className={`font-semibold ${row.current < 0 ? "text-red-500" : row.current === 0 ? "text-neutral-400" : "text-emerald-700"}`}>
                                      {row.current}
                                    </span>
                                    {row.current < 0 && <AlertTriangle className="w-3.5 h-3.5 text-red-400 inline ml-1" />}
                                  </td>
                                  <td className="px-4 py-3 text-neutral-400 text-xs">{row.unit}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <div className="px-6 py-6 text-center text-sm text-neutral-300">
                            Sem stock inicial definido. Configura o stock em Definições Globais.
                          </div>
                        )}

                        {isRestocking && (
                          <div className="border-t border-neutral-100 bg-neutral-50 p-6">
                            <div className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-4">Novo Reabastecimento</div>
                            <div className="mb-4">
                              <label className="block text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-2">Dia do Festival</label>
                              <select value={restockDay} onChange={e => setRestockDay(e.target.value)}
                                className="border border-neutral-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900">
                                {dayNames.map(d => <option key={d} value={d}>{d}</option>)}
                              </select>
                            </div>
                            <div className="space-y-2 mb-5">
                              {restockItems.map((item, idx) => (
                                <div key={item.product_id} className="flex items-center gap-4 bg-white rounded-xl border border-neutral-100 px-4 py-3">
                                  <span className="flex-1 text-sm font-medium text-neutral-800">{item.product_name}</span>
                                  <span className="text-xs text-neutral-400 mr-2">Atual: {item.current}</span>
                                  <input type="number" min="0" placeholder="Qtd a adicionar"
                                    value={item.addQty}
                                    onChange={e => setRestockItems(prev => prev.map((x, i) => i === idx ? { ...x, addQty: e.target.value } : x))}
                                    onWheel={e => e.target.blur()}
                                    className="w-28 border border-neutral-200 rounded-xl px-3 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-neutral-900" />
                                  <span className="text-xs text-neutral-400 w-10">{item.unit}</span>
                                </div>
                              ))}
                            </div>
                            <div className="flex gap-3">
                              <button onClick={handleRestock} disabled={restockSubmitting || !restockItems.some(i => Number(i.addQty) > 0)}
                                className="px-5 py-2.5 bg-neutral-900 text-white rounded-xl text-sm font-semibold hover:bg-neutral-700 transition-colors disabled:opacity-40 flex items-center gap-2">
                                {restockSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                Confirmar Reabastecimento
                              </button>
                              <button onClick={() => setRestockWHId(null)}
                                className="px-5 py-2.5 border border-neutral-200 rounded-xl text-sm font-medium text-neutral-600 hover:bg-neutral-100 transition-colors">
                                Cancelar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            )}

            {/* ── Movimentos tab ── */}
            {activeTab === "movimentos" && (
              <>
                {showMovForm && (
                  <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-6 mb-6">
                    <div className="flex items-center justify-between mb-5">
                      <div className="text-xs font-semibold uppercase tracking-widest text-neutral-400">Novo Movimento</div>
                      <button onClick={() => setShowMovForm(false)} className="p-1.5 text-neutral-400 hover:text-neutral-700 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="mb-5">
                      <label className="block text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-3">Tipo</label>
                      <div className="flex gap-2">
                        {["warehouse_to_bar", "bar_to_bar"].map(t => (
                          <button key={t} type="button" onClick={() => handleMovTypeChange(t)}
                            className={`flex-1 py-3 px-4 rounded-xl border-2 text-sm font-semibold transition-all ${movForm.type === t ? MOV_TYPE_COLORS[t] + " border-current" : "bg-white border-neutral-200 text-neutral-500 hover:border-neutral-400"}`}>
                            {MOV_TYPE_LABELS[t]}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-2">
                          {movForm.origin_type === "warehouse" ? "Armazém (origem)" : "Bar (origem)"}
                        </label>
                        <select value={movForm.origin_id} onChange={e => handleMovOriginChange(e.target.value)}
                          className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900">
                          <option value="">Seleciona...</option>
                          {movForm.origin_type === "warehouse"
                            ? warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)
                            : bars.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-2">Bar (destino)</label>
                        <select value={movForm.destination_id} onChange={e => handleMovDestinationChange(e.target.value)}
                          className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900">
                          <option value="">Seleciona...</option>
                          {bars
                            .filter(b => movForm.origin_type !== "bar" || b.id !== movForm.origin_id)
                            .map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-5">
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-2">Dia do Festival</label>
                        <select value={movForm.festival_day} onChange={e => setMovForm(f => ({ ...f, festival_day: e.target.value }))}
                          className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900">
                          {dayNames.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-2">Submetido por</label>
                        <input type="text" value={movForm.submitted_by}
                          onChange={e => setMovForm(f => ({ ...f, submitted_by: e.target.value }))}
                          placeholder="O teu nome"
                          className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
                      </div>
                    </div>

                    {movForm.origin_id && (
                      <div className="mb-5">
                        <label className="block text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-3">Produtos</label>
                        <div className="space-y-2">
                          {movFormItems.map((item, idx) => {
                            const qty = Number(item.quantity);
                            const exceeds = qty > 0 && qty > item.available;
                            return (
                              <div key={item.product_id} className={`bg-white rounded-xl border px-4 py-3 ${exceeds ? "border-amber-300 bg-amber-50" : "border-neutral-100"}`}>
                                <div className="flex items-center gap-4">
                                  <span className="flex-1 text-sm font-medium text-neutral-800">{item.product_name}</span>
                                  <span className="text-xs text-neutral-400 whitespace-nowrap">
                                    Disponível: <span className={`font-semibold ${item.available < 0 ? "text-red-500" : "text-neutral-700"}`}>{item.available}</span>
                                  </span>
                                  <input type="number" min="0" max={item.available > 0 ? item.available : undefined}
                                    placeholder="0" value={item.quantity}
                                    onChange={e => setMovFormItems(prev => prev.map((x, i) => i === idx ? { ...x, quantity: e.target.value } : x))}
                                    onWheel={e => e.target.blur()}
                                    className={`w-20 border rounded-xl px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-neutral-900 ${exceeds ? "border-amber-400 bg-white" : "border-neutral-200"}`} />
                                  <span className="text-xs text-neutral-400 w-10">{item.unit}</span>
                                </div>
                                {exceeds && (
                                  <div className="flex items-center gap-1 text-xs text-amber-700 mt-1.5">
                                    <AlertTriangle className="w-3 h-3" /> Quantidade excede o stock disponível ({item.available})
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {movHasExceeds && (
                          <div className="mt-3 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                            <AlertTriangle className="w-4 h-4 shrink-0" /> Corrige as quantidades acima antes de submeter.
                          </div>
                        )}
                      </div>
                    )}

                    <button onClick={handleMovSubmit} disabled={!canSubmitMov}
                      className="w-full py-3 bg-neutral-900 text-white rounded-xl text-sm font-semibold hover:bg-neutral-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
                      {movSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      Registar Movimento
                    </button>
                  </div>
                )}

                <div className="flex gap-2 mb-4">
                  {[["all","Todos"], ["warehouse_to_bar","Arm→Bar"], ["bar_to_bar","Bar→Bar"]].map(([val, label]) => (
                    <button key={val} onClick={() => setMovFilterTab(val)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${movFilterTab === val ? "bg-neutral-900 text-white" : "bg-white border border-neutral-200 text-neutral-600 hover:border-neutral-400"}`}>
                      {label}
                    </button>
                  ))}
                </div>

                {filteredMovements.length === 0 ? (
                  <div className="text-center py-16 bg-white rounded-2xl border border-neutral-100 shadow-sm text-neutral-300 text-sm">
                    Sem movimentos registados
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredMovements.map(m => (
                      <div key={m.id} className="bg-white rounded-2xl border border-neutral-100 shadow-sm px-6 py-4">
                        <div className="flex items-start gap-4">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border shrink-0 ${MOV_TYPE_COLORS[m.type] || "bg-neutral-100 text-neutral-600 border-neutral-200"}`}>
                            {MOV_TYPE_LABELS[m.type] || m.type}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-neutral-900 text-sm">
                              {m.origin_name} <span className="text-neutral-400 font-normal">→</span> {m.destination_name}
                            </div>
                            <div className="text-xs text-neutral-400 mt-0.5">
                              {m.festival_day}{m.submitted_by ? ` · ${m.submitted_by}` : ""}{m.created_date ? ` · ${new Date(m.created_date).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}` : ""}
                            </div>
                            {(m.items || []).length > 0 && (
                              <div className="flex flex-wrap gap-2 mt-2">
                                {(m.items || []).map((item, i) => (
                                  <span key={i} className="text-xs bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">
                                    {item.product_name}: <span className="font-semibold">{item.quantity}</span> {item.unit}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
