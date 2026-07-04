import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft, ChevronDown, Plus, Trash2, Pencil, Check, X, Loader2,
  Calendar, Building2, Package, Archive, Users
} from "lucide-react";
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
          className="ml-0.5 opacity-60 hover:opacity-100 font-bold leading-none">×</button>
      )}
    </span>
  );
}

// ── Festival form — collapsible sections ──────────────────────────────────────
function FestivalFormNew({ allProducts, allUsers, existingBars, existingWarehouses, onSave, onCancel, saving, initial, suggestedName }) {
  const [open, setOpen] = useState({ info: true, bares: true, produtos: true, armazem: true, pessoas: true });
  const toggle = (k) => setOpen(prev => ({ ...prev, [k]: !prev[k] }));

  // ── Info ──
  const [name, setName] = useState(initial?.name || suggestedName || "");
  const [startDate, setStartDate] = useState(initial?.start_date || "");
  const [endDate, setEndDate] = useState(initial?.end_date || "");
  const [numDays, setNumDays] = useState(initial?.num_days || 1);
  const [dayNames, setDayNames] = useState(() =>
    initial?.day_names?.length
      ? initial.day_names
      : Array.from({ length: initial?.num_days || 1 }, (_, i) => `Dia ${i + 1}`)
  );
  const [attendance, setAttendance] = useState(initial?.expected_attendance || 0);

  const handleNumDays = (n) => {
    const num = Math.max(1, Math.min(15, Number(n) || 1));
    setNumDays(num);
    setDayNames(prev => Array.from({ length: num }, (_, i) => prev[i] || `Dia ${i + 1}`));
  };

  // ── Bars — each bar carries leader_name and assignedUserIds ──
  const [formBars, setFormBars] = useState(() =>
    existingBars?.length
      ? existingBars.map(b => ({
          _key: b.id,
          id: b.id,
          name: b.name,
          location: b.location || "",
          leader_name: b.leader_name || "",
          assignedUserIds: b.assignedUserIds || [],
        }))
      : [{ _key: "new_0", id: null, name: "", location: "", leader_name: "", assignedUserIds: [] }]
  );

  const addBar = () => setFormBars(prev => [...prev, { _key: `new_${Date.now()}`, id: null, name: "", location: "", leader_name: "", assignedUserIds: [] }]);
  const updateBar = (_key, field, val) => setFormBars(prev => prev.map(b => b._key === _key ? { ...b, [field]: val } : b));
  const removeBar = (_key) => setFormBars(prev => prev.filter(b => b._key !== _key));
  const assignUser = (_key, userId) => setFormBars(prev => prev.map(b =>
    b._key === _key && !b.assignedUserIds.includes(userId)
      ? { ...b, assignedUserIds: [...b.assignedUserIds, userId] }
      : b
  ));
  const unassignUser = (_key, userId) => setFormBars(prev => prev.map(b =>
    b._key === _key ? { ...b, assignedUserIds: b.assignedUserIds.filter(id => id !== userId) } : b
  ));

  // ── Products ──
  const [productIds, setProductIds] = useState(initial?.product_ids || []);
  const toggleProduct = (id) => setProductIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const selectedProducts = allProducts.filter(p => productIds.includes(p.id));

  // ── Warehouses ──
  const [warehouses, setWarehouses] = useState(() =>
    existingWarehouses?.length
      ? existingWarehouses.map(w => ({ id: w.id, name: w.name, initial_stock: w.initial_stock || [] }))
      : [{ id: null, name: "Armazém Central", initial_stock: [] }]
  );

  const updateWarehouseStock = (wi, product, qty) => {
    setWarehouses(prev => prev.map((wh, i) => {
      if (i !== wi) return wh;
      const stock = wh.initial_stock || [];
      const exists = stock.find(s => s.product_id === product.id);
      return {
        ...wh,
        initial_stock: exists
          ? stock.map(s => s.product_id === product.id ? { ...s, quantity: Number(qty) || 0 } : s)
          : [...stock, { product_id: product.id, product_name: product.name, unit: product.unit || "units", quantity: Number(qty) || 0 }],
      };
    }));
  };

  // ── Completion checks ──
  const namedBars = formBars.filter(b => b.name.trim());
  const infoComplete = !!name.trim() && dayNames.some(d => d.trim());
  const baresComplete = namedBars.length > 0;
  const produtosComplete = productIds.length > 0;
  const armazémComplete = warehouses.some(w => (w.initial_stock || []).some(s => (s.quantity || 0) > 0));
  const pessoasComplete = namedBars.some(b => b.leader_name.trim() || b.assignedUserIds.length > 0);

  const dots = [infoComplete, baresComplete, produtosComplete, armazémComplete, pessoasComplete];
  const totalStock = warehouses.reduce((s, w) => s + (w.initial_stock || []).reduce((s2, i) => s2 + (i.quantity || 0), 0), 0);
  const allAssignedIds = [...new Set(formBars.flatMap(b => b.assignedUserIds))];

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSave(
      {
        name: name.trim(), start_date: startDate, end_date: endDate,
        num_days: numDays, day_names: dayNames,
        expected_attendance: Number(attendance) || 0,
        product_ids: productIds,
        user_ids: allAssignedIds,
      },
      namedBars,
      warehouses
    );
  };

  // ── Section button helper ──
  const SectionBtn = ({ sKey, title, subtitle, Icon, borderCls, iconCls, bgCls }) => (
    <button type="button" onClick={() => toggle(sKey)}
      className="w-full flex items-center gap-4 p-5 text-left hover:bg-neutral-50 transition-colors">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${bgCls}`}>
        <Icon className={`w-[18px] h-[18px] ${iconCls}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-neutral-900">{title}</div>
        {subtitle && <div className="text-xs text-neutral-400 mt-0.5 truncate">{subtitle}</div>}
      </div>
      <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform shrink-0 ${open[sKey] ? "rotate-180" : ""}`} />
    </button>
  );

  return (
    <div className="space-y-3">
      {/* Progress bar */}
      <div className="flex items-center gap-1.5 px-1 pb-1">
        {dots.map((done, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${done ? "bg-green-400" : "bg-neutral-200"}`} />
        ))}
      </div>

      {/* ── 1: Info ── */}
      <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden border-l-4 border-l-orange-400">
        <SectionBtn sKey="info"
          title="Informação Geral"
          subtitle={name ? `${name}${startDate ? ` · ${startDate}` : ""}${numDays > 1 ? ` · ${numDays} dias` : ""}` : "Nome, datas e configuração"}
          Icon={Calendar} borderCls="" iconCls="text-orange-500" bgCls="bg-orange-50" />
        {open.info && (
          <div className="border-t border-neutral-100 p-5 space-y-4">
            <input type="text" placeholder="Nome do festival *" value={name}
              onChange={e => setName(e.target.value)} autoFocus
              className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-neutral-400 mb-1">Data início</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                  className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
              </div>
              <div>
                <label className="block text-xs text-neutral-400 mb-1">Data fim</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                  className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-neutral-400 mb-1">Nº de dias</label>
                <input type="number" min={1} max={15} value={numDays} onChange={e => handleNumDays(e.target.value)}
                  className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-neutral-900" />
              </div>
              <div>
                <label className="block text-xs text-neutral-400 mb-1">Pessoas esperadas</label>
                <input type="number" min={0} value={attendance} onChange={e => setAttendance(e.target.value)}
                  className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-neutral-900" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-semibold uppercase tracking-widest text-neutral-400">Nomes dos dias</label>
              {dayNames.map((dn, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-neutral-400 w-12 shrink-0">Dia {i + 1}</span>
                  <input type="text" value={dn} placeholder={`Dia ${i + 1}`}
                    onChange={e => { const next = [...dayNames]; next[i] = e.target.value; setDayNames(next); }}
                    className="flex-1 border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── 2: Bares ── */}
      <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden border-l-4 border-l-blue-400">
        <SectionBtn sKey="bares"
          title="Bares"
          subtitle={namedBars.length > 0 ? `${namedBars.length} bar${namedBars.length !== 1 ? "es" : ""} adicionado${namedBars.length !== 1 ? "s" : ""}` : "Cria os bares do festival"}
          Icon={Building2} borderCls="" iconCls="text-blue-500" bgCls="bg-blue-50" />
        {open.bares && (
          <div className="border-t border-neutral-100 p-5 space-y-2">
            {formBars.map(bar => (
              <div key={bar._key} className="flex items-center gap-2">
                <input type="text" placeholder="Nome do bar *" value={bar.name}
                  onChange={e => updateBar(bar._key, "name", e.target.value)}
                  className="flex-1 border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
                <input type="text" placeholder="Localização" value={bar.location}
                  onChange={e => updateBar(bar._key, "location", e.target.value)}
                  className="flex-1 border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
                <button type="button" onClick={() => removeBar(bar._key)}
                  className="p-2 text-neutral-300 hover:text-red-500 transition-colors shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button type="button" onClick={addBar}
              className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-neutral-200 rounded-xl text-sm font-medium text-neutral-400 hover:border-neutral-400 hover:text-neutral-600 transition-all mt-1">
              <Plus className="w-4 h-4" /> Adicionar bar
            </button>
          </div>
        )}
      </div>

      {/* ── 3: Produtos ── */}
      <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden border-l-4 border-l-amber-400">
        <SectionBtn sKey="produtos"
          title="Produtos"
          subtitle={productIds.length > 0 ? `${productIds.length} produto${productIds.length !== 1 ? "s" : ""} selecionado${productIds.length !== 1 ? "s" : ""}` : "Seleciona os produtos do festival"}
          Icon={Package} borderCls="" iconCls="text-amber-500" bgCls="bg-amber-50" />
        {open.produtos && (
          <div className="border-t border-neutral-100 p-5">
            {selectedProducts.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {selectedProducts.map(p => (
                  <Chip key={p.id} label={p.name} color="amber" onRemove={() => toggleProduct(p.id)} />
                ))}
              </div>
            )}
            <select value=""
              onChange={e => { if (e.target.value) { toggleProduct(e.target.value); e.target.value = ""; } }}
              className="w-full border border-neutral-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900">
              <option value="">+ Adicionar produto...</option>
              {allProducts.filter(p => !productIds.includes(p.id)).map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.unit || "units"})</option>
              ))}
            </select>
            {allProducts.length === 0 && (
              <div className="text-xs text-neutral-400 mt-2">Cria produtos no separador Produtos primeiro.</div>
            )}
          </div>
        )}
      </div>

      {/* ── 4: Armazém ── */}
      <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden border-l-4 border-l-teal-400">
        <SectionBtn sKey="armazem"
          title="Armazém"
          subtitle={totalStock > 0
            ? `${warehouses.length} armazém${warehouses.length !== 1 ? "éns" : ""} · ${totalStock} unidades`
            : selectedProducts.length > 0 ? "Define o stock inicial" : "Adiciona produtos primeiro"}
          Icon={Archive} borderCls="" iconCls="text-teal-500" bgCls="bg-teal-50" />
        {open.armazem && (
          <div className="border-t border-neutral-100 p-5 space-y-4">
            {warehouses.map((wh, wi) => (
              <div key={wi} className="border border-neutral-200 rounded-xl p-4 space-y-3 bg-neutral-50">
                <div className="flex items-center gap-3">
                  <input type="text" value={wh.name} placeholder="Nome do armazém"
                    onChange={e => setWarehouses(prev => prev.map((w, i) => i === wi ? { ...w, name: e.target.value } : w))}
                    className="flex-1 border border-neutral-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900" />
                  {warehouses.length > 1 && (
                    <button type="button" onClick={() => setWarehouses(prev => prev.filter((_, i) => i !== wi))}
                      className="p-1.5 text-neutral-400 hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {selectedProducts.length > 0 ? (
                  <div className="space-y-2">
                    <div className="text-xs text-neutral-400">Stock inicial por produto:</div>
                    {selectedProducts.map(p => {
                      const qty = (wh.initial_stock || []).find(s => s.product_id === p.id)?.quantity ?? 0;
                      return (
                        <div key={p.id} className="flex items-center gap-3">
                          <span className="text-sm text-neutral-700 flex-1">{p.name}</span>
                          <input type="number" min="0" value={qty}
                            onChange={e => updateWarehouseStock(wi, p, e.target.value)}
                            className="w-20 border border-neutral-200 rounded-xl px-2 py-1.5 text-sm text-center bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900" />
                          <span className="text-xs text-neutral-400 w-12">{p.unit || "units"}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-xs text-neutral-400">Adiciona produtos ao festival para configurar o stock inicial.</div>
                )}
              </div>
            ))}
            <button type="button"
              onClick={() => setWarehouses(prev => [...prev, { id: null, name: "", initial_stock: [] }])}
              className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-900 transition-colors">
              <Plus className="w-3.5 h-3.5" /> Adicionar armazém
            </button>
          </div>
        )}
      </div>

      {/* ── 5: Pessoas ── */}
      <div className="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden border-l-4 border-l-violet-400">
        <SectionBtn sKey="pessoas"
          title="Pessoas"
          subtitle={pessoasComplete
            ? `${allAssignedIds.length} pessoa${allAssignedIds.length !== 1 ? "s" : ""} atribuída${allAssignedIds.length !== 1 ? "s" : ""}`
            : namedBars.length > 0 ? "Atribui responsáveis e equipa a cada bar" : "Cria bares primeiro"}
          Icon={Users} borderCls="" iconCls="text-violet-500" bgCls="bg-violet-50" />
        {open.pessoas && (
          <div className="border-t border-neutral-100 p-5 space-y-4">
            {namedBars.length === 0 ? (
              <div className="text-sm text-neutral-400 text-center py-2">Define os bares na secção anterior primeiro.</div>
            ) : (
              namedBars.map(bar => {
                const assigned = allUsers.filter(u => bar.assignedUserIds.includes(u.id));
                const available = allUsers.filter(u => !bar.assignedUserIds.includes(u.id));
                return (
                  <div key={bar._key} className="border border-neutral-200 rounded-xl overflow-hidden">
                    <div className="px-4 py-2.5 bg-neutral-50 border-b border-neutral-100">
                      <span className="text-xs font-semibold uppercase tracking-widest text-neutral-500">{bar.name}</span>
                    </div>
                    <div className="p-4 space-y-3">
                      {/* Responsável */}
                      <div>
                        <label className="block text-xs text-neutral-400 mb-1.5">Responsável</label>
                        <input type="text" placeholder="Nome do responsável" value={bar.leader_name}
                          onChange={e => updateBar(bar._key, "leader_name", e.target.value)}
                          className="w-full border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900" />
                      </div>
                      {/* Equipa */}
                      <div>
                        <label className="block text-xs text-neutral-400 mb-1.5">Equipa</label>
                        {assigned.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {assigned.map(u => (
                              <Chip key={u.id}
                                label={`${u.name} · ${ROLE_LABELS[u.role] || u.role}`}
                                color="purple"
                                onRemove={() => unassignUser(bar._key, u.id)} />
                            ))}
                          </div>
                        )}
                        {available.length > 0 && (
                          <select value=""
                            onChange={e => { if (e.target.value) { assignUser(bar._key, e.target.value); e.target.value = ""; } }}
                            className="w-full border border-neutral-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900">
                            <option value="">+ Adicionar pessoa...</option>
                            {available.map(u => (
                              <option key={u.id} value={u.id}>{u.name} · {ROLE_LABELS[u.role] || u.role}</option>
                            ))}
                          </select>
                        )}
                        {allUsers.length === 0 && (
                          <div className="text-xs text-neutral-400">Cria utilizadores no separador Utilizadores primeiro.</div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <button type="button" onClick={onCancel}
          className="px-5 py-2.5 border border-neutral-200 rounded-xl text-sm font-medium text-neutral-600 hover:bg-neutral-50">
          Cancelar
        </button>
        <button type="button" onClick={handleSubmit}
          disabled={saving || !name.trim()}
          className="flex-1 py-2.5 bg-neutral-900 text-white rounded-xl text-sm font-semibold hover:bg-neutral-700 disabled:opacity-40 flex items-center justify-center gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {initial ? "Guardar alterações" : "Criar festival"}
        </button>
      </div>
    </div>
  );
}

// ── Bar card (global bars tab) ────────────────────────────────────────────────
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
function UserCard({ appUser, bars, festivals, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: appUser.name, pin: appUser.pin, role: appUser.role, bar_id: appUser.bar_id || "" });
  const [assignedFestivalIds, setAssignedFestivalIds] = useState(
    festivals.filter(f => (f.user_ids || []).includes(appUser.id)).map(f => f.id)
  );

  const save = async () => {
    await onUpdate(appUser.id, { ...form, bar_id: form.bar_id || null }, assignedFestivalIds);
    setEditing(false);
  };

  const assignedBar = bars.find(b => b.id === appUser.bar_id);
  const currentFestivalNames = festivals.filter(f => (f.user_ids || []).includes(appUser.id)).map(f => f.name);

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
            {currentFestivalNames.map(n => <Chip key={n} label={n} color="teal" />)}
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
function FestivalItem({ festival, allProducts, allUsers, existingBars, existingWarehouses, onUpdate, onDelete, onClose, onReopen }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async (festivalData, barsData, warehousesData) => {
    setSaving(true);
    await onUpdate(festival.id, festivalData, barsData, warehousesData);
    setSaving(false);
    setEditing(false);
  };

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
            <div className="text-xs text-neutral-400 mt-0.5">
              {festival.start_date && `${festival.start_date}${festival.end_date ? ` → ${festival.end_date}` : ""} · `}
              {festival.num_days || 1} dia{(festival.num_days || 1) !== 1 ? "s" : ""}
              {existingBars?.length > 0 && ` · ${existingBars.length} bar${existingBars.length !== 1 ? "es" : ""}`}
              {existingWarehouses?.length > 0 && ` · ${existingWarehouses.length} armazém${existingWarehouses.length !== 1 ? "éns" : ""}`}
            </div>
            {!editing && existingBars?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {existingBars.map(b => <Chip key={b.id} label={b.name} color="teal" />)}
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
          <FestivalFormNew
            allProducts={allProducts}
            allUsers={allUsers}
            existingBars={existingBars}
            existingWarehouses={existingWarehouses}
            initial={festival}
            saving={saving}
            onSave={handleSave}
            onCancel={() => setEditing(false)}
          />
        </div>
      )}
    </div>
  );
}

// ── Main GlobalSettings ───────────────────────────────────────────────────────
const TABS = ["festivais", "bares", "produtos", "utilizadores"];
const TAB_LABELS = { festivais: "Festivais", bares: "Bares globais", produtos: "Produtos", utilizadores: "Utilizadores" };

export default function GlobalSettings() {
  const { role, currentFestival, setCurrentFestival } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState("festivais");
  const [bars, setBars] = useState([]);
  const [products, setProducts] = useState([]);
  const [users, setUsers] = useState([]);
  const [festivals, setFestivals] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creatingFestival, setCreatingFestival] = useState(false);
  const [savingFestival, setSavingFestival] = useState(false);
  const [smartSuggestions, setSmartSuggestions] = useState(null);

  const [newBar, setNewBar] = useState({ name: "", leader_name: "", leader_email: "", location: "" });
  const [newProduct, setNewProduct] = useState({ name: "", unit: "units", category: "other", selling_price: "" });
  const [newUser, setNewUser] = useState({ name: "", pin: "", role: "bar_leader", bar_id: "" });
  const [newUserFestivalIds, setNewUserFestivalIds] = useState([]);

  useEffect(() => {
    Promise.all([db.Bar.list(), db.Product.list(), db.AppUser.list(), db.Festival.list(), db.Warehouse.list()])
      .then(([b, p, u, f, w]) => { setBars(b); setProducts(p); setUsers(u); setFestivals(f); setWarehouses(w); setLoading(false); });
    try {
      const stored = sessionStorage.getItem("smartChecklistData");
      if (stored) {
        const data = JSON.parse(stored);
        setSmartSuggestions(data);
        setCreatingFestival(true);
        setTab("festivais");
        sessionStorage.removeItem("smartChecklistData");
      }
    } catch {}
  }, []);

  if (role !== "manager") { navigate("/Dashboard"); return null; }

  // ── Helpers ───────────────────────────────────────────────────────────────
  const refreshFestivals = async (updatedId) => {
    const fresh = await db.Festival.list();
    setFestivals(fresh);
    if (updatedId && currentFestival?.id === updatedId) {
      const updated = fresh.find(f => f.id === updatedId);
      if (updated) setCurrentFestival(updated);
    }
    return fresh;
  };
  const refreshBars      = async () => setBars(await db.Bar.list());
  const refreshProducts  = async () => setProducts(await db.Product.list());
  const refreshUsers     = async () => setUsers(await db.AppUser.list());
  const refreshWarehouses = async () => setWarehouses(await db.Warehouse.list());

  const syncUserFestivals = async (userId, newFestivalIds) => {
    const latestFestivals = await db.Festival.list();
    const prevIds = latestFestivals.filter(f => (f.user_ids || []).includes(userId)).map(f => f.id);
    const toAdd    = newFestivalIds.filter(fid => !prevIds.includes(fid));
    const toRemove = prevIds.filter(fid => !newFestivalIds.includes(fid));
    await Promise.all([
      ...toAdd.map(fid => { const f = latestFestivals.find(x => x.id === fid); return f ? db.Festival.update(fid, { user_ids: [...(f.user_ids || []), userId] }) : null; }),
      ...toRemove.map(fid => { const f = latestFestivals.find(x => x.id === fid); return f ? db.Festival.update(fid, { user_ids: (f.user_ids || []).filter(id => id !== userId) }) : null; }),
    ].filter(Boolean));
    await refreshFestivals();
  };

  const syncFestivalWarehouses = async (festivalId, formWarehouses) => {
    const existing = warehouses.filter(w => w.festival_id === festivalId);
    const formIds = (formWarehouses || []).map(w => w.id).filter(Boolean);
    for (const wh of (formWarehouses || [])) {
      if (wh.id) {
        await db.Warehouse.update(wh.id, { name: wh.name, initial_stock: wh.initial_stock || [] });
      } else {
        await db.Warehouse.create({ festival_id: festivalId, name: wh.name || "Armazém Central", initial_stock: wh.initial_stock || [] });
      }
    }
    for (const ew of existing) {
      if (!formIds.includes(ew.id)) await db.Warehouse.delete(ew.id);
    }
    await refreshWarehouses();
  };

  // Assign users to a bar and update their bar_id
  const syncBarUsers = async (barId, assignedUserIds) => {
    await Promise.all(assignedUserIds.map(uid => db.AppUser.update(uid, { bar_id: barId })));
  };

  // ── Festival CRUD ─────────────────────────────────────────────────────────
  const handleCreateFestival = async (festivalData, barsData, warehousesData) => {
    setSavingFestival(true);
    const created = await db.Festival.create({
      ...festivalData, bar_ids: [], is_active: true, is_closed: false,
    });
    if (created?.id) {
      const barIds = [];
      for (const bar of barsData) {
        const b = await db.Bar.create({
          name: bar.name,
          location: bar.location || "",
          leader_name: bar.leader_name || "",
          festival_id: created.id,
          is_active: true,
        });
        if (b?.id) {
          barIds.push(b.id);
          if (bar.assignedUserIds?.length) await syncBarUsers(b.id, bar.assignedUserIds);
        }
      }
      if (barIds.length > 0) await db.Festival.update(created.id, { bar_ids: barIds });
      for (const wh of warehousesData) {
        await db.Warehouse.create({ festival_id: created.id, name: wh.name || "Armazém Central", initial_stock: wh.initial_stock || [] });
      }
      await refreshBars();
      await refreshWarehouses();
      await refreshUsers();
    }
    await refreshFestivals();
    setSavingFestival(false);
    setCreatingFestival(false);
    setSmartSuggestions(null);
  };

  const handleUpdateFestival = async (id, festivalData, barsData, warehousesData) => {
    const existingFestBars = bars.filter(b => b.festival_id === id);
    const barIds = [];

    for (const bar of barsData) {
      if (bar.id) {
        await db.Bar.update(bar.id, { name: bar.name, location: bar.location || "", leader_name: bar.leader_name || "", festival_id: id });
        barIds.push(bar.id);
      } else {
        const b = await db.Bar.create({ name: bar.name, location: bar.location || "", leader_name: bar.leader_name || "", festival_id: id, is_active: true });
        if (b?.id) barIds.push(b.id);
      }
    }

    // Sync user assignments per bar
    for (const bar of barsData) {
      const barId = bar.id || barIds[barsData.indexOf(bar)];
      if (barId && bar.assignedUserIds?.length) await syncBarUsers(barId, bar.assignedUserIds);
    }

    for (const eb of existingFestBars) {
      if (!barIds.includes(eb.id)) await db.Bar.delete(eb.id);
    }

    await db.Festival.update(id, { ...festivalData, bar_ids: barIds });
    await syncFestivalWarehouses(id, warehousesData);
    await refreshBars();
    await refreshUsers();
    await refreshFestivals(id);
  };

  const handleDeleteFestival = async (id) => {
    if (!window.confirm("Eliminar este festival? Todos os relatórios e movimentos associados serão eliminados. Esta ação não pode ser desfeita.")) return;
    const [reports, offered, festWarehouses, festMovements, festBars] = await Promise.all([
      db.StockReport.filterByFestival(id),
      db.OfferedItems.filterByFestival(id),
      db.Warehouse.filterByFestival(id),
      db.Movement.filterByFestival(id),
      db.Bar.filterByFestival(id),
    ]);
    await Promise.all([
      ...reports.map(r => db.StockReport.delete(r.id)),
      ...offered.map(r => db.OfferedItems.delete(r.id)),
      ...festWarehouses.map(w => db.Warehouse.delete(w.id)),
      ...festMovements.map(m => db.Movement.delete(m.id)),
      ...festBars.map(b => db.Bar.delete(b.id)),
    ]);
    const ok = await db.Festival.delete(id);
    if (ok) {
      setFestivals(prev => prev.filter(f => f.id !== id));
      setWarehouses(prev => prev.filter(w => w.festival_id !== id));
      setBars(prev => prev.filter(b => b.festival_id !== id));
    }
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

  // ── Global bars CRUD ──────────────────────────────────────────────────────
  const addBar = async () => {
    if (!newBar.name.trim()) return;
    await db.Bar.create({ ...newBar, is_active: true });
    await refreshBars();
    setNewBar({ name: "", leader_name: "", leader_email: "", location: "" });
  };
  const updateBar = async (id, data) => { await db.Bar.update(id, data); await refreshBars(); };
  const deleteBar = async (id) => {
    if (!window.confirm("Eliminar este bar?")) return;
    await db.Bar.delete(id);
    setBars(prev => prev.filter(b => b.id !== id));
  };

  // ── Products CRUD ─────────────────────────────────────────────────────────
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

  // ── Users CRUD ────────────────────────────────────────────────────────────
  const addUser = async () => {
    if (!newUser.name.trim() || !newUser.pin.trim()) return;
    const created = await db.AppUser.create({ ...newUser, bar_id: newUser.bar_id || null });
    await refreshUsers();
    if (created && newUserFestivalIds.length > 0) await syncUserFestivals(created.id, newUserFestivalIds);
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

  // ── Derived data ──────────────────────────────────────────────────────────
  const globalBars = bars.filter(b => !b.festival_id);

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
                  <div className="bg-neutral-50 rounded-2xl border border-neutral-200 p-5">
                    <div className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-4">Novo Festival</div>
                    {smartSuggestions?.suggestions?.length > 0 && (
                      <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm">
                        <div className="font-semibold text-blue-900 mb-2">Sugestões da checklist inteligente</div>
                        <div className="space-y-0.5">
                          {smartSuggestions.suggestions.map(s => (
                            <div key={s.product_name} className="text-blue-800">
                              {s.product_name}: <span className="font-semibold">{s.suggested}</span> {s.unit}
                            </div>
                          ))}
                        </div>
                        <div className="text-xs text-blue-600 mt-2">Usa estas quantidades como stock inicial nos armazéns.</div>
                      </div>
                    )}
                    <FestivalFormNew
                      allProducts={products}
                      allUsers={users}
                      existingBars={[]}
                      existingWarehouses={[]}
                      saving={savingFestival}
                      suggestedName={smartSuggestions?.name}
                      onSave={handleCreateFestival}
                      onCancel={() => { setCreatingFestival(false); setSmartSuggestions(null); }}
                    />
                  </div>
                )}
                {festivals.map(f => {
                  const festBars = bars.filter(b => b.festival_id === f.id).length > 0
                    ? bars.filter(b => b.festival_id === f.id)
                    : bars.filter(b => (f.bar_ids || []).includes(b.id));
                  // Enrich bars with their assigned users
                  const enrichedBars = festBars.map(b => ({
                    ...b,
                    assignedUserIds: users.filter(u => u.bar_id === b.id).map(u => u.id),
                  }));
                  return (
                    <FestivalItem key={f.id} festival={f}
                      allProducts={products}
                      allUsers={users}
                      existingBars={enrichedBars}
                      existingWarehouses={warehouses.filter(w => w.festival_id === f.id)}
                      onUpdate={handleUpdateFestival}
                      onDelete={handleDeleteFestival}
                      onClose={handleCloseFestival}
                      onReopen={handleReopenFestival}
                    />
                  );
                })}
                {festivals.length === 0 && !creatingFestival && (
                  <div className="text-center py-10 text-neutral-300 text-sm">Nenhum festival criado ainda</div>
                )}
              </div>
            )}

            {/* ── Bares globais ── */}
            {tab === "bares" && (
              <div>
                <div className="bg-white rounded-2xl border border-neutral-100 p-5 mb-5 shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-3">Adicionar Bar Global</div>
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
                  {globalBars.map(b => <BarCard key={b.id} bar={b} onUpdate={updateBar} onDelete={deleteBar} />)}
                  {globalBars.length === 0 && (
                    <div className="text-center py-10 text-neutral-300 text-sm">
                      Nenhum bar global criado.<br />
                      <span className="text-xs">Os bares específicos de festival são criados dentro de cada festival.</span>
                    </div>
                  )}
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
