import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, Loader2, PackageOpen, Plus, CheckCircle, AlertTriangle } from "lucide-react";
import db, { getFestivalProducts } from "../lib/db";
import { useAuth, useFestivalSettings } from "../lib/AuthContext";

function computeWarehouseStock(warehouse, allMovements) {
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
      if (!stockMap[item.product_name]) {
        stockMap[item.product_name] = { product_id: item.product_id, product_name: item.product_name, unit: item.unit, initial: 0, current: 0 };
      }
      stockMap[item.product_name].current -= Number(item.quantity) || 0;
    }));
  allMovements
    .filter(m => m.type === "restock" && m.destination_id === warehouse.id)
    .forEach(m => (m.items || []).forEach(item => {
      if (!stockMap[item.product_name]) {
        stockMap[item.product_name] = { product_id: item.product_id, product_name: item.product_name, unit: item.unit, initial: 0, current: 0 };
      }
      stockMap[item.product_name].current += Number(item.quantity) || 0;
    }));
  return Object.values(stockMap);
}

export default function WarehousePage() {
  const { role, user, currentFestival } = useAuth();
  const { dayNames } = useFestivalSettings();
  const festivalId = currentFestival?.id;

  const [warehouses, setWarehouses] = useState([]);
  const [movements, setMovements] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [restockWHId, setRestockWHId] = useState(null);
  const [restockDay, setRestockDay] = useState(dayNames[0] || "");
  const [restockItems, setRestockItems] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const canEdit = ["manager", "event_coordinator"].includes(role);

  useEffect(() => {
    if (!festivalId) { setLoading(false); return; }
    Promise.all([
      db.Warehouse.filterByFestival(festivalId),
      db.Movement.filterByFestival(festivalId),
      getFestivalProducts(currentFestival),
    ]).then(([w, m, p]) => {
      setWarehouses(w);
      setMovements(m);
      setProducts(p);
      setLoading(false);
    });
  }, [festivalId]);

  const openRestock = (whId) => {
    const wh = warehouses.find(w => w.id === whId);
    if (!wh) return;
    const stock = computeWarehouseStock(wh, movements);
    // Show all festival products with current stock
    const allItems = products.map(p => {
      const stockItem = stock.find(s => s.product_id === p.id);
      return {
        product_id: p.id,
        product_name: p.name,
        unit: p.unit || "units",
        current: stockItem?.current ?? 0,
        addQty: "",
      };
    });
    setRestockItems(allItems);
    setRestockWHId(whId);
    setRestockDay(dayNames[0] || "");
    setSubmitted(false);
  };

  const handleRestock = async () => {
    const wh = warehouses.find(w => w.id === restockWHId);
    if (!wh) return;
    const items = restockItems
      .filter(i => Number(i.addQty) > 0)
      .map(i => ({ product_id: i.product_id, product_name: i.product_name, unit: i.unit, quantity: Number(i.addQty) }));
    if (items.length === 0) { setRestockWHId(null); return; }
    setSubmitting(true);
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
    setSubmitting(false);
    setRestockWHId(null);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

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
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-neutral-900">Armazém</h1>
            <p className="text-neutral-400 mt-1">{currentFestival?.name} · Stock atual por produto</p>
          </div>
          {submitted && (
            <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-xl">
              <CheckCircle className="w-4 h-4" /> Reabastecimento registado
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-neutral-400" /></div>
        ) : warehouses.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-neutral-100 shadow-sm">
            <PackageOpen className="w-8 h-8 text-neutral-300 mx-auto mb-3" />
            <div className="text-neutral-400 text-sm">Nenhum armazém configurado para este festival.</div>
            <div className="text-xs text-neutral-300 mt-1">Configura os armazéns em Definições Globais → Festival.</div>
          </div>
        ) : (
          <div className="space-y-6">
            {warehouses.map(wh => {
              const stock = computeWarehouseStock(wh, movements);
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
                              {row.current < 0 && (
                                <AlertTriangle className="w-3.5 h-3.5 text-red-400 inline ml-1" />
                              )}
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

                  {/* ── Restock form ── */}
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
                              className="w-28 border border-neutral-200 rounded-xl px-3 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-neutral-900" />
                            <span className="text-xs text-neutral-400 w-10">{item.unit}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-3">
                        <button onClick={handleRestock} disabled={submitting || !restockItems.some(i => Number(i.addQty) > 0)}
                          className="px-5 py-2.5 bg-neutral-900 text-white rounded-xl text-sm font-semibold hover:bg-neutral-700 transition-colors disabled:opacity-40 flex items-center gap-2">
                          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
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
        )}
      </div>
    </div>
  );
}
