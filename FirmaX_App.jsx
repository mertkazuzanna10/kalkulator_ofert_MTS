const { useState, useEffect, useCallback, useMemo } = React;

// ── Konfiguracja ──────────────────────────────────────────────────────────────
// Po wdrożeniu Google Apps Script, wklej tutaj URL wdrożenia:
const BACKEND_URL = "https://script.google.com/macros/s/AKfycbxYM8lylcLUH4_WwjOrpEiwyKKjWWU8V5Hhx7UMMXo6sk-6n5BGLW0jEWm3uRVaic4l/exec";
// Przykład: "https://script.google.com/macros/s/AKfycbx.../exec"

const DEMO_MODE = BACKEND_URL === "WKLEJ_TUTAJ_URL_APPS_SCRIPT";

// ── Demo dane ─────────────────────────────────────────────────────────────────
const DEMO_CONFIG = {
  days_total: 365, season_factor: 0.30, fte: 1, hours_per_day: 6,
  ha_per_hour: 5, margin: 0.35, vat_rate: 0.23,
  cost_equipment: 61000, cost_software: 13000,
  cost_operations: 86400, cost_training: 14000, cost_transport: 11500,
  pkg_discount_1: 1.00, pkg_discount_2: 0.93, pkg_discount_3: 0.87,
  pkg_discount_4: 0.82, pkg_discount_5: 0.78, pkg_discount_6: 0.75, pkg_discount_7: 0.72,
};

const DEMO_PRODUCTS = [
  { id:'1', nazwa:'Chmura punktów (fotogrametria)', mnoznik:1.20, min_kwota:500, uwagi:'Gęstość min. 50 pkt/m²' },
  { id:'2', nazwa:'Ortofotomapa', mnoznik:0.70, min_kwota:300, uwagi:'GSD ≤ 3 cm/px' },
  { id:'3', nazwa:'Model 3D (mesh / surface)', mnoznik:1.00, min_kwota:400, uwagi:'OBJ / LAS / PLY' },
  { id:'4', nazwa:'Raport / dokumentacja techniczna', mnoznik:0.50, min_kwota:500, uwagi:'PDF + dane źródłowe' },
  { id:'5', nazwa:'Inspekcja wizualna (foto / wideo)', mnoznik:0.60, min_kwota:400, uwagi:'RAW + edytowane' },
  { id:'6', nazwa:'Przekroje i pomiary', mnoznik:0.65, min_kwota:400, uwagi:'DWG / DXF' },
  { id:'7', nazwa:'Obliczenia mas ziemnych', mnoznik:0.80, min_kwota:600, uwagi:'Raport objętości' },
];

const DEMO_USERS = [
  { id:'1', imie:'Anna', nazwisko:'Kowalska' },
  { id:'2', imie:'Piotr', nazwisko:'Nowak' },
];

const DEMO_OFFERS = [
  {
    'Nr oferty':'O-MTS-2025-001','Data':'12.06.2025','Klient':'ABC Budownictwo Sp. z o.o.',
    'Lokalizacja':'Warszawa, ul. Przykładowa 1','Osoba':'Anna Kowalska',
    'Pow. (ha)':5,'L. produktów':3,'Suma przed zniżką':12500,'Mnożnik pakietowy':0.87,
    'Wartość netto':10875,'VAT':2501.25,'Wartość brutto':13376.25,'Ważność (dni)':14,
  },
  {
    'Nr oferty':'O-MTS-2025-002','Data':'14.06.2025','Klient':'XYZ Deweloper',
    'Lokalizacja':'Kraków, ul. Testowa 5','Osoba':'Piotr Nowak',
    'Pow. (ha)':12,'L. produktów':5,'Suma przed zniżką':34200,'Mnożnik pakietowy':0.78,
    'Wartość netto':26676,'VAT':6135.48,'Wartość brutto':32811.48,'Ważność (dni)':14,
  },
];

// ── API helper ─────────────────────────────────────────────────────────────────
async function api(action, params = {}) {
  if (DEMO_MODE) {
    await new Promise(r => setTimeout(r, 300));
    switch(action) {
      case 'login': return params.pin === '1234' ? { ok: true } : { ok: false, error: 'Nieprawidłowy PIN (demo: 1234)' };
      case 'getConfig': return { ok: true, config: DEMO_CONFIG, products: DEMO_PRODUCTS };
      case 'getUsers': return { ok: true, users: DEMO_USERS };
      case 'getRegister': return { ok: true, offers: DEMO_OFFERS };
      case 'getNextNumber': return { ok: true, nr: 'O-MTS-2025-003' };
      default: return { ok: true };
    }
  }
  const res = await fetch(BACKEND_URL, {
    method: 'POST',
    body: JSON.stringify({ action, ...params }),
  });
  return res.json();
}

// ── Formatowanie ──────────────────────────────────────────────────────────────
const pln = (n) => new Intl.NumberFormat('pl-PL', { style:'currency', currency:'PLN' }).format(n || 0);
const pct = (n) => `${Math.round((n || 0) * 100)}%`;
const today = () => new Date().toLocaleDateString('pl-PL');

// ── Oblicz breakeven ──────────────────────────────────────────────────────────
function calcBreakeven(cfg) {
  const total = +cfg.cost_equipment + +cfg.cost_software + +cfg.cost_operations + +cfg.cost_training + +cfg.cost_transport;
  const daysEff = +cfg.days_total * (1 - +cfg.season_factor);
  const hrsYear = daysEff * +cfg.fte * +cfg.hours_per_day;
  const haYear = hrsYear * +cfg.ha_per_hour;
  if (!haYear) return { breakeven: 0, suggested: 0, haYear: 0, totalCost: total };
  const margin = +cfg.margin;
  const breakeven = total / haYear;
  const suggested = breakeven / (1 - margin);
  return { breakeven, suggested, haYear, totalCost: total };
}

// ── Kolory ────────────────────────────────────────────────────────────────────
const C = {
  navy: '#1B3A5C', teal: '#1A7A6E', tealLite: '#D4EFEB',
  amber: '#F5A623', amberLt: '#FEF3DC',
  bg: '#F5F7FA', white: '#FFFFFF',
  gray100: '#F0F2F5', gray200: '#E2E6EA', gray400: '#9AA3AE', gray700: '#3D4A5C',
  red: '#E53935', green: '#2E7D32',
};

// ── Style ─────────────────────────────────────────────────────────────────────
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', system-ui, sans-serif; background: ${C.bg}; color: ${C.gray700}; }
  
  .app { display: flex; min-height: 100vh; }
  
  /* Sidebar */
  .sidebar {
    width: 220px; background: ${C.navy}; color: white;
    display: flex; flex-direction: column; position: fixed;
    top: 0; left: 0; height: 100vh; z-index: 100;
    transition: transform 0.2s;
  }
  .sidebar-logo {
    padding: 20px 16px 16px;
    border-bottom: 1px solid rgba(255,255,255,0.1);
  }
  .sidebar-logo h1 { font-size: 15px; font-weight: 700; letter-spacing: 0.5px; }
  .sidebar-logo p { font-size: 11px; color: rgba(255,255,255,0.5); margin-top: 2px; }
  .sidebar-nav { flex: 1; padding: 12px 0; overflow-y: auto; }
  .nav-item {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 16px; cursor: pointer; font-size: 13px; font-weight: 500;
    color: rgba(255,255,255,0.65); transition: all 0.15s; border-radius: 0;
    border-left: 3px solid transparent;
  }
  .nav-item:hover { background: rgba(255,255,255,0.07); color: white; }
  .nav-item.active { background: rgba(26,122,110,0.25); color: white; border-left-color: ${C.teal}; }
  .nav-icon { font-size: 16px; width: 20px; text-align: center; }
  .sidebar-footer { padding: 12px 16px; border-top: 1px solid rgba(255,255,255,0.1); }
  .sidebar-footer button {
    width: 100%; padding: 8px; background: rgba(255,255,255,0.07);
    border: 1px solid rgba(255,255,255,0.15); color: rgba(255,255,255,0.7);
    border-radius: 6px; cursor: pointer; font-size: 12px;
  }
  
  /* Main content */
  .main { margin-left: 220px; flex: 1; display: flex; flex-direction: column; min-height: 100vh; }
  .topbar {
    background: white; border-bottom: 1px solid ${C.gray200};
    padding: 14px 28px; display: flex; align-items: center; justify-content: space-between;
    position: sticky; top: 0; z-index: 50;
  }
  .topbar-title { font-size: 16px; font-weight: 600; color: ${C.navy}; }
  .topbar-meta { font-size: 12px; color: ${C.gray400}; }
  .content { padding: 28px; flex: 1; max-width: 1100px; }
  
  /* Demo banner */
  .demo-banner {
    background: ${C.amberLt}; border: 1px solid ${C.amber};
    border-radius: 8px; padding: 10px 16px; margin-bottom: 20px;
    font-size: 13px; color: #7a5200;
  }
  
  /* Cards */
  .card {
    background: white; border-radius: 10px;
    border: 1px solid ${C.gray200}; padding: 20px;
    margin-bottom: 16px;
  }
  .card-title {
    font-size: 13px; font-weight: 600; color: ${C.navy};
    text-transform: uppercase; letter-spacing: 0.6px;
    margin-bottom: 16px; padding-bottom: 12px;
    border-bottom: 2px solid ${C.tealLite};
  }
  .card-section {
    background: ${C.gray100}; border-radius: 8px; padding: 14px 16px;
    margin-bottom: 12px;
  }
  .card-section-title {
    font-size: 11px; font-weight: 600; color: ${C.teal};
    text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 10px;
  }
  
  /* Grid helpers */
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
  .grid4 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 12px; }
  
  /* Form elements */
  .field { display: flex; flex-direction: column; gap: 4px; }
  .field label { font-size: 11px; font-weight: 600; color: ${C.gray400}; text-transform: uppercase; letter-spacing: 0.5px; }
  .field input, .field select, .field textarea {
    padding: 8px 10px; border: 1.5px solid ${C.gray200};
    border-radius: 6px; font-size: 13px; font-family: inherit;
    color: ${C.gray700}; background: white;
    transition: border-color 0.15s;
    outline: none;
  }
  .field input:focus, .field select:focus, .field textarea:focus {
    border-color: ${C.teal}; box-shadow: 0 0 0 3px rgba(26,122,110,0.1);
  }
  .field input.editable { background: #EBF5FB; border-color: #90CAF9; }
  .field-note { font-size: 11px; color: ${C.gray400}; margin-top: 2px; }
  
  /* Buttons */
  .btn {
    padding: 9px 18px; border-radius: 7px; font-size: 13px; font-weight: 600;
    cursor: pointer; border: none; transition: all 0.15s; font-family: inherit;
    display: inline-flex; align-items: center; gap: 7px;
  }
  .btn-primary { background: ${C.teal}; color: white; }
  .btn-primary:hover { background: #15695e; }
  .btn-navy { background: ${C.navy}; color: white; }
  .btn-navy:hover { background: #142e4a; }
  .btn-amber { background: ${C.amber}; color: white; }
  .btn-amber:hover { background: #d9921a; }
  .btn-ghost { background: transparent; color: ${C.navy}; border: 1.5px solid ${C.gray200}; }
  .btn-ghost:hover { background: ${C.gray100}; }
  .btn-danger { background: ${C.red}; color: white; }
  .btn-danger:hover { background: #c62828; }
  .btn-sm { padding: 6px 12px; font-size: 12px; }
  
  /* Tables */
  .table-wrap { overflow-x: auto; border-radius: 8px; border: 1px solid ${C.gray200}; }
  table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  thead th {
    background: ${C.navy}; color: white; padding: 10px 12px;
    text-align: left; font-size: 11px; font-weight: 600;
    letter-spacing: 0.5px; white-space: nowrap;
  }
  tbody tr { border-bottom: 1px solid ${C.gray200}; transition: background 0.1s; }
  tbody tr:hover { background: ${C.tealLite}; }
  tbody tr:last-child { border-bottom: none; }
  td { padding: 10px 12px; color: ${C.gray700}; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  td.mono { font-family: monospace; font-size: 12px; color: ${C.navy}; font-weight: 600; }
  
  /* Summary box */
  .summary-box {
    background: ${C.navy}; color: white; border-radius: 10px;
    padding: 20px; margin-top: 8px;
  }
  .summary-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 6px 0; font-size: 13px; border-bottom: 1px solid rgba(255,255,255,0.1);
  }
  .summary-row:last-child { border-bottom: none; }
  .summary-row.total {
    font-size: 16px; font-weight: 700; padding-top: 12px; margin-top: 4px;
    border-top: 2px solid rgba(255,255,255,0.2); border-bottom: none;
    color: ${C.amber};
  }
  .summary-label { color: rgba(255,255,255,0.7); }
  .summary-value { font-weight: 600; font-variant-numeric: tabular-nums; }
  
  /* Product toggle */
  .product-row {
    display: grid; grid-template-columns: 32px 1fr 100px 100px 110px 130px;
    gap: 10px; align-items: center;
    padding: 10px 12px; border-radius: 8px;
    border: 1.5px solid ${C.gray200}; margin-bottom: 6px;
    transition: all 0.15s; background: white;
  }
  .product-row.selected {
    border-color: ${C.teal}; background: ${C.tealLite};
  }
  .product-toggle {
    width: 22px; height: 22px; border-radius: 5px;
    border: 2px solid ${C.gray200}; background: white;
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    font-size: 13px; transition: all 0.15s; flex-shrink: 0;
  }
  .product-toggle.checked { background: ${C.teal}; border-color: ${C.teal}; color: white; }
  .product-name { font-size: 13px; font-weight: 500; color: ${C.navy}; }
  .product-note { font-size: 11px; color: ${C.gray400}; }
  .product-col-hdr {
    display: grid; grid-template-columns: 32px 1fr 100px 100px 110px 130px;
    gap: 10px; padding: 6px 12px; margin-bottom: 4px;
  }
  .col-hdr { font-size: 10px; font-weight: 600; color: ${C.gray400}; text-transform: uppercase; letter-spacing: 0.5px; }
  
  /* Stat cards */
  .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 24px; }
  .stat-card { background: white; border-radius: 10px; border: 1px solid ${C.gray200}; padding: 16px; }
  .stat-label { font-size: 11px; color: ${C.gray400}; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
  .stat-value { font-size: 22px; font-weight: 700; color: ${C.navy}; margin-top: 4px; }
  .stat-sub { font-size: 11px; color: ${C.gray400}; margin-top: 2px; }
  .stat-accent { color: ${C.teal}; }
  
  /* Login */
  .login-screen {
    min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: linear-gradient(135deg, ${C.navy} 0%, #0d2438 100%);
  }
  .login-box {
    background: white; border-radius: 16px; padding: 40px;
    width: 360px; box-shadow: 0 24px 48px rgba(0,0,0,0.3);
  }
  .login-logo { text-align: center; margin-bottom: 28px; }
  .login-logo h1 { font-size: 22px; font-weight: 700; color: ${C.navy}; }
  .login-logo p { font-size: 13px; color: ${C.gray400}; margin-top: 4px; }
  .pin-input {
    width: 100%; padding: 14px; text-align: center; font-size: 22px;
    letter-spacing: 8px; border: 2px solid ${C.gray200};
    border-radius: 10px; outline: none; font-family: monospace;
    transition: border-color 0.15s;
  }
  .pin-input:focus { border-color: ${C.teal}; }
  .login-error { color: ${C.red}; font-size: 13px; text-align: center; margin-top: 10px; }
  
  /* Tabs */
  .tabs { display: flex; gap: 4px; margin-bottom: 20px; background: ${C.gray100}; padding: 4px; border-radius: 8px; }
  .tab { flex: 1; padding: 8px; text-align: center; font-size: 12px; font-weight: 600; cursor: pointer; border-radius: 6px; color: ${C.gray400}; transition: all 0.15s; }
  .tab.active { background: white; color: ${C.navy}; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  
  /* Badge */
  .badge {
    display: inline-flex; align-items: center; padding: 3px 8px;
    border-radius: 99px; font-size: 11px; font-weight: 600;
  }
  .badge-teal { background: ${C.tealLite}; color: ${C.teal}; }
  .badge-amber { background: ${C.amberLt}; color: #7a5200; }
  
  /* Toast */
  .toast {
    position: fixed; bottom: 24px; right: 24px; z-index: 999;
    background: ${C.navy}; color: white; padding: 12px 20px;
    border-radius: 10px; font-size: 13px; font-weight: 500;
    box-shadow: 0 8px 24px rgba(0,0,0,0.3); animation: slideIn 0.3s ease;
    display: flex; align-items: center; gap: 10px;
  }
  .toast.success { background: ${C.teal}; }
  .toast.error { background: ${C.red}; }
  @keyframes slideIn { from { transform: translateY(12px); opacity:0; } to { transform: translateY(0); opacity:1; } }
  
  /* Responsive */
  @media (max-width: 768px) {
    .sidebar { transform: translateX(-220px); }
    .main { margin-left: 0; }
    .stat-grid { grid-template-columns: 1fr 1fr; }
    .grid2, .grid3, .grid4 { grid-template-columns: 1fr; }
    .product-row { grid-template-columns: 32px 1fr 90px; }
    .product-row > *:nth-child(n+4) { display: none; }
  }
`;

// ══════════════════════════════════════════════════════════════════════════════
// GŁÓWNA APLIKACJA
// ══════════════════════════════════════════════════════════════════════════════
function App() {
  const [logged, setLogged] = useState(false);
  const [view, setView] = useState('dashboard');
  const [toast, setToast] = useState(null);
  const [config, setConfig] = useState(null);
  const [products, setProducts] = useState([]);
  const [users, setUsers] = useState([]);
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(false);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [cfgRes, usersRes, regRes] = await Promise.all([
        api('getConfig'), api('getUsers'), api('getRegister')
      ]);
      if (cfgRes.ok) { setConfig(cfgRes.config); setProducts(cfgRes.products); }
      if (usersRes.ok) setUsers(usersRes.users);
      if (regRes.ok) setOffers(regRes.offers);
    } catch(e) { showToast('Błąd połączenia z bazą', 'error'); }
    setLoading(false);
  }, []);

  useEffect(() => { if (logged) loadData(); }, [logged, loadData]);

  if (!logged) return <LoginScreen onLogin={() => setLogged(true)} />;

  const nav = [
    { id:'dashboard', icon:'📊', label:'Pulpit' },
    { id:'offer', icon:'➕', label:'Nowa oferta' },
    { id:'register', icon:'📋', label:'Rejestr ofert' },
    { id:'rates', icon:'💰', label:'Kalkulacja stawek' },
    { id:'settings', icon:'⚙️', label:'Ustawienia' },
  ];

  const titles = {
    dashboard: 'Pulpit', offer: 'Nowa oferta',
    register: 'Rejestr ofert', rates: 'Kalkulacja stawek', settings: 'Ustawienia',
  };

  return (
    <>
      <style>{styles}</style>
      <div className="app">
        <nav className="sidebar">
          <div className="sidebar-logo">
            <h1>FIRMA X</h1>
            <p>Kalkulator ofert</p>
          </div>
          <div className="sidebar-nav">
            {nav.map(n => (
              <div key={n.id}
                className={`nav-item ${view === n.id ? 'active' : ''}`}
                onClick={() => setView(n.id)}>
                <span className="nav-icon">{n.icon}</span>
                {n.label}
              </div>
            ))}
          </div>
          <div className="sidebar-footer">
            <button onClick={() => setLogged(false)}>🔒 Wyloguj</button>
          </div>
        </nav>

        <div className="main">
          <div className="topbar">
            <span className="topbar-title">{titles[view]}</span>
            <span className="topbar-meta">{DEMO_MODE ? '⚠ Tryb demo' : '✓ Połączono z Google Sheets'} · {today()}</span>
          </div>
          <div className="content">
            {DEMO_MODE && (
              <div className="demo-banner">
                ⚠ <strong>Tryb demo</strong> — dane nie są zapisywane. Wdróż Google Apps Script i wklej URL w pliku aby aktywować pełną funkcjonalność. PIN demo: <strong>1234</strong>
              </div>
            )}
            {loading && <div style={{textAlign:'center',padding:'40px',color:C.gray400}}>Ładowanie danych…</div>}
            {!loading && view === 'dashboard' && <Dashboard offers={offers} config={config} products={products} setView={setView} />}
            {!loading && view === 'offer' && <NewOffer config={config} products={products} users={users} showToast={showToast} onSaved={() => { loadData(); setView('register'); }} />}
            {!loading && view === 'register' && <Register offers={offers} />}
            {!loading && view === 'rates' && <Rates config={config} products={products} showToast={showToast} onSaved={loadData} />}
            {!loading && view === 'settings' && <Settings users={users} config={config} showToast={showToast} onSaved={loadData} />}
          </div>
        </div>
      </div>
      {toast && <div className={`toast ${toast.type}`}>{toast.type==='success'?'✓':'✕'} {toast.msg}</div>}
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// LOGIN
// ══════════════════════════════════════════════════════════════════════════════
function LoginScreen({ onLogin }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true); setError('');
    const res = await api('login', { pin });
    if (res.ok) { onLogin(); }
    else { setError(res.error || 'Nieprawidłowy PIN'); }
    setLoading(false);
  };

  return (
    <>
      <style>{styles}</style>
      <div className="login-screen">
        <div className="login-box">
          <div className="login-logo">
            <h1>FIRMA X</h1>
            <p>Kalkulator ofert — panel dostępu</p>
          </div>
          <div className="field">
            <label>PIN dostępu</label>
            <input
              className="pin-input"
              type="password"
              placeholder="• • • •"
              value={pin}
              onChange={e => setPin(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              autoFocus
            />
          </div>
          {error && <div className="login-error">{error}</div>}
          <button
            className="btn btn-navy"
            style={{width:'100%',marginTop:'16px',justifyContent:'center',padding:'12px'}}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Sprawdzanie…' : 'Wejdź →'}
          </button>
        </div>
      </div>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════
function Dashboard({ offers, config, products, setView }) {
  const totalBrutto = offers.reduce((s, o) => s + (+o['Wartość brutto'] || 0), 0);
  const thisYear = new Date().getFullYear();
  const ofersYear = offers.filter(o => o['Nr oferty']?.includes(String(thisYear)));
  const avgVal = offers.length ? totalBrutto / offers.length : 0;

  const rates = config ? calcBreakeven(config) : null;

  return (
    <div>
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Wszystkich ofert</div>
          <div className="stat-value">{offers.length}</div>
          <div className="stat-sub">{ofersYear.length} w {thisYear} roku</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Łączna wartość brutto</div>
          <div className="stat-value stat-accent" style={{fontSize:'18px'}}>{pln(totalBrutto)}</div>
          <div className="stat-sub">wszystkie oferty</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Śr. wartość oferty</div>
          <div className="stat-value" style={{fontSize:'18px'}}>{pln(avgVal)}</div>
          <div className="stat-sub">brutto</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Stawka sugerowana</div>
          <div className="stat-value stat-accent" style={{fontSize:'18px'}}>
            {rates ? `${Math.round(rates.suggested)} zł/ha` : '—'}
          </div>
          <div className="stat-sub">break-even + marża</div>
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <div className="card-title">Ostatnie oferty</div>
          {offers.length === 0 && <p style={{color:C.gray400,fontSize:13}}>Brak ofert. Stwórz pierwszą!</p>}
          {offers.slice(-5).reverse().map((o, i) => (
            <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:`1px solid ${C.gray200}`}}>
              <div>
                <div style={{fontSize:13,fontWeight:600,color:C.navy}}>{o['Nr oferty']}</div>
                <div style={{fontSize:11,color:C.gray400}}>{o['Klient']} · {o['Data']}</div>
              </div>
              <div style={{fontWeight:700,fontSize:13,color:C.teal}}>{pln(o['Wartość brutto'])}</div>
            </div>
          ))}
          <button className="btn btn-ghost btn-sm" style={{marginTop:12}} onClick={() => setView('offer')}>
            ➕ Nowa oferta
          </button>
        </div>

        <div className="card">
          <div className="card-title">Parametry kalkulacji</div>
          {config && (
            <div style={{fontSize:13}}>
              {[
                ['Sezonowość (przestoje)', pct(config.season_factor)],
                ['Potencjał ha/rok', `${Math.round(rates?.haYear || 0)} ha`],
                ['Łączne koszty roczne', pln(rates?.totalCost || 0)],
                ['Stawka break-even', `${Math.round(rates?.breakeven || 0)} zł/ha`],
                ['Marża', pct(config.margin)],
                ['Stawka sugerowana', `${Math.round(rates?.suggested || 0)} zł/ha`],
              ].map(([k,v]) => (
                <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'6px 0',borderBottom:`1px solid ${C.gray200}`}}>
                  <span style={{color:C.gray400}}>{k}</span>
                  <span style={{fontWeight:600,color:C.navy}}>{v}</span>
                </div>
              ))}
            </div>
          )}
          <button className="btn btn-ghost btn-sm" style={{marginTop:12}} onClick={() => setView('rates')}>
            ⚙️ Edytuj parametry
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// NOWA OFERTA
// ══════════════════════════════════════════════════════════════════════════════
function NewOffer({ config, products, users, showToast, onSaved }) {
  const [offerNr, setOfferNr] = useState('');
  const [klient, setKlient] = useState('');
  const [lokalizacja, setLokalizacja] = useState('');
  const [uwagi, setUwagi] = useState('');
  const [ha, setHa] = useState(5);
  const [waznosc, setWaznosc] = useState(14);
  const [userId, setUserId] = useState('');
  const [sel, setSel] = useState({});       // { productId: true/false }
  const [korekt, setKorekt] = useState({});  // { productId: 1.00 }
  const [kosztStale, setKosztStale] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api('getNextNumber').then(r => { if (r.ok) setOfferNr(r.nr); });
  }, []);

  const vatRate = config ? +config.vat_rate : 0.23;
  const discounts = config ? [1,2,3,4,5,6,7].map(n => +(config[`pkg_discount_${n}`] || 1)) : Array(7).fill(1);

  const selected = products.filter(p => sel[p.id]);
  const pkgMultiplier = discounts[Math.min(selected.length, 7) - 1] ?? 1;

  const calcProduct = (p) => {
    const stawka = +p.stawka_bazowa || Math.round((calcBreakeven(config || DEMO_CONFIG).suggested) * +p.mnoznik);
    const kore = +(korekt[p.id] ?? 1);
    const cena = Math.max(+p.min_kwota, stawka * kore * +ha);
    return { stawka, kore, cena };
  };

  const sumaBefore = selected.reduce((s, p) => s + calcProduct(p).cena, 0);
  const sumaNetto = sumaBefore * pkgMultiplier + +kosztStale;
  const vat = sumaNetto * vatRate;
  const brutto = sumaNetto + vat;

  const toggleProduct = (id) => setSel(s => ({ ...s, [id]: !s[id] }));
  const setKorekt1 = (id, v) => setKorekt(k => ({ ...k, [id]: v }));

  const handleSave = async () => {
    if (!klient) { showToast('Podaj nazwę klienta', 'error'); return; }
    if (!userId) { showToast('Wybierz osobę przygotowującą ofertę', 'error'); return; }
    if (selected.length === 0) { showToast('Wybierz co najmniej jeden produkt', 'error'); return; }

    setSaving(true);
    const user = users.find(u => String(u.id) === String(userId));
    const userName = user ? `${user.imie} ${user.nazwisko}` : '';

    const productKeys = ['chmura_punktow','ortofotomapa','model_3d','raport','inspekcja','przekroje','masy_ziemne'];
    const productAmounts = {};
    products.forEach((p, i) => {
      productAmounts[productKeys[i]] = sel[p.id] ? calcProduct(p).cena : 0;
    });

    const offer = {
      nr_oferty: offerNr, data: today(), klient, lokalizacja, uwagi,
      powierzchnia: +ha, l_produktow: selected.length, osoba: userName,
      ...productAmounts,
      suma_przed_znizka: sumaBefore,
      mnoznik_pakietowy: pkgMultiplier,
      koszty_stale: +kosztStale,
      netto: sumaNetto, vat, brutto,
      waznosc: +waznosc,
    };

    const res = await api('saveOffer', { offer });
    if (res.ok) {
      showToast(`Oferta ${offerNr} zapisana w rejestrze!`);
      onSaved();
    } else {
      showToast(res.error || 'Błąd zapisu', 'error');
    }
    setSaving(false);
  };

  return (
    <div>
      {/* Numer oferty */}
      <div className="card">
        <div className="card-title">Dane oferty</div>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16,padding:'10px 14px',background:C.navy,borderRadius:8}}>
          <span style={{color:'rgba(255,255,255,0.6)',fontSize:12}}>Numer oferty:</span>
          <span style={{color:C.amber,fontWeight:700,fontSize:18,fontFamily:'monospace',letterSpacing:1}}>{offerNr || '…'}</span>
          <span style={{marginLeft:'auto',color:'rgba(255,255,255,0.5)',fontSize:11}}>generowany automatycznie</span>
        </div>

        <div className="grid2" style={{marginBottom:12}}>
          <div className="field">
            <label>Klient *</label>
            <input className="editable" placeholder="Nazwa firmy lub klienta" value={klient} onChange={e => setKlient(e.target.value)} />
          </div>
          <div className="field">
            <label>Lokalizacja</label>
            <input className="editable" placeholder="Adres lub opis lokalizacji" value={lokalizacja} onChange={e => setLokalizacja(e.target.value)} />
          </div>
        </div>
        <div className="grid3">
          <div className="field">
            <label>Powierzchnia (ha) *</label>
            <input className="editable" type="number" min="0.1" step="0.1" value={ha} onChange={e => setHa(e.target.value)} />
          </div>
          <div className="field">
            <label>Ważność oferty (dni)</label>
            <input className="editable" type="number" min="1" value={waznosc} onChange={e => setWaznosc(e.target.value)} />
          </div>
          <div className="field">
            <label>Osoba przygotowująca *</label>
            <select className="editable" value={userId} onChange={e => setUserId(e.target.value)}>
              <option value="">— wybierz —</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.imie} {u.nazwisko}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="field" style={{marginTop:10}}>
          <label>Uwagi</label>
          <textarea className="editable" rows={2} placeholder="Opcjonalne uwagi do oferty" value={uwagi} onChange={e => setUwagi(e.target.value)} style={{resize:'vertical'}} />
        </div>
      </div>

      {/* Produkty */}
      <div className="card">
        <div className="card-title">Produkty i korekty ceny</div>
        <div className="product-col-hdr">
          <div className="col-hdr"></div>
          <div className="col-hdr">Produkt</div>
          <div className="col-hdr" style={{textAlign:'right'}}>Stawka/ha</div>
          <div className="col-hdr" style={{textAlign:'center'}}>Korekta</div>
          <div className="col-hdr" style={{textAlign:'right'}}>Po korekcie/ha</div>
          <div className="col-hdr" style={{textAlign:'right'}}>Kwota netto</div>
        </div>
        {products.map(p => {
          const { stawka, kore, cena } = calcProduct(p);
          const isSelected = !!sel[p.id];
          return (
            <div key={p.id} className={`product-row ${isSelected ? 'selected' : ''}`}>
              <div className={`product-toggle ${isSelected ? 'checked' : ''}`} onClick={() => toggleProduct(p.id)}>
                {isSelected ? '✓' : ''}
              </div>
              <div>
                <div className="product-name">{p.nazwa}</div>
                <div className="product-note">{p.uwagi}</div>
              </div>
              <div style={{textAlign:'right',fontSize:13,fontWeight:500,color:C.gray700}}>
                {Math.round(stawka)} zł
              </div>
              <div>
                <input
                  type="number" min="0.1" max="5" step="0.05"
                  value={kore}
                  onChange={e => setKorekt1(p.id, +e.target.value)}
                  disabled={!isSelected}
                  style={{
                    width:'100%', padding:'5px 6px', textAlign:'center',
                    border:`1.5px solid ${isSelected ? C.teal : C.gray200}`,
                    borderRadius:6, fontSize:13, fontFamily:'inherit',
                    background: isSelected ? 'white' : C.gray100,
                    color: kore !== 1 ? C.amber : C.gray700, fontWeight: kore !== 1 ? 700 : 400,
                  }}
                />
              </div>
              <div style={{textAlign:'right',fontSize:13,color:isSelected ? C.navy : C.gray400}}>
                {isSelected ? `${Math.round(stawka * kore)} zł` : '—'}
              </div>
              <div style={{textAlign:'right',fontSize:13,fontWeight:isSelected ? 700 : 400,color:isSelected ? C.teal : C.gray400}}>
                {isSelected ? pln(cena) : '—'}
              </div>
            </div>
          );
        })}

        {/* Koszty stałe */}
        <div style={{marginTop:12,padding:'10px 12px',background:C.amberLt,borderRadius:8,display:'flex',alignItems:'center',gap:12}}>
          <span style={{fontSize:13,color:C.gray700,flex:1}}>Koszty dodatkowe (dojazd, BVLOS, noclegi…)</span>
          <div className="field" style={{width:180,marginBottom:0}}>
            <input type="number" min="0" step="50" value={kosztStale}
              onChange={e => setKosztStale(e.target.value)}
              style={{padding:'6px 10px',border:`1.5px solid ${C.amber}`,borderRadius:6,fontSize:13,textAlign:'right'}}
              placeholder="0 zł"
            />
          </div>
        </div>
      </div>

      {/* Podsumowanie */}
      <div className="card">
        <div className="card-title">Podsumowanie oferty</div>
        {selected.length > 0 ? (
          <div className="summary-box">
            <div className="summary-row">
              <span className="summary-label">Liczba produktów</span>
              <span className="summary-value">{selected.length}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Suma przed zniżką</span>
              <span className="summary-value">{pln(sumaBefore)}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">Zniżka pakietowa ({pct(1 - pkgMultiplier)})</span>
              <span className="summary-value" style={{color:'#FFD54F'}}>
                {selected.length > 1 ? `−${pln(sumaBefore * (1 - pkgMultiplier))}` : '—'}
              </span>
            </div>
            {+kosztStale > 0 && (
              <div className="summary-row">
                <span className="summary-label">Koszty dodatkowe</span>
                <span className="summary-value">+{pln(+kosztStale)}</span>
              </div>
            )}
            <div className="summary-row">
              <span className="summary-label">Wartość netto</span>
              <span className="summary-value">{pln(sumaNetto)}</span>
            </div>
            <div className="summary-row">
              <span className="summary-label">VAT ({pct(vatRate)})</span>
              <span className="summary-value">{pln(vat)}</span>
            </div>
            <div className="summary-row total">
              <span>WARTOŚĆ BRUTTO</span>
              <span>{pln(brutto)}</span>
            </div>
          </div>
        ) : (
          <p style={{color:C.gray400,fontSize:13,textAlign:'center',padding:'20px'}}>
            Zaznacz co najmniej jeden produkt, aby zobaczyć podsumowanie.
          </p>
        )}

        <div style={{display:'flex',gap:10,marginTop:16,justifyContent:'flex-end'}}>
          <button className="btn btn-ghost" onClick={() => {
            setSel({}); setKlient(''); setLokalizacja(''); setHa(5); setKosztStale(0);
          }}>Wyczyść</button>
          <button className="btn btn-amber" onClick={handleSave} disabled={saving}>
            {saving ? 'Zapisywanie…' : '📋 Przenieś do rejestru'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// REJESTR
// ══════════════════════════════════════════════════════════════════════════════
function Register({ offers }) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('desc');

  const filtered = useMemo(() => {
    let list = [...offers];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(o =>
        o['Nr oferty']?.toLowerCase().includes(q) ||
        o['Klient']?.toLowerCase().includes(q) ||
        o['Osoba']?.toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => sort === 'desc'
      ? String(b['Nr oferty']).localeCompare(String(a['Nr oferty']))
      : String(a['Nr oferty']).localeCompare(String(b['Nr oferty']))
    );
    return list;
  }, [offers, search, sort]);

  const totalNetto = filtered.reduce((s, o) => s + (+o['Wartość netto'] || 0), 0);
  const totalBrutto = filtered.reduce((s, o) => s + (+o['Wartość brutto'] || 0), 0);

  return (
    <div>
      <div style={{display:'flex',gap:10,marginBottom:16,alignItems:'center'}}>
        <input
          style={{flex:1,padding:'9px 12px',border:`1.5px solid ${C.gray200}`,borderRadius:8,fontSize:13,fontFamily:'inherit'}}
          placeholder="Szukaj po numerze, kliencie lub osobie…"
          value={search} onChange={e => setSearch(e.target.value)}
        />
        <button className="btn btn-ghost btn-sm" onClick={() => setSort(s => s === 'desc' ? 'asc' : 'desc')}>
          {sort === 'desc' ? '↓ Najnowsze' : '↑ Najstarsze'}
        </button>
        <span className="badge badge-teal">{filtered.length} ofert</span>
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{textAlign:'center',padding:'40px',color:C.gray400}}>
          {offers.length === 0 ? 'Brak ofert w rejestrze. Stwórz pierwszą!' : 'Brak wyników dla podanego wyszukiwania.'}
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nr oferty</th>
                <th>Data</th>
                <th>Klient</th>
                <th>Lokalizacja</th>
                <th>Osoba</th>
                <th>Ha</th>
                <th>Prod.</th>
                <th>Netto</th>
                <th>Brutto</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o, i) => (
                <tr key={i}>
                  <td className="mono">{o['Nr oferty']}</td>
                  <td style={{whiteSpace:'nowrap'}}>{o['Data']}</td>
                  <td style={{maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o['Klient']}</td>
                  <td style={{maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:C.gray400,fontSize:12}}>{o['Lokalizacja']}</td>
                  <td style={{fontSize:12}}>{o['Osoba']}</td>
                  <td className="num">{(+o['Pow. (ha)'] || 0).toFixed(1)}</td>
                  <td className="num">{o['L. produktów']}</td>
                  <td className="num">{pln(o['Wartość netto'])}</td>
                  <td className="num" style={{fontWeight:700,color:C.teal}}>{pln(o['Wartość brutto'])}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{background:C.navy,color:'white'}}>
                <td colSpan={7} style={{padding:'10px 12px',fontWeight:600,fontSize:12}}>SUMA ({filtered.length} ofert)</td>
                <td className="num" style={{color:'white',fontWeight:700}}>{pln(totalNetto)}</td>
                <td className="num" style={{color:C.amber,fontWeight:700}}>{pln(totalBrutto)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// KALKULACJA STAWEK
// ══════════════════════════════════════════════════════════════════════════════
function Rates({ config: initConfig, products: initProducts, showToast, onSaved }) {
  const [cfg, setCfg] = useState(initConfig || DEMO_CONFIG);
  const [prods, setProds] = useState(initProducts || DEMO_PRODUCTS);
  const [discounts, setDiscounts] = useState(
    initConfig ? [1,2,3,4,5,6,7].map(n => +(initConfig[`pkg_discount_${n}`] || 1)) : [1.00,0.93,0.87,0.82,0.78,0.75,0.72]
  );
  const [tab, setTab] = useState('koszty');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initConfig) {
      setCfg(initConfig);
      setDiscounts([1,2,3,4,5,6,7].map(n => +(initConfig[`pkg_discount_${n}`] || 1)));
    }
    if (initProducts) setProds(initProducts);
  }, [initConfig, initProducts]);

  const rates = calcBreakeven(cfg);
  const set = (k, v) => setCfg(c => ({ ...c, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    const configUpdate = { ...cfg };
    discounts.forEach((v, i) => { configUpdate[`pkg_discount_${i+1}`] = v; });
    const res = await api('saveConfig', { config: configUpdate, products: prods, discounts });
    if (res.ok) { showToast('Konfiguracja zapisana!'); onSaved(); }
    else showToast(res.error || 'Błąd zapisu', 'error');
    setSaving(false);
  };

  const Field = ({ label, k, type = 'number', step = 1, note, suffix }) => (
    <div className="field">
      <label>{label}{suffix ? ` (${suffix})` : ''}</label>
      <input
        className="editable" type={type} step={step}
        value={cfg[k] ?? ''}
        onChange={e => set(k, type === 'number' ? +e.target.value : e.target.value)}
      />
      {note && <span className="field-note">{note}</span>}
    </div>
  );

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
        <div className="tabs" style={{flex:1,marginRight:12,marginBottom:0}}>
          {[['koszty','Koszty firmy'],['produkty','Produkty i stawki'],['znizki','Zniżki pakietowe']].map(([id,label]) => (
            <div key={id} className={`tab ${tab===id?'active':''}`} onClick={() => setTab(id)}>{label}</div>
          ))}
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Zapisywanie…' : '💾 Zapisz konfigurację'}
        </button>
      </div>

      {/* ── Wynikowa stawka (zawsze widoczna) ── */}
      <div style={{background:C.navy,color:'white',borderRadius:10,padding:'14px 20px',marginBottom:16,display:'flex',gap:24,flexWrap:'wrap'}}>
        {[
          ['Łączne koszty roczne', pln(rates.totalCost)],
          ['Potencjał ha/rok', `${Math.round(rates.haYear)} ha`],
          ['Break-even', `${Math.round(rates.breakeven)} zł/ha`],
          ['Marża', pct(cfg.margin)],
          ['Stawka sugerowana', `${Math.round(rates.suggested)} zł/ha`],
        ].map(([k,v]) => (
          <div key={k}>
            <div style={{fontSize:10,color:'rgba(255,255,255,0.5)',textTransform:'uppercase',letterSpacing:'0.5px'}}>{k}</div>
            <div style={{fontSize:15,fontWeight:700,color:k==='Stawka sugerowana'?C.amber:'white',marginTop:2}}>{v}</div>
          </div>
        ))}
      </div>

      {tab === 'koszty' && (
        <div>
          <div className="card">
            <div className="card-title">A. Założenia podstawowe</div>
            <div className="grid3">
              <Field label="Dni w roku" k="days_total" note="Kalendarzowych" />
              <Field label="Czynnik przestojów" k="season_factor" step={0.01} note="Zima, deszcz (0.30 = 30% czasu)" />
              <Field label="Liczba pilotów (FTE)" k="fte" step={0.5} />
              <Field label="Godziny operacyjne / dzień" k="hours_per_day" step={0.5} note="Bez dojazdu i administracji" />
              <Field label="Ha nalotu / godzinę lotu" k="ha_per_hour" step={0.5} />
              <Field label="Marża (%)" k="margin" step={0.01} note="np. 0.35 = 35%" />
            </div>
          </div>

          {[
            ['B. Koszty sprzętu (rocznie, zł)', 'cost_equipment', 'Dron, baterie, kontroler, ubezpieczenie, serwis'],
            ['C. Oprogramowanie (rocznie, zł)', 'cost_software', 'Pix4D, AutoCAD, Revit, inne licencje'],
            ['D. Koszty operacyjne firmy (rocznie, zł)', 'cost_operations', 'Wynagrodzenie/ZUS, biuro, księgowość, marketing'],
            ['E. Szkolenia i certyfikaty (rocznie, zł)', 'cost_training', 'UAVO, BVLOS, ubezpieczenie OC, inne kursy'],
            ['F. Transport — koszty stałe (rocznie, zł)', 'cost_transport', 'Amortyzacja auta, paliwo bazowe, ubezpieczenie'],
          ].map(([label, k, note]) => (
            <div className="card" key={k}>
              <div className="card-title">{label}</div>
              <div className="field" style={{maxWidth:320}}>
                <label>Łączna kwota roczna</label>
                <input className="editable" type="number" step={100} value={cfg[k] || 0} onChange={e => set(k, +e.target.value)} />
                <span className="field-note">{note}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'produkty' && (
        <div className="card">
          <div className="card-title">Produkty i stawki bazowe</div>
          <p style={{fontSize:12,color:C.gray400,marginBottom:14}}>
            Stawka bazowa = stawka sugerowana × mnożnik produktu. Zmień mnożnik lub kwotę minimalną. Stawka sugerowana: <strong>{Math.round(rates.suggested)} zł/ha</strong>
          </p>
          {prods.map((p, i) => (
            <div key={p.id} className="card-section">
              <div className="card-section-title">{p.nazwa}</div>
              <div className="grid4">
                <div className="field">
                  <label>Mnożnik produktu</label>
                  <input className="editable" type="number" step={0.05} min={0.1}
                    value={p.mnoznik}
                    onChange={e => setProds(ps => ps.map((x,j) => j===i ? {...x, mnoznik: +e.target.value} : x))}
                  />
                  <span className="field-note">× {Math.round(rates.suggested)} = {Math.round(rates.suggested * p.mnoznik)} zł/ha</span>
                </div>
                <div className="field">
                  <label>Min. kwota (zł)</label>
                  <input className="editable" type="number" step={50} min={0}
                    value={p.min_kwota}
                    onChange={e => setProds(ps => ps.map((x,j) => j===i ? {...x, min_kwota: +e.target.value} : x))}
                  />
                </div>
                <div className="field" style={{gridColumn:'span 2'}}>
                  <label>Uwagi do oferty</label>
                  <input className="editable" value={p.uwagi}
                    onChange={e => setProds(ps => ps.map((x,j) => j===i ? {...x, uwagi: e.target.value} : x))}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'znizki' && (
        <div className="card">
          <div className="card-title">Tabela zniżek pakietowych</div>
          <p style={{fontSize:12,color:C.gray400,marginBottom:14}}>
            Im więcej produktów w jednej ofercie, tym niższy mnożnik stosowany do sumy.
          </p>
          <div style={{maxWidth:400}}>
            {discounts.map((v, i) => (
              <div key={i} style={{display:'flex',alignItems:'center',gap:16,padding:'8px 0',borderBottom:`1px solid ${C.gray200}`}}>
                <span style={{width:120,fontSize:13,color:C.gray700}}>
                  {i+1} produkt{i===0?'':i<4?'y':'ów'}
                </span>
                <input
                  className="editable"
                  type="number" step={0.01} min={0.1} max={1}
                  value={v}
                  onChange={e => setDiscounts(ds => ds.map((x,j) => j===i ? +e.target.value : x))}
                  style={{width:100,padding:'6px 8px',border:`1.5px solid ${C.teal}`,borderRadius:6,textAlign:'center',fontSize:13}}
                />
                <span style={{fontSize:12,color:C.gray400}}>= zniżka {Math.round((1-v)*100)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// USTAWIENIA
// ══════════════════════════════════════════════════════════════════════════════
function Settings({ users: initUsers, config, showToast, onSaved }) {
  const [users, setUsers] = useState(initUsers || []);
  const [newImie, setNewImie] = useState('');
  const [newNazwisko, setNewNazwisko] = useState('');
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setUsers(initUsers || []); }, [initUsers]);

  const handleAddUser = async () => {
    if (!newImie || !newNazwisko) { showToast('Podaj imię i nazwisko', 'error'); return; }
    setSaving(true);
    const res = await api('saveUser', { id: editId || null, imie: newImie, nazwisko: newNazwisko });
    if (res.ok) {
      showToast(editId ? 'Użytkownik zaktualizowany' : 'Użytkownik dodany');
      setNewImie(''); setNewNazwisko(''); setEditId(null);
      onSaved();
    } else showToast(res.error || 'Błąd', 'error');
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!confirm('Na pewno usunąć tego użytkownika?')) return;
    const res = await api('deleteUser', { id });
    if (res.ok) { showToast('Użytkownik usunięty'); onSaved(); }
    else showToast(res.error || 'Błąd', 'error');
  };

  const handleEdit = (u) => {
    setEditId(u.id); setNewImie(u.imie); setNewNazwisko(u.nazwisko);
  };

  return (
    <div>
      <div className="grid2">
        {/* Użytkownicy */}
        <div className="card">
          <div className="card-title">Osoby przygotowujące oferty</div>
          <div style={{marginBottom:16}}>
            {users.map(u => (
              <div key={u.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:`1px solid ${C.gray200}`}}>
                <div style={{
                  width:36,height:36,borderRadius:'50%',background:C.teal,
                  color:'white',display:'flex',alignItems:'center',justifyContent:'center',
                  fontWeight:700,fontSize:14,flexShrink:0,
                }}>
                  {u.imie?.[0]}{u.nazwisko?.[0]}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600}}>{u.imie} {u.nazwisko}</div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(u)}>Edytuj</button>
                <button className="btn btn-danger btn-sm" onClick={() => handleDelete(u.id)}>✕</button>
              </div>
            ))}
            {users.length === 0 && <p style={{color:C.gray400,fontSize:13}}>Brak użytkowników.</p>}
          </div>

          <div style={{background:C.gray100,borderRadius:8,padding:14}}>
            <div style={{fontSize:12,fontWeight:600,color:C.teal,marginBottom:10}}>
              {editId ? 'Edytuj użytkownika' : 'Dodaj nowego'}
            </div>
            <div className="grid2" style={{marginBottom:10}}>
              <div className="field">
                <label>Imię</label>
                <input className="editable" placeholder="np. Anna" value={newImie} onChange={e => setNewImie(e.target.value)} />
              </div>
              <div className="field">
                <label>Nazwisko</label>
                <input className="editable" placeholder="np. Kowalska" value={newNazwisko} onChange={e => setNewNazwisko(e.target.value)} />
              </div>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button className="btn btn-primary btn-sm" onClick={handleAddUser} disabled={saving}>
                {saving ? '…' : editId ? '✓ Zapisz zmiany' : '+ Dodaj'}
              </button>
              {editId && <button className="btn btn-ghost btn-sm" onClick={() => { setEditId(null); setNewImie(''); setNewNazwisko(''); }}>Anuluj</button>}
            </div>
          </div>
        </div>

        {/* Informacje o konfiguracji */}
        <div className="card">
          <div className="card-title">Informacje o systemie</div>
          <div style={{fontSize:13}}>
            {[
              ['Tryb', DEMO_MODE ? '⚠ Demo (bez zapisu)' : '✓ Połączono z Google Sheets'],
              ['Backend URL', DEMO_MODE ? 'Nie skonfigurowany' : BACKEND_URL.slice(0, 40) + '…'],
              ['Wersja', '2.0'],
            ].map(([k,v]) => (
              <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:`1px solid ${C.gray200}`}}>
                <span style={{color:C.gray400}}>{k}</span>
                <span style={{fontWeight:500,color:C.navy}}>{v}</span>
              </div>
            ))}
          </div>

          <div style={{marginTop:20,background:C.amberLt,borderRadius:8,padding:14}}>
            <div style={{fontSize:12,fontWeight:700,color:'#7a5200',marginBottom:8}}>
              📋 Instrukcja podłączenia Google Sheets
            </div>
            <ol style={{fontSize:12,color:'#7a5200',paddingLeft:16,lineHeight:1.8}}>
              <li>Otwórz <strong>script.google.com</strong></li>
              <li>Nowy projekt → wklej kod z pliku <code>Code.gs</code></li>
              <li>Wdróż → Nowe wdrożenie → Aplikacja webowa</li>
              <li>Wykonaj jako: <strong>Ty</strong>, Dostęp: <strong>Wszyscy</strong></li>
              <li>Skopiuj URL wdrożenia</li>
              <li>Wklej URL w pliku .jsx w zmiennej <code>BACKEND_URL</code></li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

window.App = App;
