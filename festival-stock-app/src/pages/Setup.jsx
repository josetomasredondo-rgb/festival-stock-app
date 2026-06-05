import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, Plus, Check, Loader2, X } from "lucide-react";
import db, { getFestivalBars, getFestivalProducts } from "../lib/db";
import { useAuth } from "../lib/AuthContext";

// ── Bar card ──────────────────────────────────────────────────────────────────
function BarItem({ bar, canRemove, onRemove }) {
  return (
    <div className="bg-white rounded-2xl border border-neutral-100 p-4 shadow-sm flex items-start justify-between">
      <div>
        <div className="font-semibold text-neutral-900">{bar.name}</div>
        {bar.leader_name && <div className="text-sm text-neutral-500 mt-0.5">Responsável: {bar.leader_name}</div>}
        {bar.location && <div className="text-xs text-neutral-400">{bar.location}</div>}
      </div>
      {canRemove && (
        <button onClick={() => onRemove(bar.id)}
          className="p-2 text-neutral-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors ml-4 shrink-0">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// ── Product item ──────────────────────────────────────────────────────────────
function ProductItem({ product, canRemove, onRemove }) {
  return (
    <div className="bg-white rounded-xl border border-neutral-100 p-4 shadow-sm flex items-center justify-between">
      <div>
        <span className="font-medium text-neutral-900">{product.name}</span>
        <span className="text-neutral-400 text-sm ml-2">({product.unit || "units"})</span>
        {product.selling_price ? <span className="text-neutral-400 text-sm ml-2">€{product.selling_price}</span> : null}
      </div>
      {canRemove && (
        <button onClick={() => onRemove(product.id)}
          className="p-2 text-neutral-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-colors ml-4 shrink-0">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

// ── Main Setup ────────────────────────────────────────────────────────────────
const TABS = ["bars", "products"];
const TAB_LABELS = { bars: "Bares", products: "Produtos" };

export default function Setup() {
  const { role, currentFestival, setCurrentFestival } = useAuth();
  const { reportTypeLabels } = useFestivalSettings();
  const [tab, setTab] = useState("bars");

  // Festival-assigned bars and products
  const [bars, setBars] = useState([]);
  const [products, setProducts] = useState([]);
  // All global bars and products (for "add existing" dropdowns)
  const [allBars, setAllBars] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const festivalId = currentFestival?.id;
  const canEdit = role === "manager" || role === "event_coordinator";

  // New bar form
  const [showNewBar, setShowNewBar] = useState(false);
  const [newBar, setNewBar] = useState({ name: "", leader_name: "", leader_email: "", location: "" });
  const [savingBar, setSavingBar] = useState(false);

  // New product form
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: "", unit: "units", category: "other", selling_price: "" });
  const [savingProduct, setSavingProduct] = useState(false);


  useEffect(() => {
    if (!festivalId) { setLoading(false); return; }
    Promise.all([
      getFestivalBars(currentFestival),
      getFestivalProducts(currentFestival),
      db.Bar.list(),
      db.Product.list(),
    ]).then(([b, p, ab, ap]) => {
      setBars(b); setProducts(p); setAllBars(ab); setAllProducts(ap);
      setLoading(false);
    });

  }, [festivalId]);

  // ── Helpers: update festival's bar_ids / product_ids ──────────────────────
  const assignBar = async (barId) => {
    const newIds = [...(currentFestival.bar_ids || []), barId];
    const updated = await db.Festival.update(festivalId, { bar_ids: newIds });
    if (updated) {
      setCurrentFestival(updated);
      const bar = allBars.find(b => b.id === barId);
      if (bar) setBars(prev => [...prev, bar]);
    }
  };

  const removeBar = async (barId) => {
    const newIds = (currentFestival.bar_ids || []).filter(id => id !== barId);
    const updated = await db.Festival.update(festivalId, { bar_ids: newIds });
    if (updated) {
      setCurrentFestival(updated);
      setBars(prev => prev.filter(b => b.id !== barId));
    }
  };

  const assignProduct = async (productId) => {
    const newIds = [...(currentFestival.product_ids || []), productId];
    const updated = await db.Festival.update(festivalId, { product_ids: newIds });
    if (updated) {
      setCurrentFestival(updated);
      const product = allProducts.find(p => p.id === productId);
      if (product) setProducts(prev => [...prev, product]);
    }
  };

  const removeProduct = async (productId) => {
    const newIds = (currentFestival.product_ids || []).filter(id => id !== productId);
    const updated = await db.Festival.update(festivalId, { product_ids: newIds });
    if (updated) {
      setCurrentFestival(updated);
      setProducts(prev => prev.filter(p => p.id !== productId));
    }
  };

  // ── Create new bar (global + assign to festival) ───────────────────────────
  const handleCreateBar = async () => {
    if (!newBar.name.trim()) return;
    setSavingBar(true);
    const created = await db.Bar.create({ ...newBar, is_active: true });
    if (created) {
      setAllBars(prev => [created, ...prev]);
      await assignBar(created.id);
      setNewBar({ name: "", leader_name: "", leader_email: "", location: "" });
      setShowNewBar(false);
    }
    setSavingBar(false);
  };

  // ── Create new product (global + assign to festival) ──────────────────────
  const handleCreateProduct = async () => {
    if (!newProduct.name.trim()) return;
    setSavingProduct(true);
    const created = await db.Product.create({ ...newProduct, selling_price: parseFloat(newProduct.selling_price) || 0 });
    if (created) {
      setAllProducts(prev => [created, ...prev]);
      await assignProduct(created.id);
      setNewProduct({ name: "", unit: "units", category: "other", selling_price: "" });
      setShowNewProduct(false);
    }
    setSavingProduct(false);
  };

  const assignedBarIds = bars.map(b => b.id);
  const assignedProductIds = products.map(p => p.id);
  const unassignedBars = allBars.filter(b => !assignedBarIds.includes(b.id));
  const unassignedProducts = allProducts.filter(p => !assignedProductIds.includes(p.id));

  const visibleTabs = TABS;

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <Link to="/Dashboard" className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-700 transition-colors mb-8">
          <ChevronLeft className="w-4 h-4" /> Voltar
        </Link>
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-neutral-900">Configuração</h1>
          <p className="text-neutral-400 mt-1">{currentFestival?.name} · Bares, produtos e etiquetas deste festival</p>
        </div>

        <div className="flex gap-2 mb-6 flex-wrap">
          {visibleTabs.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-xl text-sm font-medium transition-all ${tab === t ? "bg-neutral-900 text-white" : "bg-white border border-neutral-200 text-neutral-600 hover:border-neutral-400"}`}>
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-neutral-400" /></div>
        ) : (
          <>
            {/* ── Bares ── */}
            {tab === "bars" && (
              <div className="space-y-3">
                {/* Assigned bars */}
                {bars.map(b => (
                  <BarItem key={b.id} bar={b} canRemove={canEdit} onRemove={removeBar} />
                ))}

                {bars.length === 0 && !showNewBar && (
                  <div className="text-center py-6 text-neutral-300 text-sm">
                    Sem bares atribuídos a este festival.
                  </div>
                )}

                {canEdit && (
                  <>
                    {/* Assign existing bar */}
                    {unassignedBars.length > 0 && (
                      <select value=""
                        onChange={e => { if (e.target.value) { assignBar(e.target.value); e.target.value = ""; } }}
                        className="w-full border border-neutral-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 text-neutral-500">
                        <option value="">+ Adicionar bar existente...</option>
                        {unassignedBars.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    )}

                    {/* Create new bar form */}
                    {showNewBar ? (
                      <div className="bg-white rounded-2xl border border-neutral-100 p-5 shadow-sm">
                        <div className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-3">Novo Bar</div>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          {[["name","Nome *"], ["leader_name","Responsável"], ["leader_email","Email"], ["location","Localização"]].map(([k,l]) => (
                            <input key={k} type="text" placeholder={l} value={newBar[k]}
                              onChange={e => setNewBar(f => ({ ...f, [k]: e.target.value }))}
                              className="border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={handleCreateBar} disabled={savingBar || !newBar.name.trim()}
                            className="flex items-center gap-1.5 px-4 py-2 bg-neutral-900 text-white rounded-xl text-sm font-medium hover:bg-neutral-700 disabled:opacity-40 transition-colors">
                            {savingBar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            Criar e Adicionar
                          </button>
                          <button onClick={() => setShowNewBar(false)}
                            className="px-4 py-2 border border-neutral-200 rounded-xl text-sm font-medium text-neutral-600 hover:bg-neutral-50">
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setShowNewBar(true)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-neutral-200 rounded-2xl text-sm font-medium text-neutral-400 hover:border-neutral-400 hover:text-neutral-600 transition-all">
                        <Plus className="w-4 h-4" /> Criar novo bar
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── Produtos ── */}
            {tab === "products" && (
              <div className="space-y-2">
                {/* Assigned products */}
                {products.map(p => (
                  <ProductItem key={p.id} product={p} canRemove={canEdit} onRemove={removeProduct} />
                ))}

                {products.length === 0 && !showNewProduct && (
                  <div className="text-center py-6 text-neutral-300 text-sm">
                    Sem produtos atribuídos a este festival.
                  </div>
                )}

                {canEdit && (
                  <>
                    {/* Assign existing product */}
                    {unassignedProducts.length > 0 && (
                      <select value=""
                        onChange={e => { if (e.target.value) { assignProduct(e.target.value); e.target.value = ""; } }}
                        className="w-full border border-neutral-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 text-neutral-500">
                        <option value="">+ Adicionar produto existente...</option>
                        {unassignedProducts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    )}

                    {/* Create new product form */}
                    {showNewProduct ? (
                      <div className="bg-white rounded-2xl border border-neutral-100 p-5 shadow-sm">
                        <div className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-3">Novo Produto</div>
                        <div className="flex gap-3 flex-wrap mb-3">
                          <input type="text" placeholder="Nome *" value={newProduct.name}
                            onChange={e => setNewProduct(f => ({ ...f, name: e.target.value }))}
                            className="flex-1 min-w-[140px] border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
                          <input type="text" placeholder="Unidade" value={newProduct.unit}
                            onChange={e => setNewProduct(f => ({ ...f, unit: e.target.value }))}
                            className="w-28 border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
                          <select value={newProduct.category}
                            onChange={e => setNewProduct(f => ({ ...f, category: e.target.value }))}
                            className="w-36 border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none bg-white">
                            {["alcohol","soft_drinks","water","food","other"].map(c => (
                              <option key={c} value={c}>{c.replace("_"," ")}</option>
                            ))}
                          </select>
                          <input type="number" min="0" step="0.01" placeholder="€ preço" value={newProduct.selling_price}
                            onChange={e => setNewProduct(f => ({ ...f, selling_price: e.target.value }))}
                            className="w-24 border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={handleCreateProduct} disabled={savingProduct || !newProduct.name.trim()}
                            className="flex items-center gap-1.5 px-4 py-2 bg-neutral-900 text-white rounded-xl text-sm font-medium hover:bg-neutral-700 disabled:opacity-40 transition-colors">
                            {savingProduct ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            Criar e Adicionar
                          </button>
                          <button onClick={() => setShowNewProduct(false)}
                            className="px-4 py-2 border border-neutral-200 rounded-xl text-sm font-medium text-neutral-600 hover:bg-neutral-50">
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setShowNewProduct(true)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-neutral-200 rounded-2xl text-sm font-medium text-neutral-400 hover:border-neutral-400 hover:text-neutral-600 transition-all">
                        <Plus className="w-4 h-4" /> Criar novo produto
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

          </>
        )}
      </div>
    </div>
  );
}
