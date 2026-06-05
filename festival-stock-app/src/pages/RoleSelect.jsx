import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Search } from "lucide-react";
import { useAuth, ROLE_LABELS } from "../lib/AuthContext";
import db from "../lib/db";

export default function RoleSelect() {
  const { login, setCurrentFestival } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [allUsers, setAllUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [assignedFestivals, setAssignedFestivals] = useState([]);
  const [loadingFestivals, setLoadingFestivals] = useState(false);

  useEffect(() => {
    db.AppUser.list().then(setAllUsers);
  }, []);

  const filteredUsers = search.trim()
    ? allUsers.filter(u => u.name.toLowerCase().includes(search.toLowerCase()))
    : allUsers;

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setPin("");
    setPinError("");
    setStep(2);
  };

  const handlePin = async (e) => {
    e.preventDefault();
    if (pin !== selectedUser.pin) {
      setPinError("PIN incorreto. Tenta novamente.");
      setPin("");
      return;
    }
    login(selectedUser);

    if (selectedUser.role === "manager") {
      navigate("/FestivalSelect");
      return;
    }

    // Non-managers: load assigned festivals for inline step 3
    setLoadingFestivals(true);
    const allFestivals = await db.Festival.list();
    const ids = selectedUser.festival_ids || [];
    const mine = allFestivals.filter(f => ids.includes(f.id));
    setAssignedFestivals(mine);
    setLoadingFestivals(false);

    if (mine.length === 0) {
      // No festivals assigned — go to empty festival select
      navigate("/FestivalSelect");
      return;
    }
    if (mine.length === 1) {
      // Auto-select if only one
      setCurrentFestival(mine[0]);
      navigate("/Dashboard");
      return;
    }
    setStep(3);
  };

  const handleFestivalSelect = (festival) => {
    setCurrentFestival(festival);
    navigate("/Dashboard");
  };

  // ── Step 1: Select user ──────────────────────────────────────────────────
  if (step === 1) return (
    <div className="min-h-screen bg-[#F7F7F5] flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-neutral-900 rounded-2xl mb-4">
            <Lock className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-neutral-900">Bem-vindo</h1>
          <p className="text-neutral-400 mt-1 text-sm">Seleciona o teu nome para continuar</p>
        </div>

        <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Pesquisar nome..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
              className="w-full pl-9 pr-4 py-2.5 border border-neutral-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
          </div>
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {filteredUsers.map(u => (
              <button
                key={u.id}
                onClick={() => handleSelectUser(u)}
                className="w-full text-left px-4 py-3 rounded-xl hover:bg-neutral-50 border border-transparent hover:border-neutral-200 transition-all"
              >
                <div className="font-medium text-neutral-900">{u.name}</div>
                <div className="text-xs text-neutral-400 mt-0.5">{ROLE_LABELS[u.role] || u.role}</div>
              </button>
            ))}
            {filteredUsers.length === 0 && (
              <div className="text-center py-8 text-sm text-neutral-300">
                {search ? "Nenhum utilizador encontrado" : "Nenhum utilizador criado ainda"}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // ── Step 2: PIN ──────────────────────────────────────────────────────────
  if (step === 2) return (
    <div className="min-h-screen bg-[#F7F7F5] flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-neutral-900 rounded-2xl mb-4">
            <Lock className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-neutral-900">{selectedUser.name}</h1>
          <p className="text-neutral-400 mt-1 text-sm">{ROLE_LABELS[selectedUser.role]}</p>
        </div>

        <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm">
          <button
            onClick={() => { setStep(1); setSearch(""); }}
            className="text-xs text-neutral-400 hover:text-neutral-700 mb-5 flex items-center gap-1"
          >
            ← Voltar
          </button>
          <form onSubmit={handlePin}>
            <label className="block text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-2">
              PIN de Acesso
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={e => { setPin(e.target.value); setPinError(""); }}
              placeholder="••••"
              autoFocus
              className="w-full border border-neutral-200 rounded-xl px-4 py-3 text-center text-2xl tracking-widest focus:outline-none focus:ring-2 focus:ring-neutral-900 mb-3"
            />
            {pinError && <p className="text-red-500 text-sm text-center mb-3">{pinError}</p>}
            <button
              type="submit"
              disabled={!pin}
              className="w-full py-3 bg-neutral-900 text-white rounded-xl font-semibold text-sm hover:bg-neutral-700 transition-colors disabled:opacity-40"
            >
              {loadingFestivals ? "A carregar..." : "Entrar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  // ── Step 3: Festival selection (non-managers only) ───────────────────────
  const activeFestivals = assignedFestivals.filter(f => f.is_active && !f.is_closed);
  const otherFestivals = assignedFestivals.filter(f => !f.is_active || f.is_closed);

  return (
    <div className="min-h-screen bg-[#F7F7F5] flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-neutral-900">Seleciona o Festival</h1>
          <p className="text-neutral-400 mt-1 text-sm">Em qual festival vais trabalhar hoje?</p>
        </div>

        <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm">
          {activeFestivals.length > 0 && (
            <>
              <div className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-2">Ativos</div>
              <div className="space-y-2 mb-4">
                {activeFestivals.map(f => (
                  <button
                    key={f.id}
                    onClick={() => handleFestivalSelect(f)}
                    className="w-full text-left px-4 py-3 rounded-xl bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 transition-all"
                  >
                    <div className="font-semibold text-neutral-900">{f.name}</div>
                    {f.start_date && <div className="text-xs text-neutral-400 mt-0.5">{f.start_date}{f.end_date ? ` → ${f.end_date}` : ""}</div>}
                  </button>
                ))}
              </div>
            </>
          )}

          {selectedUser.role === "event_coordinator" && otherFestivals.length > 0 && (
            <>
              <div className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-2">Fechados</div>
              <div className="space-y-2">
                {otherFestivals.map(f => (
                  <button
                    key={f.id}
                    onClick={() => handleFestivalSelect(f)}
                    className="w-full text-left px-4 py-3 rounded-xl hover:bg-neutral-50 border border-neutral-200 text-neutral-500 transition-all"
                  >
                    <div className="font-medium">{f.name}</div>
                    {f.start_date && <div className="text-xs text-neutral-400 mt-0.5">{f.start_date}</div>}
                  </button>
                ))}
              </div>
            </>
          )}

          {activeFestivals.length === 0 && (
            <div className="text-center py-8 text-sm text-neutral-300">
              Não tens festivais ativos atribuídos
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
