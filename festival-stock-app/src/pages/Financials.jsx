import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, Plus, Trash2, Loader2 } from "lucide-react";
import db from "../lib/db";

const DAYS = ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5"];
const REASONS = [
  { value: "promotion", label: "Promoção" },
  { value: "waste", label: "Desperdício" },
  { value: "staff", label: "Staff" },
  { value: "other", label: "Outro" },
];

function OfferedTab({ bars, products }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [filterBar, setFilterBar] = useState("");
  const [filterDay, setFilterDay] = useState("");
  const [form, setForm] = useState({ bar_id: "", bar_name: "", festival_day: "Day 1", submitted_by: "", notes: "", items: [] });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { db.OfferedItems.list("-created_date", 200).then(r => { setEntries(r); setLoading(false); }); }, []);

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { product_id: "", product_name: "", unit: "units", quantity: "", reason: "promotion" }] }));
  const removeItem = (idx) => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  const updateItem = (idx, field, value) => setForm(f => {
    const items = [...f.items]; items[idx] = { ...items[idx], [field]: value };
    if (field === "product_name") { const prod = products.find(p => p.name === value); if (prod) { items[idx].product_id = prod.id; items[idx].unit = prod.unit || "units"; } }
    return { ...f, items };
  });

  const handleSubmit = async (e) => {
    e.preventDefault(); setSubmitting(true);
    const payload = { ...form, items: form.items.map(i => ({ ...i, quantity: parseFloat(i.quantity) || 0 })).filter(i => i.product_name) };
    const created = await db.OfferedItems.create(payload);
    setEntries(prev => [created, ...prev]);
    setForm({ bar_id: "", bar_name: "", festival_day: "Day 1", submitted_by: "", notes: "", items: [] });
    setShowForm(false); setSubmitting(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Eliminar este registo?")) return;
    setDeletingId(id); await db.OfferedItems.delete(id);
    setEntries(e => e.filter(x => x.id !== id)); setDeletingId(null);
  };

  const filtered = entries.filter(e => (!filterBar || e.bar_id === filterBar) && (!filterDay || e.festival_day === filterDay));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          <select value={filterBar} onChange={e => setFilterBar(e.target.value)} className="border border-neutral-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none">
            <option value="">Todos os Bares</option>
            {bars.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <select value={filterDay} onChange={e => setFilterDay(e.target.value)} className="border border-neutral-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none">
            <option value="">Todos os Dias</option>
            {DAYS.map(d => <option key={d}>{d}</option>)}
          </select>
        </div>
        <button onClick={() => setShowForm(v => !v)} className="inline-flex items-center gap-1.5 px-4 py-2 bg-neutral-900 text-white text-sm font-medium rounded-xl hover:bg-neutral-700 transition-colors">
          <Plus className="w-4 h-4" /> Registar Itens Oferecidos
        </button>
      </div>

      {showForm && (
        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-6 space-y-4">
          <h3 className="font-semibold text-neutral-900">Registar Itens Oferecidos / Ofertas</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-1 block">Bar</label>
                <select required value={form.bar_id} onChange={e => { const bar = bars.find(b => b.id === e.target.value); setForm(f => ({ ...f, bar_id: e.target.value, bar_name: bar?.name || "" })); }}
                  className="w-full border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none">
                  <option value="">Seleciona um bar...</option>
                  {bars.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-1 block">Dia do Festival</label>
                <select value={form.festival_day} onChange={e => setForm(f => ({ ...f, festival_day: e.target.value }))} className="w-full border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none">
                  {DAYS.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-1 block">O teu nome</label>
                <input type="text" value={form.submitted_by} onChange={e => setForm(f => ({ ...f, submitted_by: e.target.value }))} placeholder="Quem está a registar?"
                  className="w-full border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none" />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold uppercase tracking-widest text-neutral-400">Itens</label>
                <button type="button" onClick={addItem} className="text-xs font-medium text-neutral-500 hover:text-neutral-900 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Adicionar</button>
              </div>
              <div className="space-y-2">
                {form.items.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-neutral-50 rounded-xl px-3 py-2">
                    <div className="col-span-4"><input type="text" placeholder="Produto" value={item.product_name} onChange={e => updateItem(idx, "product_name", e.target.value)} list={`fin-products-${idx}`} className="w-full text-sm bg-transparent border-b border-neutral-200 focus:outline-none py-1" /><datalist id={`fin-products-${idx}`}>{products.map(p => <option key={p.id} value={p.name} />)}</datalist></div>
                    <div className="col-span-2"><input type="number" min="0" placeholder="Qty" value={item.quantity} onChange={e => updateItem(idx, "quantity", e.target.value)} className="w-full text-sm bg-transparent border-b border-neutral-200 focus:outline-none py-1" /></div>
                    <div className="col-span-2"><input type="text" placeholder="Unit" value={item.unit} onChange={e => updateItem(idx, "unit", e.target.value)} className="w-full text-sm bg-transparent border-b border-neutral-200 focus:outline-none py-1" /></div>
                    <div className="col-span-3"><select value={item.reason} onChange={e => updateItem(idx, "reason", e.target.value)} className="w-full text-sm bg-transparent border-b border-neutral-200 focus:outline-none py-1">{REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}</select></div>
                    <div className="col-span-1 flex justify-end"><button type="button" onClick={() => removeItem(idx)} className="text-neutral-300 hover:text-red-400"><Trash2 className="w-4 h-4" /></button></div>
                  </div>
                ))}
                {form.items.length === 0 && <p className="text-xs text-center text-neutral-300 py-4 border-2 border-dashed border-neutral-200 rounded-xl">Clica em Adicionar para adicionar itens</p>}
              </div>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-neutral-200 rounded-xl text-sm font-medium text-neutral-600 hover:bg-neutral-50">Cancelar</button>
              <button type="submit" disabled={submitting || !form.bar_id || form.items.length === 0} className="flex-1 py-2.5 bg-neutral-900 text-white rounded-xl text-sm font-semibold hover:bg-neutral-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Guardar Registo
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-neutral-400" /></div> : (
        <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
          {filtered.length === 0 ? <p className="text-center py-12 text-sm text-neutral-300">Ainda sem registos</p> : (
            <div className="divide-y divide-neutral-50">
              {filtered.map(entry => (
                <div key={entry.id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-neutral-900">{entry.bar_name}</span>
                      <span className="text-neutral-400 text-sm ml-2">· {entry.festival_day}</span>
                      {entry.submitted_by && <span className="text-neutral-400 text-xs ml-2">by {entry.submitted_by}</span>}
                    </div>
                    <button onClick={() => handleDelete(entry.id)} disabled={deletingId === entry.id} className="p-2 text-neutral-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40">
                      {deletingId === entry.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(entry.items || []).map((item, i) => (
                      <span key={i} className="text-xs bg-neutral-100 text-neutral-600 rounded-lg px-2 py-1">
                        {item.product_name} × {item.quantity} {item.unit} ({REASONS.find(r => r.value === item.reason)?.label || item.reason})
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Financials() {
  const [bars, setBars] = useState([]);
  const [products, setProducts] = useState([]);
  const [tab, setTab] = useState("offered");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([db.Bar.list(), db.Product.list()]).then(([b, p]) => { setBars(b); setProducts(p); setLoading(false); });
  }, []);

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <Link to="/Dashboard" className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-700 transition-colors mb-8">
          <ChevronLeft className="w-4 h-4" /> Voltar
        </Link>
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-neutral-900">Financeiros</h1>
          <p className="text-neutral-400 mt-1">Controlo de desperdício, ofertas e preços</p>
        </div>
        <div className="flex gap-2 mb-6">
          {[["offered", "Itens Oferecidos"]].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-5 py-2 rounded-xl text-sm font-medium transition-all ${tab === key ? "bg-neutral-900 text-white" : "bg-white border border-neutral-200 text-neutral-600 hover:border-neutral-400"}`}>
              {label}
            </button>
          ))}
        </div>
        {loading ? <div className="text-center py-10 text-neutral-300">A carregar...</div> : (
          tab === "offered" ? <OfferedTab bars={bars} products={products} /> : null
        )}
      </div>
    </div>
  );
}
