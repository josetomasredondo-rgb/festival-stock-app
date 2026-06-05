import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Plus, Trash2, Pencil, Check, X, Loader2 } from "lucide-react";
import db from "../lib/db";
import { useAuth, ROLE_LABELS } from "../lib/AuthContext";

// ── Chip ─────────────────────────────────────────────────────────────────────
const CHIP_STYLES = {
  teal:   { backgroundColor: "#E1F5EE", border: "0.5px solid #5DCAA5", color: "#085041" },
  amber:  { backgroundColor: "#FAEEDA", border: "0.5px solid #EF9F27", color: "#633806" },
  purple: { backgroundColor: "#EEEDFE", border: "0.5px solid #AFA9EC", color: "#3C3489" },
};

function Chip({ label, color, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
      style={CHIP_STYLES[color]}>
      {label}
      {onRemove && (
        <button type="button" onClick={onRemove}
          className="ml-0.5 opacity-60 hover:opacity-100 font-bold leading-none">
          ×
        </button>
      )}
    </span>
  );
}

// ── MultiSelect ───────────────────────────────────────────────────────────────
function MultiSelect({ label, options, selectedIds, onAdd, onRemove, color, getLabel }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-2">{label}</label>
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedIds.map(id => {
            const opt = options.find(o => o.id === id);
            return opt ? <Chip key={id} label={getLabel(opt)} color={color} onRemove={() => onRemove(id)} /> : null;
          })}
        </div>
      )}
      <select value=""
        onChange={e => { if (e.target.value) { onAdd(e.target.value); e.target.value = ""; } }}
        className="w-full border border-neutral-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900">
        <option value="">+ Adicionar {label.toLowerCase()}...</option>
        {options.filter(o => !selectedIds.includes(o.id)).map(o => (
          <option key={o.id} value={o.id}>{getLabel(o)}</option>
        ))}
      </select>
    </div>
  );
}

// ── Festival form (create + edit) ─────────────────────────────────────────────
function FestivalForm({ bars, products, users, onSave, onCancel, initial, saving }) {
  const blank = { name: "", start_date: "", end_date: "", num_days: 1, day_names: ["Dia 1"], bar_ids: [], product_ids: [], user_ids: [] };
  const [form, setForm] = useState(() => {
    if (!initial) return blank;
    // Guard against null arrays returned by Supabase for existing rows
    return {
      ...blank,
      ...initial,
      bar_ids: initial.bar_ids || [],
      product_ids: initial.product_ids || [],
      user_ids: initial.user_ids || [],
      day_names: initial.day_names?.length
        ? initial.day_names
        : Array.from({ length: initial.num_days || 1 }, (_, i) => `Dia ${i + 1}`),
    };
  });

  const handleNumDays = (n) => {
    const num = Math.max(1, Math.min(15, Number(n) || 1));
    setForm(f => ({
      ...f, num_days: num,
      day_names: Array.from({ length: num }, (_, i) => f.day_names[i] || `Dia ${i + 1}`),
    }));
  };

  const addId = (field, id) => setForm(f => ({ ...f, [field]: [...(f[field] || []), id] }));
  const removeId = (field, id) => setForm(f => ({ ...f, [field]: (f[field] || []).filter(x => x !== id) }));

  return (
    <div className="space-y-4">
      <input type="text" placeholder="Nome do festival *" value={form.name}
        onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus
        className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-neutral-400 mb-1">Data início</label>
          <input type="date" value={form.start_date}
            onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
            className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
        </div>
        <div>
          <label className="block text-xs text-neutral-400 mb-1">Data fim</label>
          <input type="date" value={form.end_date}
            onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
            className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
        </div>
      </div>

      <div>
        <label className="block text-xs text-neutral-400 mb-1">Nº de dias</label>
        <input type="number" min={1} max={15} value={form.num_days}
          onChange={e => handleNumDays(e.target.value)}
          className="w-24 border border-neutral-200 rounded-xl px-3 py-2.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-neutral-900" />
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-semibold uppercase tracking-widest text-neutral-400">Nomes dos dias</label>
        {form.day_names.map((name, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="text-xs text-neutral-400 w-12 shrink-0">Dia {i + 1}</span>
            <input type="text" value={name}
              onChange={e => {
                const day_names = [...form.day_names];
                day_names[i] = e.target.value;
                setForm(f => ({ ...f, day_names }));
              }}
              placeholder={`Dia ${i + 1}`}
              className="flex-1 border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
          </div>
        ))}
      </div>

      <MultiSelect label="Bares" options={bars} selectedIds={form.bar_ids}
        onAdd={id => addId("bar_ids", id)} onRemove={id => removeId("bar_ids", id)}
        color="teal" getLabel={b => b.name} />

      <MultiSelect label="Produtos" options={products} selectedIds={form.product_ids}
        onAdd={id => addId("product_ids", id)} onRemove={id => removeId("product_ids", id)}
        color="amber" getLabel={p => p.name} />

      <MultiSelect label="Utilizadores" options={users} selectedIds={form.user_ids}
        onAdd={id => addId("user_ids", id)} onRemove={id => removeId("user_ids", id)}
        color="purple" getLabel={u => `${u.name} · ${ROLE_LABELS[u.role] || u.role}`} />

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel}
          className="flex-1 py-2.5 border border-neutral-200 rounded-xl text-sm font-medium text-neutral-600 hover:bg-neutral-50">
          Cancelar
        </button>
        <button type="button" onClick={() => onSave(form)}
          disabled={saving || !form.name.trim()}
          className="flex-1 py-2.5 bg-neutral-900 text-white rounded-xl text-sm font-semibold hover:bg-neutral-700 disabled:opacity-40 flex items-center justify-center gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Guardar
        </button>
      </div>
    </div>
  );
}

// ── Bar card ─────────────────────────────────────────────────────────────────
function BarCard({ bar, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: bar.name, leader_name: bar.leader_name || "", leader_email: bar.leader_email || "", location: bar.location || "" });

  const save = async () => { await onUpdate(bar.id, form); setEditing(false); };

  if (editing) return (
    <div className="bg-white rounded-2xl border border-neutral-200 p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {[["name","Nome *"], ["leader_name","Responsável"], ["leader_email","Email"], ["location","Localização"]].map(([k,l]) => (
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

// ── Product card ──────────────────────────────────────────────────────────────
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
      </div>
      <div className="flex gap-1">
        <button onClick={() => setEditing(true)} className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"><Pencil className="w-4 h-4" /></button>
        <button onClick={() => onDelete(product.id)} className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

// ── User card ─────────────────────────────────────────────────────────────────
// festivalIds = festivals where this user is currently assigned (festival.user_ids contains user.id)
function UserCard({ appUser, bars, festivals, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: appUser.name, pin: appUser.pin, role: appUser.role, bar_id: appUser.bar_id || "" });
  // Which festivals this user belongs to
  const [assignedFestivalIds, setAssignedFestivalIds] = useState(
    festivals.filter(f => (f.user_ids || []).includes(appUser.id)).map(f => f.id)
  );

  const save = async () => {
    await onUpdate(appUser.id, { ...form, bar_id: form.bar_id || null }, assignedFestivalIds);
    setEditing(false);
  };

  const assignedBar = bars.find(b => b.id === appUser.bar_id);
  const currentFestivalNames = festivals
    .filter(f => (f.user_ids || []).includes(appUser.id))
    .map(f => f.name);

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
            className="w-full border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none bg-white">
            {Object.entries(ROLE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        {form.role === "bar_leader" && (
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Bar atribuído</label>
            <select value={form.bar_id} onChange={e => setForm(f => ({ ...f, bar_id: e.target.value }))}
              className="w-full border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none bg-white">
              <option value="">Nenhum</option>
              {bars.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* Festival assignment */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-2">Festivais</label>
        {assignedFestivalIds.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {assignedFestivalIds.map(fid => {
              const fest = festivals.find(f => f.id === fid);
              return fest ? <Chip key={fid} label={fest.name} color="teal"
                onRemove={() => setAssignedFestivalIds(prev => prev.filter(x => x !== fid))} /> : null;
            })}
          </div>
        )}
        <select value=""
          onChange={e => { if (e.target.value && !assignedFestivalIds.includes(e.target.value)) { setAssignedFestivalIds(prev => [...prev, e.target.value]); e.target.value = ""; } }}
          className="w-full border border-neutral-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900">
          <option value="">+ Adicionar festival...</option>
          {festivals.filter(f => !assignedFestivalIds.includes(f.id)).map(f => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
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
        <div className="font-semibold text-neutral-900">{appUser.name}</div>
        <div className="text-xs text-neutral-500 mt-0.5">{ROLE_LABELS[appUser.role] || appUser.role} · PIN: {appUser.pin}</div>
        {assignedBar && <div className="text-xs text-neutral-400 mt-0.5">Bar: {assignedBar.name}</div>}
        {currentFestivalNames.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {currentFestivalNames.map(name => <Chip key={name} label={name} color="teal" />)}
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

// ── Festival item ─────────────────────────────────────────────────────────────
function FestivalItem({ festival, bars, products, users, onUpdate, onDelete, onClose, onReopen }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async (form) => {
    setSaving(true);
    await onUpdate(festival.id, form);
    setSaving(false);
    setEditing(false);
  };

  const assignedBars = bars.filter(b => (festival.bar_ids || []).includes(b.id));
  const assignedProducts = products.filter(p => (festival.product_ids || []).includes(p.id));
  const assignedUsers = users.filter(u => (festival.user_ids || []).includes(u.id));

  return (
    <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-neutral-900 flex items-center gap-2 flex-wrap">
              {festival.name}
              {festival.is_closed
                ? <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Fechado</span>
                : <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Ativo</span>}
            </div>
            {festival.start_date && (
              <div className="text-xs text-neutral-400 mt-0.5">
                {festival.start_date}{festival.end_date ? ` → ${festival.end_date}` : ""} · {festival.num_days || 1} dia{(festival.num_days || 1) !== 1 ? "s" : ""}
              </div>
            )}
            {!editing && (
              <div className="mt-2 flex flex-wrap gap-1">
                {assignedBars.map(b => <Chip key={b.id} label={b.name} color="teal" />)}
                {assignedProducts.map(p => <Chip key={p.id} label={p.name} color="amber" />)}
                {assignedUsers.map(u => <Chip key={u.id} label={u.name} color="purple" />)}
              </div>
            )}
          </div>
          <div className="flex gap-1 ml-4 shrink-0">
            <button onClick={() => setEditing(v => !v)}
              className="p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors">
              {editing ? <X className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
            </button>
            {festival.is_closed
              ? <button onClick={() => onReopen(festival.id)} className="px-3 py-1.5 border border-neutral-200 rounded-lg text-xs font-medium text-neutral-600 hover:bg-neutral-50">Reabrir</button>
              : <button onClick={() => onClose(festival.id)} className="px-3 py-1.5 border border-red-200 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50">Fechar</button>}
            <button onClick={() => onDelete(festival.id)}
              className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      {editing && (
        <div className="border-t border-neutral-100 p-4 bg-neutral-50">
          <FestivalForm bars={bars} products={products} users={users}
            initial={festival} saving={saving}
            onSave={handleSave}
            onCancel={() => setEditing(false)} />
        </div>
      )}
    </div>
  );
}

// ── Main GlobalSettings ───────────────────────────────────────────────────────
const TABS = ["festivais", "bares", "produtos", "utilizadores"];
const TAB_LABELS = { festivais: "Festivais", bares: "Bares", produtos: "Produtos", utilizadores: "Utilizadores" };

export default function GlobalSettings() {
  const { role, currentFestival, setCurrentFestival } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState("festivais");
  const [bars, setBars] = useState([]);
  const [products, setProducts] = useState([]);
  const [users, setUsers] = useState([]);
  const [festivals, setFestivals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creatingFestival, setCreatingFestival] = useState(false);
  const [savingFestival, setSavingFestival] = useState(false);

  const [newBar, setNewBar] = useState({ name: "", leader_name: "", leader_email: "", location: "" });
  const [newProduct, setNewProduct] = useState({ name: "", unit: "units", category: "other", selling_price: "" });
  const [newUser, setNewUser] = useState({ name: "", pin: "", role: "bar_leader", bar_id: "" });
  const [newUserFestivalIds, setNewUserFestivalIds] = useState([]);

  useEffect(() => {
    Promise.all([db.Bar.list(), db.Product.list(), db.AppUser.list(), db.Festival.list()])
      .then(([b, p, u, f]) => { setBars(b); setProducts(p); setUsers(u); setFestivals(f); setLoading(false); });
  }, []);

  if (role !== "manager") {
    navigate("/Dashboard");
    return null;
  }

  // ── Re-fetch helpers (guarantees UI matches DB even if insert returns null) ──
  const refreshFestivals = async (updatedId) => {
    const fresh = await db.Festival.list();
    setFestivals(fresh);
    // Keep currentFestival in sync with the DB — critical so SubmitReport
    // and DailySheet always see the latest day_names/bar_ids etc.
    if (updatedId && currentFestival?.id === updatedId) {
      const updated = fresh.find(f => f.id === updatedId);
      if (updated) setCurrentFestival(updated);
    }
    return fresh;
  };
  const refreshBars      = async () => setBars(await db.Bar.list());
  const refreshProducts  = async () => setProducts(await db.Product.list());
  const refreshUsers     = async () => setUsers(await db.AppUser.list());

  // ── Festival helpers ──────────────────────────────────────────────────────
  const syncUserFestivals = async (userId, newFestivalIds) => {
    // Re-fetch festivals fresh to avoid stale user_ids arrays
    const latestFestivals = await db.Festival.list();
    const prevFestivalIds = latestFestivals.filter(f => (f.user_ids || []).includes(userId)).map(f => f.id);
    const toAdd    = newFestivalIds.filter(fid => !prevFestivalIds.includes(fid));
    const toRemove = prevFestivalIds.filter(fid => !newFestivalIds.includes(fid));
    const updates = [
      ...toAdd.map(fid => {
        const f = latestFestivals.find(x => x.id === fid);
        return f ? db.Festival.update(fid, { user_ids: [...(f.user_ids || []), userId] }) : null;
      }),
      ...toRemove.map(fid => {
        const f = latestFestivals.find(x => x.id === fid);
        return f ? db.Festival.update(fid, { user_ids: (f.user_ids || []).filter(id => id !== userId) }) : null;
      }),
    ].filter(Boolean);
    await Promise.all(updates);
    await refreshFestivals();
  };

  const handleCreateFestival = async (form) => {
    setSavingFestival(true);
    const { num_days, day_names, bar_ids, product_ids, user_ids, ...rest } = form;
    await db.Festival.create({ ...rest, num_days, day_names, bar_ids: bar_ids || [], product_ids: product_ids || [], user_ids: user_ids || [], is_active: true, is_closed: false });
    await refreshFestivals();
    setSavingFestival(false);
    setCreatingFestival(false);
  };

  const handleUpdateFestival = async (id, form) => {
    const { num_days, day_names, bar_ids, product_ids, user_ids, ...rest } = form;
    await db.Festival.update(id, { ...rest, num_days, day_names, bar_ids: bar_ids || [], product_ids: product_ids || [], user_ids: user_ids || [] });
    await refreshFestivals(id);
  };

  const handleDeleteFestival = async (id) => {
    if (!window.confirm("Eliminar este festival?")) return;
    await db.Festival.delete(id);
    setFestivals(prev => prev.filter(f => f.id !== id));
  };

  const handleCloseFestival = async (id) => {
    if (!window.confirm("Fechar este festival?")) return;
    await db.Festival.update(id, { is_closed: true, is_active: false });
    await refreshFestivals(id);
  };

  const handleReopenFestival = async (id) => {
    await db.Festival.update(id, { is_closed: false, is_active: true });
    await refreshFestivals(id);
  };

  // ── Bars ──────────────────────────────────────────────────────────────────
  const addBar = async () => {
    if (!newBar.name.trim()) return;
    await db.Bar.create({ ...newBar, is_active: true });
    await refreshBars();
    setNewBar({ name: "", leader_name: "", leader_email: "", location: "" });
  };
  const updateBar = async (id, data) => {
    await db.Bar.update(id, data);
    await refreshBars();
  };
  const deleteBar = async (id) => {
    if (!window.confirm("Eliminar este bar?")) return;
    await db.Bar.delete(id);
    setBars(prev => prev.filter(b => b.id !== id));
  };

  // ── Products ──────────────────────────────────────────────────────────────
  const addProduct = async () => {
    if (!newProduct.name.trim()) return;
    await db.Product.create({ ...newProduct, selling_price: parseFloat(newProduct.selling_price) || 0 });
    await refreshProducts();
    setNewProduct({ name: "", unit: "units", category: "other", selling_price: "" });
  };
  const updateProduct = async (id, data) => {
    await db.Product.update(id, { ...data, selling_price: parseFloat(data.selling_price) || 0 });
    await refreshProducts();
  };
  const deleteProduct = async (id) => {
    if (!window.confirm("Eliminar este produto?")) return;
    await db.Product.delete(id);
    setProducts(prev => prev.filter(p => p.id !== id));
  };

  // ── Users ─────────────────────────────────────────────────────────────────
  const addUser = async () => {
    if (!newUser.name.trim() || !newUser.pin.trim()) return;
    const created = await db.AppUser.create({ ...newUser, bar_id: newUser.bar_id || null });
    await refreshUsers();
    if (created && newUserFestivalIds.length > 0) {
      await syncUserFestivals(created.id, newUserFestivalIds);
    }
    setNewUser({ name: "", pin: "", role: "bar_leader", bar_id: "" });
    setNewUserFestivalIds([]);
  };

  const updateUser = async (id, data, newFestivalIds) => {
    await db.AppUser.update(id, data);
    await refreshUsers();
    await syncUserFestivals(id, newFestivalIds);
  };

  const deleteUser = async (id) => {
    if (!window.confirm("Eliminar este utilizador?")) return;
    await db.AppUser.delete(id);
    setUsers(prev => prev.filter(u => u.id !== id));
  };

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <button onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-neutral-700 transition-colors mb-8">
          <ChevronLeft className="w-4 h-4" /> Voltar
        </button>
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-neutral-900">Definições Globais</h1>
          <p className="text-neutral-400 mt-1">Gerir festivais, bares, produtos e utilizadores</p>
        </div>

        <div className="flex gap-2 mb-6 flex-wrap">
          {TABS.map(t => (
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
            {/* ── Festivais ── */}
            {tab === "festivais" && (
              <div className="space-y-4">
                {!creatingFestival ? (
                  <button onClick={() => setCreatingFestival(true)}
                    className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-neutral-200 rounded-2xl text-sm font-medium text-neutral-400 hover:border-neutral-400 hover:text-neutral-600 transition-all">
                    <Plus className="w-4 h-4" /> Criar Novo Festival
                  </button>
                ) : (
                  <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm p-5">
                    <div className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-4">Novo Festival</div>
                    <FestivalForm bars={bars} products={products} users={users}
                      saving={savingFestival}
                      onSave={handleCreateFestival}
                      onCancel={() => setCreatingFestival(false)} />
                  </div>
                )}
                {festivals.map(f => (
                  <FestivalItem key={f.id} festival={f} bars={bars} products={products} users={users}
                    onUpdate={handleUpdateFestival} onDelete={handleDeleteFestival}
                    onClose={handleCloseFestival} onReopen={handleReopenFestival} />
                ))}
                {festivals.length === 0 && !creatingFestival && (
                  <div className="text-center py-10 text-neutral-300 text-sm">Nenhum festival criado ainda</div>
                )}
              </div>
            )}

            {/* ── Bares ── */}
            {tab === "bares" && (
              <div>
                <div className="bg-white rounded-2xl border border-neutral-100 p-5 mb-5 shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-3">Adicionar Novo Bar</div>
                  <div className="grid grid-cols-2 gap-3">
                    {[["name","Nome *"], ["leader_name","Responsável"], ["leader_email","Email"], ["location","Localização"]].map(([k,l]) => (
                      <input key={k} type="text" placeholder={l} value={newBar[k]}
                        onChange={e => setNewBar(f => ({ ...f, [k]: e.target.value }))}
                        className="border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
                    ))}
                  </div>
                  <button onClick={addBar}
                    className="mt-3 flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-xl text-sm font-medium hover:bg-neutral-700 transition-colors">
                    <Plus className="w-4 h-4" /> Adicionar Bar
                  </button>
                </div>
                <div className="space-y-3">
                  {bars.map(b => <BarCard key={b.id} bar={b} onUpdate={updateBar} onDelete={deleteBar} />)}
                  {bars.length === 0 && <div className="text-center py-10 text-neutral-300 text-sm">Nenhum bar criado ainda</div>}
                </div>
              </div>
            )}

            {/* ── Produtos ── */}
            {tab === "produtos" && (
              <div>
                <div className="bg-white rounded-2xl border border-neutral-100 p-5 mb-5 shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-3">Adicionar Novo Produto</div>
                  <div className="flex gap-3 flex-wrap">
                    <input type="text" placeholder="Nome *" value={newProduct.name}
                      onChange={e => setNewProduct(f => ({ ...f, name: e.target.value }))}
                      className="flex-1 min-w-[150px] border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
                    <input type="text" placeholder="Unidade" value={newProduct.unit}
                      onChange={e => setNewProduct(f => ({ ...f, unit: e.target.value }))}
                      className="w-32 border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
                    <select value={newProduct.category} onChange={e => setNewProduct(f => ({ ...f, category: e.target.value }))}
                      className="w-36 border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none bg-white">
                      {["alcohol","soft_drinks","water","food","other"].map(c => <option key={c} value={c}>{c.replace("_"," ")}</option>)}
                    </select>
                    <input type="number" min="0" step="0.01" placeholder="€ preço" value={newProduct.selling_price}
                      onChange={e => setNewProduct(f => ({ ...f, selling_price: e.target.value }))}
                      className="w-28 border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
                  </div>
                  <button onClick={addProduct}
                    className="mt-3 flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-xl text-sm font-medium hover:bg-neutral-700 transition-colors">
                    <Plus className="w-4 h-4" /> Adicionar Produto
                  </button>
                </div>
                <div className="space-y-2">
                  {products.map(p => <ProductCard key={p.id} product={p} onUpdate={updateProduct} onDelete={deleteProduct} />)}
                  {products.length === 0 && <div className="text-center py-10 text-neutral-300 text-sm">Nenhum produto criado ainda</div>}
                </div>
              </div>
            )}

            {/* ── Utilizadores ── */}
            {tab === "utilizadores" && (
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
                    {newUser.role === "bar_leader" && (
                      <div>
                        <label className="block text-xs text-neutral-400 mb-1">Bar atribuído</label>
                        <select value={newUser.bar_id} onChange={e => setNewUser(f => ({ ...f, bar_id: e.target.value }))}
                          className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none bg-white">
                          <option value="">Nenhum</option>
                          {bars.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Festival assignment for new user */}
                  <div className="mt-3">
                    <label className="block text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-2">Festivais</label>
                    {newUserFestivalIds.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {newUserFestivalIds.map(fid => {
                          const fest = festivals.find(f => f.id === fid);
                          return fest ? <Chip key={fid} label={fest.name} color="teal"
                            onRemove={() => setNewUserFestivalIds(prev => prev.filter(x => x !== fid))} /> : null;
                        })}
                      </div>
                    )}
                    <select value=""
                      onChange={e => { if (e.target.value && !newUserFestivalIds.includes(e.target.value)) { setNewUserFestivalIds(prev => [...prev, e.target.value]); e.target.value = ""; } }}
                      className="w-full border border-neutral-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900">
                      <option value="">+ Adicionar festival...</option>
                      {festivals.filter(f => !newUserFestivalIds.includes(f.id)).map(f => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  </div>

                  <button onClick={addUser} disabled={!newUser.name.trim() || !newUser.pin.trim()}
                    className="mt-3 flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-xl text-sm font-medium hover:bg-neutral-700 transition-colors disabled:opacity-40">
                    <Plus className="w-4 h-4" /> Adicionar Utilizador
                  </button>
                </div>
                <div className="space-y-3">
                  {users.map(u => (
                    <UserCard key={u.id} appUser={u} bars={bars} festivals={festivals}
                      onUpdate={updateUser} onDelete={deleteUser} />
                  ))}
                  {users.length === 0 && <div className="text-center py-10 text-neutral-300 text-sm">Nenhum utilizador criado ainda</div>}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
