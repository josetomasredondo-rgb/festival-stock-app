import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, Plus, Trash2, Pencil, Check, X } from "lucide-react";
import db from "../lib/db";

function BarCard({ bar, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: bar.name, leader_name: bar.leader_name || "", leader_email: bar.leader_email || "", location: bar.location || "" });

  const save = async () => {
    await onUpdate(bar.id, form);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="bg-white rounded-2xl border border-neutral-200 p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {[["name","Nome do Bar *"], ["leader_name","Nome do Responsável"], ["leader_email","Email do Responsável"], ["location","Localização"]].map(([k,l]) => (
            <input key={k} type="text" placeholder={l} value={form[k]}
              onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
              className="border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={save} className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 text-white rounded-lg text-xs font-medium hover:bg-neutral-700"><Check className="w-3.5 h-3.5" /> Guardar</button>
          <button onClick={() => setEditing(false)} className="flex items-center gap-1.5 px-3 py-1.5 border border-neutral-200 rounded-lg text-xs font-medium text-neutral-600 hover:bg-neutral-50"><X className="w-3.5 h-3.5" /> Cancelar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-neutral-100 p-4 flex items-start justify-between shadow-sm">
      <div>
        <div className="font-semibold text-neutral-900">{bar.name}</div>
        {bar.leader_name && <div className="text-sm text-neutral-500 mt-0.5">Responsável: {bar.leader_name}</div>}
        {bar.leader_email && <div className="text-xs text-neutral-400">{bar.leader_email}</div>}
        {bar.location && <div className="text-xs text-neutral-400">{bar.location}</div>}
      </div>
      <div className="flex gap-1 ml-4 shrink-0">
        <button onClick={() => setEditing(true)} className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"><Pencil className="w-4 h-4" /></button>
        <button onClick={() => onDelete(bar.id)} className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

function ProductCard({ product, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: product.name, unit: product.unit || "units", category: product.category || "other", selling_price: product.selling_price || "" });

  const save = async () => {
    await onUpdate(product.id, form);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="bg-white rounded-xl border border-neutral-200 p-4 space-y-3">
        <div className="flex gap-3 flex-wrap">
          <input type="text" placeholder="Nome" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="flex-1 min-w-0 border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
          <input type="text" placeholder="Unidade" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
            className="w-28 border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
          <input type="number" min="0" step="0.01" placeholder="€ preço" value={form.selling_price} onChange={e => setForm(f => ({ ...f, selling_price: e.target.value }))}
            className="w-24 border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
        </div>
        <div className="flex gap-2">
          <button onClick={save} className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 text-white rounded-lg text-xs font-medium hover:bg-neutral-700"><Check className="w-3.5 h-3.5" /> Guardar</button>
          <button onClick={() => setEditing(false)} className="flex items-center gap-1.5 px-3 py-1.5 border border-neutral-200 rounded-lg text-xs font-medium text-neutral-600 hover:bg-neutral-50"><X className="w-3.5 h-3.5" /> Cancelar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-neutral-100 p-4 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-3">
        <div>
          <span className="font-medium text-neutral-900">{product.name}</span>
          <span className="text-neutral-400 text-sm ml-2">({product.unit || "units"})</span>
          {product.selling_price && <span className="text-neutral-400 text-sm ml-2">€{product.selling_price}</span>}
          <span className="ml-2 text-xs text-neutral-300">{product.category}</span>
        </div>
      </div>
      <div className="flex gap-1">
        <button onClick={() => setEditing(true)} className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"><Pencil className="w-4 h-4" /></button>
        <button onClick={() => onDelete(product.id)} className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

export default function Setup() {
  const [tab, setTab] = useState("bars");
  const [bars, setBars] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newBar, setNewBar] = useState({ name: "", leader_name: "", leader_email: "", location: "" });
  const [newProduct, setNewProduct] = useState({ name: "", unit: "units", category: "other", selling_price: "" });

  useEffect(() => {
    Promise.all([db.Bar.list(), db.Product.list()]).then(([b, p]) => { setBars(b); setProducts(p); setLoading(false); });
  }, []);

  const addBar = async () => {
    if (!newBar.name.trim()) return;
    const created = await db.Bar.create({ ...newBar, is_active: true });
    setBars(prev => [created, ...prev]);
    setNewBar({ name: "", leader_name: "", leader_email: "", location: "" });
  };

  const updateBar = async (id, data) => {
    const updated = await db.Bar.update(id, data);
    setBars(prev => prev.map(b => b.id === id ? updated : b));
  };

  const deleteBar = async (id) => {
    if (!window.confirm("Eliminar este bar?")) return;
    await db.Bar.delete(id);
    setBars(prev => prev.filter(b => b.id !== id));
  };

  const addProduct = async () => {
    if (!newProduct.name.trim()) return;
    const created = await db.Product.create({ ...newProduct, selling_price: parseFloat(newProduct.selling_price) || 0 });
    setProducts(prev => [created, ...prev]);
    setNewProduct({ name: "", unit: "units", category: "other", selling_price: "" });
  };

  const updateProduct = async (id, data) => {
    const updated = await db.Product.update(id, { ...data, selling_price: parseFloat(data.selling_price) || 0 });
    setProducts(prev => prev.map(p => p.id === id ? updated : p));
  };

  const deleteProduct = async (id) => {
    if (!window.confirm("Eliminar este produto?")) return;
    await db.Product.delete(id);
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <Link to="/Dashboard" className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-700 transition-colors mb-8">
          <ChevronLeft className="w-4 h-4" /> Voltar
        </Link>
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-neutral-900">Configuração</h1>
          <p className="text-neutral-400 mt-1">Gere os teus bares e catálogo de produtos</p>
        </div>

        <div className="flex gap-2 mb-6">
          {["bars", "products"].map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-xl text-sm font-medium transition-all ${tab === t ? "bg-neutral-900 text-white" : "bg-white border border-neutral-200 text-neutral-600 hover:border-neutral-400"}`}>
              {t === "bars" ? "Bares" : "Produtos"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-10 text-neutral-300">A carregar...</div>
        ) : tab === "bars" ? (
          <div>
            <div className="bg-white rounded-2xl border border-neutral-100 p-5 mb-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-3">Adicionar Novo Bar</div>
              <div className="grid grid-cols-2 gap-3">
                {[["name","Nome do Bar *"], ["leader_name","Nome do Responsável"], ["leader_email","Email do Responsável"], ["location","Localização"]].map(([k,l]) => (
                  <input key={k} type="text" placeholder={l} value={newBar[k]}
                    onChange={e => setNewBar(f => ({ ...f, [k]: e.target.value }))}
                    className="border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
                ))}
              </div>
              <button onClick={addBar} className="mt-3 flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-xl text-sm font-medium hover:bg-neutral-700 transition-colors">
                <Plus className="w-4 h-4" /> Adicionar Bar
              </button>
            </div>
            <div className="space-y-3">
              {bars.map(b => <BarCard key={b.id} bar={b} onUpdate={updateBar} onDelete={deleteBar} />)}
              {bars.length === 0 && <div className="text-center py-10 text-neutral-300 text-sm">Ainda sem bares — adiciona o primeiro bar acima</div>}
            </div>
          </div>
        ) : (
          <div>
            <div className="bg-white rounded-2xl border border-neutral-100 p-5 mb-5 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-3">Adicionar Novo Produto</div>
              <div className="flex gap-3 flex-wrap">
                <input type="text" placeholder="Nome do produto *" value={newProduct.name}
                  onChange={e => setNewProduct(f => ({ ...f, name: e.target.value }))}
                  className="flex-1 min-w-[150px] border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
                <input type="text" placeholder="Unidade (ex: garrafas)" value={newProduct.unit}
                  onChange={e => setNewProduct(f => ({ ...f, unit: e.target.value }))}
                  className="w-36 border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
                <select value={newProduct.category} onChange={e => setNewProduct(f => ({ ...f, category: e.target.value }))}
                  className="w-36 border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 bg-white">
                  {["alcohol","soft_drinks","water","food","other"].map(c => <option key={c} value={c}>{c.replace("_"," ")}</option>)}
                </select>
                <input type="number" min="0" step="0.01" placeholder="€ preço" value={newProduct.selling_price}
                  onChange={e => setNewProduct(f => ({ ...f, selling_price: e.target.value }))}
                  className="w-28 border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
              </div>
              <button onClick={addProduct} className="mt-3 flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-xl text-sm font-medium hover:bg-neutral-700 transition-colors">
                <Plus className="w-4 h-4" /> Adicionar Produto
              </button>
            </div>
            <div className="space-y-2">
              {products.map(p => <ProductCard key={p.id} product={p} onUpdate={updateProduct} onDelete={deleteProduct} />)}
              {products.length === 0 && <div className="text-center py-10 text-neutral-300 text-sm">Ainda sem produtos — adiciona o primeiro produto acima</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
