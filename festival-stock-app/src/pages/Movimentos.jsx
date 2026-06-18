import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, Loader2, Plus, AlertTriangle, CheckCircle, X } from "lucide-react";
import db, { getFestivalBars, getFestivalProducts } from "../lib/db";
import { useAuth, useFestivalSettings } from "../lib/AuthContext";

// ── Stock helpers ─────────────────────────────────────────────────────────────
function computeWarehouseStock(warehouse, allMovements) {
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

// ── Type config ───────────────────────────────────────────────────────────────
const TYPE_LABELS = { warehouse_to_bar: "Armazém → Bar", bar_to_bar: "Bar → Bar", restock: "Reabastecimento" };
const TYPE_COLORS = {
  warehouse_to_bar: "bg-emerald-100 text-emerald-700 border-emerald-200",
  bar_to_bar: "bg-purple-100 text-purple-700 border-purple-200",
  restock: "bg-blue-100 text-blue-700 border-blue-200",
};

export default function Movimentos() {
  const { role, user, currentFestival } = useAuth();
  const { dayNames } = useFestivalSettings();
  const festivalId = currentFestival?.id;

  const [bars, setBars] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [reports, setReports] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filterTab, setFilterTab] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [form, setForm] = useState({
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
  const [formItems, setFormItems] = useState([]);

  useEffect(() => {
    if (!festivalId) { setLoading(false); return; }
    Promise.all([
      getFestivalBars(currentFestival),
      db.Warehouse.filterByFestival(festivalId),
      getFestivalProducts(currentFestival),
      db.StockReport.filterByFestival(festivalId),
      db.Movement.filterByFestival(festivalId, "-created_date"),
    ]).then(([b, w, p, r, m]) => {
      setBars(b.filter(bar => bar.is_active !== false));
      setWarehouses(w);
      setProducts(p);
      setReports(r);
      setMovements(m);
      setLoading(false);
    });
  }, [festivalId]);

  // Recompute available stock when origin or day changes
  useEffect(() => {
    if (!form.origin_id) {
      setFormItems(products.map(p => ({ product_id: p.id, product_name: p.name, unit: p.unit || "units", quantity: "", available: 0 })));
      return;
    }
    let availMap = {};
    if (form.origin_type === "warehouse") {
      const wh = warehouses.find(w => w.id === form.origin_id);
      if (wh) availMap = computeWarehouseStock(wh, movements);
    } else {
      availMap = computeBarStock(form.origin_id, form.festival_day, reports, movements);
    }
    setFormItems(products.map(p => ({
      product_id: p.id,
      product_name: p.name,
      unit: p.unit || "units",
      quantity: "",
      available: availMap[p.id]?.current ?? 0,
    })));
  }, [form.origin_id, form.origin_type, form.festival_day, warehouses, movements, reports, products]);

  const handleTypeChange = (type) => {
    setForm(f => ({
      ...f,
      type,
      origin_type: type === "warehouse_to_bar" ? "warehouse" : "bar",
      origin_id: "",
      origin_name: "",
      destination_id: "",
      destination_name: "",
    }));
  };

  const handleOriginChange = (id) => {
    let name = "";
    if (form.origin_type === "warehouse") name = warehouses.find(w => w.id === id)?.name || "";
    else name = bars.find(b => b.id === id)?.name || "";
    setForm(f => ({ ...f, origin_id: id, origin_name: name }));
  };

  const handleDestinationChange = (id) => {
    const name = bars.find(b => b.id === id)?.name || "";
    setForm(f => ({ ...f, destination_id: id, destination_name: name }));
  };

  const hasExceeds = formItems.some(i => Number(i.quantity) > 0 && Number(i.quantity) > i.available);
  const hasItems = formItems.some(i => Number(i.quantity) > 0);
  const canSubmit = !submitting && !hasExceeds && hasItems && form.origin_id && form.destination_id;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    const items = formItems
      .filter(i => Number(i.quantity) > 0)
      .map(i => ({ product_id: i.product_id, product_name: i.product_name, unit: i.unit, quantity: Number(i.quantity) }));
    const created = await db.Movement.create({
      festival_id: festivalId,
      festival_day: form.festival_day,
      type: form.type,
      origin_type: form.origin_type,
      origin_id: form.origin_id,
      origin_name: form.origin_name,
      destination_type: "bar",
      destination_id: form.destination_id,
      destination_name: form.destination_name,
      items,
      submitted_by: form.submitted_by,
    });
    if (created) setMovements(prev => [created, ...prev]);
    setSubmitting(false);
    setShowForm(false);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
    setForm(f => ({ ...f, origin_id: "", origin_name: "", destination_id: "", destination_name: "" }));
  };

  const filtered = movements.filter(m => {
    if (filterTab === "warehouse_to_bar") return m.type === "warehouse_to_bar";
    if (filterTab === "bar_to_bar") return m.type === "bar_to_bar";
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
        <div className="mb-8 flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-neutral-900">Movimentos</h1>
            <p className="text-neutral-400 mt-1">{currentFestival?.name} · Transferências de stock</p>
          </div>
          <div className="flex items-center gap-3">
            {submitted && (
              <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-xl">
                <CheckCircle className="w-4 h-4" /> Movimento registado
              </div>
            )}
            {!showForm && (
              <button onClick={() => setShowForm(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-neutral-900 text-white rounded-xl text-sm font-semibold hover:bg-neutral-700 transition-colors">
                <Plus className="w-4 h-4" /> Novo Movimento
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-neutral-400" /></div>
        ) : (
          <>
            {/* ── New Movement Form ── */}
            {showForm && (
              <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-6 mb-6">
                <div className="flex items-center justify-between mb-5">
                  <div className="text-xs font-semibold uppercase tracking-widest text-neutral-400">Novo Movimento</div>
                  <button onClick={() => setShowForm(false)} className="p-1.5 text-neutral-400 hover:text-neutral-700 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Type selector */}
                <div className="mb-5">
                  <label className="block text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-3">Tipo</label>
                  <div className="flex gap-2">
                    {["warehouse_to_bar", "bar_to_bar"].map(t => (
                      <button key={t} type="button" onClick={() => handleTypeChange(t)}
                        className={`flex-1 py-3 px-4 rounded-xl border-2 text-sm font-semibold transition-all ${form.type === t ? TYPE_COLORS[t] + " border-current" : "bg-white border-neutral-200 text-neutral-500 hover:border-neutral-400"}`}>
                        {TYPE_LABELS[t]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  {/* Origin */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-2">
                      {form.origin_type === "warehouse" ? "Armazém (origem)" : "Bar (origem)"}
                    </label>
                    <select value={form.origin_id} onChange={e => handleOriginChange(e.target.value)}
                      className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900">
                      <option value="">Seleciona...</option>
                      {form.origin_type === "warehouse"
                        ? warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)
                        : bars.map(b => <option key={b.id} value={b.id}>{b.name}</option>)
                      }
                    </select>
                  </div>
                  {/* Destination */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-2">Bar (destino)</label>
                    <select value={form.destination_id} onChange={e => handleDestinationChange(e.target.value)}
                      className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900">
                      <option value="">Seleciona...</option>
                      {bars
                        .filter(b => form.origin_type !== "bar" || b.id !== form.origin_id)
                        .map(b => <option key={b.id} value={b.id}>{b.name}</option>)
                      }
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-5">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-2">Dia do Festival</label>
                    <select value={form.festival_day} onChange={e => setForm(f => ({ ...f, festival_day: e.target.value }))}
                      className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900">
                      {dayNames.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-2">Submetido por</label>
                    <input type="text" value={form.submitted_by}
                      onChange={e => setForm(f => ({ ...f, submitted_by: e.target.value }))}
                      placeholder="O teu nome"
                      className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
                  </div>
                </div>

                {/* Products */}
                {form.origin_id && (
                  <div className="mb-5">
                    <label className="block text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-3">Produtos</label>
                    <div className="space-y-2">
                      {formItems.map((item, idx) => {
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
                                placeholder="0"
                                value={item.quantity}
                                onChange={e => setFormItems(prev => prev.map((x, i) => i === idx ? { ...x, quantity: e.target.value } : x))}
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
                    {hasExceeds && (
                      <div className="mt-3 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                        <AlertTriangle className="w-4 h-4 shrink-0" /> Corrige as quantidades acima antes de submeter.
                      </div>
                    )}
                  </div>
                )}

                <button onClick={handleSubmit} disabled={!canSubmit}
                  className="w-full py-3 bg-neutral-900 text-white rounded-xl text-sm font-semibold hover:bg-neutral-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-2">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Registar Movimento
                </button>
              </div>
            )}

            {/* ── Filter tabs ── */}
            <div className="flex gap-2 mb-4">
              {[["all","Todos"], ["warehouse_to_bar","Arm→Bar"], ["bar_to_bar","Bar→Bar"]].map(([val, label]) => (
                <button key={val} onClick={() => setFilterTab(val)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${filterTab === val ? "bg-neutral-900 text-white" : "bg-white border border-neutral-200 text-neutral-600 hover:border-neutral-400"}`}>
                  {label}
                </button>
              ))}
            </div>

            {/* ── Movement list ── */}
            {filtered.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-neutral-100 shadow-sm text-neutral-300 text-sm">
                Sem movimentos registados
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map(m => (
                  <div key={m.id} className="bg-white rounded-2xl border border-neutral-100 shadow-sm px-6 py-4">
                    <div className="flex items-start gap-4">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border shrink-0 ${TYPE_COLORS[m.type] || "bg-neutral-100 text-neutral-600 border-neutral-200"}`}>
                        {TYPE_LABELS[m.type] || m.type}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-neutral-900 text-sm">
                          {m.origin_name} <span className="text-neutral-400 font-normal">→</span> {m.destination_name}
                        </div>
                        <div className="text-xs text-neutral-400 mt-0.5">
                          {m.festival_day}{m.submitted_by ? ` · ${m.submitted_by}` : ""} · {m.created_date ? new Date(m.created_date).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" }) : ""}
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
      </div>
    </div>
  );
}
