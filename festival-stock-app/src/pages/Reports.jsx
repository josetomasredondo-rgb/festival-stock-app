import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, Loader2, Pencil, Trash2, Plus, Check } from "lucide-react";
import db from "../lib/db";
import { useAuth } from "../lib/AuthContext";

const DAYS = ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5"];
const REPORT_TYPES = [
  { value: "opening", label: "Abertura", color: "bg-blue-100 text-blue-700" },
  { value: "delivery", label: "Entrega", color: "bg-amber-100 text-amber-700" },
  { value: "night_delivery", label: "Entrega Noturna", color: "bg-indigo-100 text-indigo-700" },
  { value: "closing", label: "Fecho", color: "bg-emerald-100 text-emerald-700" },
];

function EditModal({ report, bars, products, onSave, onClose }) {
  const [form, setForm] = useState({ ...report, items: report.items ? [...report.items] : [] });
  const [saving, setSaving] = useState(false);

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { product_id: "", product_name: "", unit: "units", quantity: "", notes: "" }] }));
  const removeItem = (idx) => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  const updateItem = (idx, field, value) => setForm(f => {
    const items = [...f.items];
    items[idx] = { ...items[idx], [field]: value };
    if (field === "product_name") {
      const prod = products.find(p => p.name === value);
      if (prod) { items[idx].product_id = prod.id; items[idx].unit = prod.unit || "units"; }
    }
    return { ...f, items };
  });

  const handleSave = async () => {
    setSaving(true);
    await db.StockReport.update(form.id, { ...form, items: form.items.map(i => ({ ...i, quantity: parseFloat(i.quantity) || 0 })).filter(i => i.product_name) });
    setSaving(false);
    onSave();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4 py-8">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="px-6 py-5 border-b border-neutral-100 flex items-center justify-between">
          <h2 className="font-bold text-neutral-900">Editar Relatório</h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 text-sm">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-2">Bar</label>
              <select value={form.bar_id} onChange={e => { const b = bars.find(b => b.id === e.target.value); setForm(f => ({ ...f, bar_id: e.target.value, bar_name: b?.name || "" })); }}
                className="w-full border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 bg-white">
                {bars.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-2">Tipo</label>
              <select value={form.report_type} onChange={e => setForm(f => ({ ...f, report_type: e.target.value }))}
                className="w-full border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 bg-white">
                {REPORT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-2">Dia do Festival</label>
              <select value={form.festival_day} onChange={e => setForm(f => ({ ...f, festival_day: e.target.value }))}
                className="w-full border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 bg-white">
                {DAYS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-2">Submetido Por</label>
              <input type="text" value={form.submitted_by || ""} onChange={e => setForm(f => ({ ...f, submitted_by: e.target.value }))}
                className="w-full border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-widest text-neutral-400">Produtos</label>
              <button type="button" onClick={addItem} className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-900 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Adicionar
              </button>
            </div>
            <div className="space-y-2">
              {form.items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-neutral-50 rounded-xl px-3 py-2">
                  <div className="col-span-4">
                    <input type="text" placeholder="Produto" value={item.product_name} onChange={e => updateItem(idx, "product_name", e.target.value)}
                      list={`edit-products-${idx}`} className="w-full text-sm bg-transparent border-b border-neutral-200 focus:outline-none focus:border-neutral-900 py-1" />
                    <datalist id={`edit-products-${idx}`}>{products.map(p => <option key={p.id} value={p.name} />)}</datalist>
                  </div>
                  <div className="col-span-3">
                    <input type="number" min="0" placeholder="Qtd" value={item.quantity} onChange={e => updateItem(idx, "quantity", e.target.value)}
                      className="w-full text-sm bg-transparent border-b border-neutral-200 focus:outline-none focus:border-neutral-900 py-1" />
                  </div>
                  <div className="col-span-2">
                    <input type="text" placeholder="Unid." value={item.unit} onChange={e => updateItem(idx, "unit", e.target.value)}
                      className="w-full text-sm bg-transparent border-b border-neutral-200 focus:outline-none focus:border-neutral-900 py-1" />
                  </div>
                  <div className="col-span-2">
                    <input type="text" placeholder="Notas" value={item.notes || ""} onChange={e => updateItem(idx, "notes", e.target.value)}
                      className="w-full text-sm bg-transparent border-b border-neutral-200 focus:outline-none focus:border-neutral-900 py-1" />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button type="button" onClick={() => removeItem(idx)} className="text-neutral-300 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-2">Notas Gerais</label>
            <textarea rows={2} value={form.notes || ""} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 resize-none" />
          </div>
        </div>
        <div className="flex gap-3 px-6 pb-6">
          <button onClick={onClose} className="flex-1 py-2.5 border border-neutral-200 rounded-xl text-sm font-medium text-neutral-600 hover:bg-neutral-50">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 bg-neutral-900 text-white rounded-xl text-sm font-semibold hover:bg-neutral-700 disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {saving ? "A guardar..." : "Guardar Alterações"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Reports() {
  const { currentFestival } = useAuth();
  const [reports, setReports] = useState([]);
  const [bars, setBars] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingReport, setEditingReport] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [filterBar, setFilterBar] = useState("");
  const [filterDay, setFilterDay] = useState("");
  const [filterType, setFilterType] = useState("");

  const festivalId = currentFestival?.id;

  const load = async () => {
    if (!festivalId) { setLoading(false); return; }
    const [r, b, p] = await Promise.all([
      db.StockReport.filterByFestival(festivalId, "-created_date"),
      db.Bar.filterByFestival(festivalId),
      db.Product.list(),
    ]);
    setReports(r); setBars(b); setProducts(p); setLoading(false);
  };

  useEffect(() => { load(); }, [festivalId]);

  const handleDelete = async (id) => {
    if (!window.confirm("Eliminar este relatório? Esta ação não pode ser desfeita.")) return;
    setDeletingId(id);
    await db.StockReport.delete(id);
    setReports(r => r.filter(x => x.id !== id));
    setDeletingId(null);
  };

  const handleSaved = async () => {
    setEditingReport(null);
    const r = await db.StockReport.filterByFestival(festivalId, "-created_date");
    setReports(r);
  };

  const filtered = reports.filter(r =>
    (!filterBar || r.bar_id === filterBar) &&
    (!filterDay || r.festival_day === filterDay) &&
    (!filterType || r.report_type === filterType)
  );

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <Link to="/Dashboard" className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-700 transition-colors mb-8">
          <ChevronLeft className="w-4 h-4" /> Voltar
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-neutral-900">Relatórios</h1>
            <p className="text-neutral-400 mt-1">{currentFestival?.name} · Ver e editar relatórios de stock submetidos</p>
          </div>
          <span className="text-sm text-neutral-400">{filtered.length} relatório{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        <div className="flex flex-wrap gap-3 mb-6">
          <select value={filterBar} onChange={e => setFilterBar(e.target.value)}
            className="border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none bg-white">
            <option value="">Todos os Bares</option>
            {bars.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select value={filterDay} onChange={e => setFilterDay(e.target.value)}
            className="border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none bg-white">
            <option value="">Todos os Dias</option>
            {DAYS.map(d => <option key={d}>{d}</option>)}
          </select>
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className="border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none bg-white">
            <option value="">Todos os Tipos</option>
            {REPORT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          {(filterBar || filterDay || filterType) && (
            <button onClick={() => { setFilterBar(""); setFilterDay(""); setFilterType(""); }}
              className="text-xs text-neutral-400 hover:text-neutral-700 border border-neutral-200 rounded-xl px-3 py-2 bg-white transition-colors">
              Limpar filtros
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-neutral-400" /></div>
        ) : (
          <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
            {filtered.length === 0 ? (
              <div className="text-center py-16 text-neutral-300 text-sm">Nenhum relatório encontrado</div>
            ) : (
              <div className="divide-y divide-neutral-50">
                {filtered.map(r => {
                  const typeInfo = REPORT_TYPES.find(t => t.value === r.report_type);
                  return (
                    <div key={r.id} className="flex items-center justify-between px-6 py-4 hover:bg-neutral-50 transition-colors">
                      <div className="flex items-center gap-4 min-w-0">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${typeInfo?.color || "bg-neutral-100 text-neutral-600"}`}>
                          {typeInfo?.label || r.report_type}
                        </span>
                        <div className="min-w-0">
                          <div className="font-medium text-neutral-900 truncate">{r.bar_name}</div>
                          <div className="text-xs text-neutral-400 mt-0.5">{r.festival_day} · {r.report_date}{r.submitted_by ? ` · por ${r.submitted_by}` : ""}</div>
                        </div>
                        <div className="hidden sm:block text-xs text-neutral-300 shrink-0">{r.items?.length || 0} produto{r.items?.length !== 1 ? "s" : ""}</div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <button onClick={() => setEditingReport(r)} className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(r.id)} disabled={deletingId === r.id}
                          className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40">
                          {deletingId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
      {editingReport && <EditModal report={editingReport} bars={bars} products={products} onSave={handleSaved} onClose={() => setEditingReport(null)} />}
    </div>
  );
}
