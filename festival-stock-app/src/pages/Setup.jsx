import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, Plus, Trash2, Pencil, Check, X, Loader2 } from "lucide-react";
import db from "../lib/db";
import { useAuth, ROLE_LABELS, useFestivalSettings, DEFAULT_SETTINGS } from "../lib/AuthContext";

// ── Bar card ────────────────────────────────────────────────────────────────
function BarCard({ bar, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: bar.name, leader_name: bar.leader_name || "", leader_email: bar.leader_email || "", location: bar.location || "" });

  const save = async () => { await onUpdate(bar.id, form); setEditing(false); };

  if (editing) return (
    <div className="bg-white rounded-2xl border border-neutral-200 p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {[["name","Nome do Bar *"], ["leader_name","Nome do Responsável"], ["leader_email","Email"], ["location","Localização"]].map(([k,l]) => (
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

  return (
    <div className="bg-white rounded-2xl border border-neutral-100 p-4 flex items-start justify-between shadow-sm">
      <div>
        <div className="font-semibold text-neutral-900">{bar.name}</div>
        {bar.leader_name && <div className="text-sm text-neutral-500 mt-0.5">Responsável: {bar.leader_name}</div>}
        {bar.location && <div className="text-xs text-neutral-400">{bar.location}</div>}
      </div>
      <div className="flex gap-1 ml-4 shrink-0">
        <button onClick={() => setEditing(true)} className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"><Pencil className="w-4 h-4" /></button>
        <button onClick={() => onDelete(bar.id)} className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

// ── Product card ─────────────────────────────────────────────────────────────
function ProductCard({ product, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: product.name, unit: product.unit || "units", category: product.category || "other", selling_price: product.selling_price || "" });

  const save = async () => { await onUpdate(product.id, form); setEditing(false); };

  if (editing) return (
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

  return (
    <div className="bg-white rounded-xl border border-neutral-100 p-4 flex items-center justify-between shadow-sm">
      <div>
        <span className="font-medium text-neutral-900">{product.name}</span>
        <span className="text-neutral-400 text-sm ml-2">({product.unit || "units"})</span>
        {product.selling_price ? <span className="text-neutral-400 text-sm ml-2">€{product.selling_price}</span> : null}
        <span className="ml-2 text-xs text-neutral-300">{product.category}</span>
      </div>
      <div className="flex gap-1">
        <button onClick={() => setEditing(true)} className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"><Pencil className="w-4 h-4" /></button>
        <button onClick={() => onDelete(product.id)} className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

// ── User card ─────────────────────────────────────────────────────────────────
function UserCard({ appUser, bars, festivals, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: appUser.name, pin: appUser.pin, role: appUser.role,
    festival_ids: appUser.festival_ids || [], bar_id: appUser.bar_id || ""
  });

  const toggleFestival = (id) => {
    setForm(f => ({
      ...f,
      festival_ids: f.festival_ids.includes(id)
        ? f.festival_ids.filter(x => x !== id)
        : [...f.festival_ids, id]
    }));
  };

  const save = async () => { await onUpdate(appUser.id, form); setEditing(false); };

  if (editing) return (
    <div className="bg-white rounded-2xl border border-neutral-200 p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <input type="text" placeholder="Nome *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          className="border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
        <input type="text" placeholder="PIN *" value={form.pin} onChange={e => setForm(f => ({ ...f, pin: e.target.value }))}
          className="border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
        <div>
          <label className="block text-xs text-neutral-400 mb-1">Perfil</label>
          <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
            className="w-full border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 bg-white">
            {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-neutral-400 mb-1">Bar atribuído</label>
          <select value={form.bar_id} onChange={e => setForm(f => ({ ...f, bar_id: e.target.value }))}
            className="w-full border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 bg-white">
            <option value="">Nenhum</option>
            {bars.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs text-neutral-400 mb-2">Festivais atribuídos</label>
        <div className="flex flex-wrap gap-2">
          {festivals.map(f => (
            <button key={f.id} type="button" onClick={() => toggleFestival(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${form.festival_ids.includes(f.id) ? "bg-neutral-900 text-white border-neutral-900" : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400"}`}>
              {f.name}
            </button>
          ))}
          {festivals.length === 0 && <span className="text-xs text-neutral-300">Nenhum festival criado ainda</span>}
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={save} className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 text-white rounded-lg text-xs font-medium hover:bg-neutral-700"><Check className="w-3.5 h-3.5" /> Guardar</button>
        <button onClick={() => setEditing(false)} className="flex items-center gap-1.5 px-3 py-1.5 border border-neutral-200 rounded-lg text-xs font-medium text-neutral-600 hover:bg-neutral-50"><X className="w-3.5 h-3.5" /> Cancelar</button>
      </div>
    </div>
  );

  const assignedBar = bars.find(b => b.id === appUser.bar_id);
  const assignedFestivals = festivals.filter(f => (appUser.festival_ids || []).includes(f.id));
  return (
    <div className="bg-white rounded-2xl border border-neutral-100 p-4 flex items-start justify-between shadow-sm">
      <div>
        <div className="font-semibold text-neutral-900">{appUser.name}</div>
        <div className="text-xs text-neutral-500 mt-0.5">{ROLE_LABELS[appUser.role] || appUser.role} · PIN: {appUser.pin}</div>
        {assignedBar && <div className="text-xs text-neutral-400 mt-0.5">Bar: {assignedBar.name}</div>}
        {assignedFestivals.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {assignedFestivals.map(f => <span key={f.id} className="text-xs bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">{f.name}</span>)}
          </div>
        )}
      </div>
      <div className="flex gap-1 ml-4 shrink-0">
        <button onClick={() => setEditing(true)} className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"><Pencil className="w-4 h-4" /></button>
        <button onClick={() => onDelete(appUser.id)} className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

// ── Main Setup ────────────────────────────────────────────────────────────────
const TABS = ["bars", "products", "users", "festivals", "settings"];
const TAB_LABELS = { bars: "Bares", products: "Produtos", users: "Utilizadores", festivals: "Festivais", settings: "Configurações" };

export default function Setup() {
  const { role, currentFestival, setCurrentFestival } = useAuth();
  const [tab, setTab] = useState("bars");
  const [bars, setBars] = useState([]);
  const [allBars, setAllBars] = useState([]); // all bars across festivals for user assignment
  const [products, setProducts] = useState([]);
  const [appUsers, setAppUsers] = useState([]);
  const [festivals, setFestivals] = useState([]);
  const [loading, setLoading] = useState(true);

  const festivalId = currentFestival?.id;
  const isManager = role === "manager";

  // Form state
  const [newBar, setNewBar] = useState({ name: "", leader_name: "", leader_email: "", location: "" });
  const [newProduct, setNewProduct] = useState({ name: "", unit: "units", category: "other", selling_price: "" });
  const [newUser, setNewUser] = useState({ name: "", pin: "", role: "bar_leader", festival_ids: [], bar_id: "" });
  const [newFestival, setNewFestival] = useState({ name: "", start_date: "", end_date: "", num_days: 5 });
  const [settingsForm, setSettingsForm] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    const loads = [db.Product.list(), db.Festival.list(), db.AppUser.list(), db.Bar.list()];
    if (festivalId) loads.unshift(db.Bar.filterByFestival(festivalId));
    Promise.all(festivalId
      ? [db.Bar.filterByFestival(festivalId), db.Product.list(), db.Festival.list(), db.AppUser.list(), db.Bar.list()]
      : [Promise.resolve([]), db.Product.list(), db.Festival.list(), db.AppUser.list(), db.Bar.list()]
    ).then(([fb, p, fests, users, ab]) => {
      setBars(fb); setProducts(p); setFestivals(fests); setAppUsers(users); setAllBars(ab); setLoading(false);
      const s = currentFestival?.settings || {};
      const numDays = s.num_days || DEFAULT_SETTINGS.num_days;
      setSettingsForm({
        num_days: numDays,
        day_names: Array.from({ length: numDays }, (_, i) => s.day_names?.[i] || DEFAULT_SETTINGS.day_names[i] || `Dia ${i + 1}`),
        report_type_labels: { ...DEFAULT_SETTINGS.report_type_labels, ...(s.report_type_labels || {}) },
      });
    });
  }, [festivalId]);

  // ── Bars ──
  const addBar = async () => {
    if (!newBar.name.trim()) return;
    const created = await db.Bar.create({ ...newBar, is_active: true, festival_id: festivalId });
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

  // ── Products ──
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

  // ── Users ──
  const addUser = async () => {
    if (!newUser.name.trim() || !newUser.pin.trim()) return;
    const created = await db.AppUser.create(newUser);
    setAppUsers(prev => [created, ...prev]);
    setNewUser({ name: "", pin: "", role: "bar_leader", festival_ids: [], bar_id: "" });
  };
  const updateUser = async (id, data) => {
    const updated = await db.AppUser.update(id, data);
    setAppUsers(prev => prev.map(u => u.id === id ? updated : u));
  };
  const deleteUser = async (id) => {
    if (!window.confirm("Eliminar este utilizador?")) return;
    await db.AppUser.delete(id);
    setAppUsers(prev => prev.filter(u => u.id !== id));
  };

  // ── Festivals ──
  const addFestival = async () => {
    if (!newFestival.name.trim()) return;
    const { num_days, ...rest } = newFestival;
    const created = await db.Festival.create({ ...rest, is_active: true, is_closed: false, settings: { num_days } });
    setFestivals(prev => [created, ...prev]);
    setNewFestival({ name: "", start_date: "", end_date: "", num_days: 5 });
  };

  const updateFestivalNumDays = async (id, numDays, festival) => {
    const updated = await db.Festival.update(id, { settings: { ...(festival.settings || {}), num_days: numDays } });
    if (!updated) return;
    setFestivals(prev => prev.map(f => f.id === id ? updated : f));
    if (id === festivalId) setCurrentFestival(updated);
  };
  const closeFestival = async (id) => {
    if (!window.confirm("Fechar este festival?")) return;
    await db.Festival.update(id, { is_closed: true, is_active: false });
    setFestivals(prev => prev.map(f => f.id === id ? { ...f, is_closed: true, is_active: false } : f));
  };
  const reopenFestival = async (id) => {
    await db.Festival.update(id, { is_closed: false, is_active: true });
    setFestivals(prev => prev.map(f => f.id === id ? { ...f, is_closed: false, is_active: true } : f));
  };

  const handleNumDaysChange = (n) => {
    const num = Math.max(1, Math.min(10, Number(n)));
    setSettingsForm(f => ({
      ...f,
      num_days: num,
      day_names: Array.from({ length: num }, (_, i) => f.day_names[i] || `Dia ${i + 1}`),
    }));
  };

  const handleSaveSettings = async () => {
    if (!festivalId || !settingsForm) return;
    setSavingSettings(true);
    const updated = await db.Festival.update(festivalId, { settings: settingsForm });
    if (updated) setCurrentFestival(updated);
    setSavingSettings(false);
  };

  const visibleTabs = isManager ? TABS : TABS.filter(t => !["users", "festivals", "settings"].includes(t));

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <Link to="/Dashboard" className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-700 transition-colors mb-8">
          <ChevronLeft className="w-4 h-4" /> Voltar
        </Link>
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-neutral-900">Configuração</h1>
          <p className="text-neutral-400 mt-1">Gere bares, produtos, utilizadores e festivais</p>
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
            {/* ── Bars tab ── */}
            {tab === "bars" && (
              <div>
                <div className="bg-white rounded-2xl border border-neutral-100 p-5 mb-5 shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-3">Adicionar Novo Bar</div>
                  {!festivalId && <p className="text-sm text-amber-600 mb-3">Seleciona um festival primeiro para adicionar bares.</p>}
                  <div className="grid grid-cols-2 gap-3">
                    {[["name","Nome do Bar *"], ["leader_name","Nome do Responsável"], ["leader_email","Email"], ["location","Localização"]].map(([k,l]) => (
                      <input key={k} type="text" placeholder={l} value={newBar[k]}
                        onChange={e => setNewBar(f => ({ ...f, [k]: e.target.value }))}
                        className="border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
                    ))}
                  </div>
                  <button onClick={addBar} disabled={!festivalId}
                    className="mt-3 flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-xl text-sm font-medium hover:bg-neutral-700 transition-colors disabled:opacity-40">
                    <Plus className="w-4 h-4" /> Adicionar Bar
                  </button>
                </div>
                <div className="space-y-3">
                  {bars.map(b => <BarCard key={b.id} bar={b} onUpdate={updateBar} onDelete={deleteBar} />)}
                  {bars.length === 0 && <div className="text-center py-10 text-neutral-300 text-sm">Ainda sem bares — adiciona o primeiro bar acima</div>}
                </div>
              </div>
            )}

            {/* ── Products tab ── */}
            {tab === "products" && (
              <div>
                <div className="bg-white rounded-2xl border border-neutral-100 p-5 mb-5 shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-3">Adicionar Novo Produto</div>
                  <div className="flex gap-3 flex-wrap">
                    <input type="text" placeholder="Nome do produto *" value={newProduct.name}
                      onChange={e => setNewProduct(f => ({ ...f, name: e.target.value }))}
                      className="flex-1 min-w-[150px] border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
                    <input type="text" placeholder="Unidade" value={newProduct.unit}
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
                  {products.length === 0 && <div className="text-center py-10 text-neutral-300 text-sm">Ainda sem produtos</div>}
                </div>
              </div>
            )}

            {/* ── Users tab (manager only) ── */}
            {tab === "users" && isManager && (
              <div>
                <div className="bg-white rounded-2xl border border-neutral-100 p-5 mb-5 shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-3">Adicionar Utilizador</div>
                  <div className="grid grid-cols-2 gap-3">
                    <input type="text" placeholder="Nome *" value={newUser.name}
                      onChange={e => setNewUser(f => ({ ...f, name: e.target.value }))}
                      className="border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
                    <input type="text" placeholder="PIN *" value={newUser.pin}
                      onChange={e => setNewUser(f => ({ ...f, pin: e.target.value }))}
                      className="border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
                    <div>
                      <label className="block text-xs text-neutral-400 mb-1">Perfil</label>
                      <select value={newUser.role} onChange={e => setNewUser(f => ({ ...f, role: e.target.value }))}
                        className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none bg-white">
                        {Object.entries(ROLE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-400 mb-1">Bar atribuído</label>
                      <select value={newUser.bar_id} onChange={e => setNewUser(f => ({ ...f, bar_id: e.target.value }))}
                        className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none bg-white">
                        <option value="">Nenhum</option>
                        {allBars.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="block text-xs text-neutral-400 mb-2">Festivais atribuídos</label>
                    <div className="flex flex-wrap gap-2">
                      {festivals.map(f => (
                        <button key={f.id} type="button"
                          onClick={() => setNewUser(u => ({
                            ...u, festival_ids: u.festival_ids.includes(f.id)
                              ? u.festival_ids.filter(x => x !== f.id)
                              : [...u.festival_ids, f.id]
                          }))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${newUser.festival_ids.includes(f.id) ? "bg-neutral-900 text-white border-neutral-900" : "bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400"}`}>
                          {f.name}
                        </button>
                      ))}
                      {festivals.length === 0 && <span className="text-xs text-neutral-300">Nenhum festival criado ainda</span>}
                    </div>
                  </div>
                  <button onClick={addUser} disabled={!newUser.name.trim() || !newUser.pin.trim()}
                    className="mt-3 flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-xl text-sm font-medium hover:bg-neutral-700 transition-colors disabled:opacity-40">
                    <Plus className="w-4 h-4" /> Adicionar Utilizador
                  </button>
                </div>
                <div className="space-y-3">
                  {appUsers.map(u => <UserCard key={u.id} appUser={u} bars={allBars} festivals={festivals} onUpdate={updateUser} onDelete={deleteUser} />)}
                  {appUsers.length === 0 && <div className="text-center py-10 text-neutral-300 text-sm">Nenhum utilizador criado ainda</div>}
                </div>
              </div>
            )}

            {/* ── Festivals tab (manager only) ── */}
            {tab === "festivals" && isManager && (
              <div>
                <div className="bg-white rounded-2xl border border-neutral-100 p-5 mb-5 shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-3">Criar Festival</div>
                  <div className="space-y-3">
                    <input type="text" placeholder="Nome do festival *" value={newFestival.name}
                      onChange={e => setNewFestival(f => ({ ...f, name: e.target.value }))}
                      className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs text-neutral-400 mb-1">Data início</label>
                        <input type="date" value={newFestival.start_date}
                          onChange={e => setNewFestival(f => ({ ...f, start_date: e.target.value }))}
                          className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
                      </div>
                      <div>
                        <label className="block text-xs text-neutral-400 mb-1">Data fim</label>
                        <input type="date" value={newFestival.end_date}
                          onChange={e => setNewFestival(f => ({ ...f, end_date: e.target.value }))}
                          className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
                      </div>
                      <div>
                        <label className="block text-xs text-neutral-400 mb-1">Nº de dias</label>
                        <input type="number" min={1} max={10} value={newFestival.num_days}
                          onChange={e => setNewFestival(f => ({ ...f, num_days: Math.max(1, Math.min(10, Number(e.target.value))) }))}
                          className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900 text-center" />
                      </div>
                    </div>
                  </div>
                  <button onClick={addFestival} disabled={!newFestival.name.trim()}
                    className="mt-3 flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-xl text-sm font-medium hover:bg-neutral-700 transition-colors disabled:opacity-40">
                    <Plus className="w-4 h-4" /> Criar Festival
                  </button>
                </div>
                <div className="space-y-3">
                  {festivals.map(f => (
                    <div key={f.id} className="bg-white rounded-2xl border border-neutral-100 p-4 flex items-start justify-between shadow-sm">
                      <div>
                        <div className="font-semibold text-neutral-900 flex items-center gap-2">
                          {f.name}
                          {f.is_closed
                            ? <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Fechado</span>
                            : <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Ativo</span>}
                        </div>
                        {f.start_date && <div className="text-xs text-neutral-400 mt-0.5">{f.start_date}{f.end_date ? ` → ${f.end_date}` : ""}</div>}
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-neutral-400">Nº de dias:</span>
                          <input
                            type="number" min={1} max={10}
                            defaultValue={f.settings?.num_days || 5}
                            onBlur={e => updateFestivalNumDays(f.id, Math.max(1, Math.min(10, Number(e.target.value))), f)}
                            className="w-16 border border-neutral-200 rounded-lg px-2 py-1 text-xs text-center focus:outline-none focus:ring-2 focus:ring-neutral-900"
                          />
                        </div>
                      </div>
                      <div className="flex gap-1 ml-4">
                        {f.is_closed
                          ? <button onClick={() => reopenFestival(f.id)} className="px-3 py-1.5 border border-neutral-200 rounded-lg text-xs font-medium text-neutral-600 hover:bg-neutral-50">Reabrir</button>
                          : <button onClick={() => closeFestival(f.id)} className="px-3 py-1.5 border border-red-200 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50">Fechar</button>}
                      </div>
                    </div>
                  ))}
                  {festivals.length === 0 && <div className="text-center py-10 text-neutral-300 text-sm">Nenhum festival criado ainda</div>}
                </div>
              </div>
            )}

            {/* ── Settings tab (manager only) ── */}
            {tab === "settings" && isManager && settingsForm && (
              <div className="space-y-6">
                {!festivalId && (
                  <p className="text-sm text-amber-600">Seleciona um festival primeiro para configurar as suas definições.</p>
                )}

                {/* Day names */}
                <div className="bg-white rounded-2xl border border-neutral-100 p-5 shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-3">Nomes dos Dias</div>
                  <div className="space-y-2">
                    {settingsForm.day_names.map((name, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-xs text-neutral-400 w-12 shrink-0">Dia {i + 1}</span>
                        <input
                          type="text"
                          value={name}
                          onChange={e => setSettingsForm(f => {
                            const day_names = [...f.day_names];
                            day_names[i] = e.target.value;
                            return { ...f, day_names };
                          })}
                          className="flex-1 border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                          placeholder={`Dia ${i + 1}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Report type labels */}
                <div className="bg-white rounded-2xl border border-neutral-100 p-5 shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-3">Nomes dos Tipos de Relatório</div>
                  <div className="space-y-2">
                    {[
                      { key: "opening", hint: "Abertura" },
                      { key: "delivery", hint: "Entrega" },
                      { key: "night_delivery", hint: "Entrega Noturna" },
                      { key: "closing", hint: "Fecho" },
                    ].map(({ key, hint }) => (
                      <div key={key} className="flex items-center gap-3">
                        <span className="text-xs text-neutral-400 w-32 shrink-0">{hint}</span>
                        <input
                          type="text"
                          value={settingsForm.report_type_labels[key]}
                          onChange={e => setSettingsForm(f => ({
                            ...f,
                            report_type_labels: { ...f.report_type_labels, [key]: e.target.value },
                          }))}
                          className="flex-1 border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleSaveSettings}
                  disabled={savingSettings || !festivalId}
                  className="w-full py-3 bg-neutral-900 text-white rounded-xl font-semibold text-sm hover:bg-neutral-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {savingSettings ? <><Loader2 className="w-4 h-4 animate-spin" /> A guardar...</> : <><Check className="w-4 h-4" /> Guardar Configurações</>}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
