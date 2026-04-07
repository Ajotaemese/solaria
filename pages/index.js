// pages/index.js — SolarIA · Viabilidad Inmobiliaria con IA

import { useState, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { computeModel, QUALITY_FACTORS } from '../lib/model';

const fmt = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number.isFinite(n) ? n : 0);
const pct = (n) => `${(n * 100).toFixed(1)}%`;
const n0 = (n) => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(Number.isFinite(n) ? n : 0);

// ─── API helpers (llaman a nuestros servidores, no directamente a Catastro/Claude) ──
async function apiCatastro(body) {
  const r = await fetch('/api/catastro', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return r.json();
}

async function apiClaude(type, message) {
  const r = await fetch('/api/claude', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, message }) });
  return r.json();
}

// ─── UI Atoms ─────────────────────────────────────────────────────────────────
function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4a6080', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f0f6ff', fontSize: 14, padding: '10px 14px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' };

function Inp({ value, onChange, type = 'text', step, placeholder }) {
  const [f, setF] = useState(false);
  return <input type={type} value={value} step={step} placeholder={placeholder} onChange={onChange}
    style={{ ...inputStyle, borderColor: f ? '#5eead4' : 'rgba(255,255,255,0.1)' }}
    onFocus={() => setF(true)} onBlur={() => setF(false)} />;
}

function Sel({ value, onChange, children }) {
  return <select value={value} onChange={e => onChange(e.target.value)} style={{ ...inputStyle, appearance: 'none', cursor: 'pointer' }}>{children}</select>;
}

function Kpi({ label, value, hint, color = '#e0eaff' }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}25`, borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#3d5570', marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color, letterSpacing: '-0.03em', fontFamily: "'DM Mono', monospace" }}>{value}</div>
      {hint && <div style={{ fontSize: 11, color: '#3d5570', marginTop: 5 }}>{hint}</div>}
    </div>
  );
}

function Card({ children, style }) {
  return <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: 24, ...style }}>{children}</div>;
}

function CardTitle({ children }) {
  return <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#5eead4', marginBottom: 18 }}>{children}</div>;
}

function Spin({ msg }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 18, height: 18, border: '2px solid rgba(94,234,212,0.2)', borderTopColor: '#5eead4', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <span style={{ fontSize: 13, color: '#5eead4', fontWeight: 600 }}>{msg}</span>
    </div>
  );
}

function Tag({ children, color = '#5eead4' }) {
  return <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', padding: '3px 10px', borderRadius: 20, background: color + '18', color, border: `1px solid ${color}35` }}>{children}</span>;
}

function Btn({ onClick, disabled, children, primary }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: '12px 26px', border: primary ? 'none' : '1px solid rgba(255,255,255,0.08)',
      borderRadius: 10, fontFamily: 'inherit', fontSize: 13, fontWeight: 800, cursor: disabled ? 'not-allowed' : 'pointer',
      background: primary ? 'linear-gradient(135deg,#5eead4,#3b82f6)' : 'rgba(255,255,255,0.04)',
      color: primary ? '#050c18' : '#3d5a7a', opacity: disabled ? 0.5 : 1, transition: 'all 0.15s',
    }}>{children}</button>
  );
}

const STEPS = [{ label: 'Solar', icon: '◈' }, { label: 'Urbanismo', icon: '⬡' }, { label: 'Mercado', icon: '◎' }, { label: 'Opciones', icon: '◇' }, { label: 'Resultado', icon: '✦' }];

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function SolarIA() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadMsg, setLoadMsg] = useState('');
  const [catData, setCatData] = useState(null);

  // Step 0 inputs
  const [inputMode, setInputMode] = useState('rc');
  const [rc, setRc] = useState('');
  const [addrProv, setAddrProv] = useState('');
  const [addrMun, setAddrMun] = useState('');
  const [addrTipoVia, setAddrTipoVia] = useState('CL');
  const [addrVia, setAddrVia] = useState('');
  const [addrNum, setAddrNum] = useState('');
  const [plotCost, setPlotCost] = useState(480000);
  const [quality, setQuality] = useState('media_alta');

  // Step 1: urbanismo
  const [urb, setUrb] = useState({ claseUrbanistica: '', calificacion: '', buildability: 2.2, occupation: 70, floors: 4, basements: 1, setbackFront: 0, setbackRear: 3, setbackSide: 0, usosPosibles: [], alturaMaxima: 12, confianza: '', notas: '', condicionantes: [], plotArea: 600, patioLoss: 5, commonAreaRatio: 16, efficiencyByUse: 84, parkingRatio: 1, avgUnitSize: 85, groundFloorCommercial: 0, municipio: '', provincia: '' });
  const setU = (k, v) => setUrb(p => ({ ...p, [k]: v }));

  // Step 2: mercado
  const [mkt, setMkt] = useState({ salePriceM2: 2900, salePriceCommercialM2: 2100, rentPriceM2Month: 13.5, rentCommercialM2Month: 12, constructionPEM: 1180, exitYield: 5, demanda: '', tendencia: '', comentario: '' });
  const setM = (k, v) => setMkt(p => ({ ...p, [k]: v }));

  // Financial params
  const [fin, setFin] = useState({ purchaseCostsPct: 0.035, projectSoftPct: 0.12, licenseTaxPct: 0.055, developerOverheadsPct: 0.03, commercialPct: 0.03, financePct: 0.05, contingencyPct: 0.05, stabilizedOccupancy: 93, opexPctOnRent: 24, targetMargin: 0.18, monthsBuild: 18, monthsSales: 8, equityPct: 0.30, interestRate: 0.055, parkingCostPerSpace: 18000, urbanizationCost: 70 });
  const setF = (k, v) => setFin(p => ({ ...p, [k]: v }));

  // Step 3: opciones
  const [opciones, setOpciones] = useState(null);
  const [selectedOpt, setSelectedOpt] = useState(null);

  // Computed model
  const selKey = opciones?.opciones?.find(o => o.id === selectedOpt)?.useMultiplierKey || 'residencial_libre';
  const model = computeModel({ ...urb, ...mkt, ...fin, plotArea: urb.plotArea, plotCost, quality, useKey: selKey });
  const mcolor = model.margin >= 0.18 ? '#4ade80' : model.margin >= 0.12 ? '#fbbf24' : '#f87171';
  const landOk = plotCost <= Math.max(model.maxLandSale, model.maxLandHold);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSolar = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Catastro
      setLoadMsg('Consultando API del Catastro (Ministerio de Hacienda)...');
      let cat = { ok: false };
      try {
        if (inputMode === 'rc' && rc.trim()) {
          cat = await apiCatastro({ mode: 'rc', rc });
        } else if (inputMode === 'address' && addrProv && addrMun && addrVia && addrNum) {
          cat = await apiCatastro({ mode: 'address', provincia: addrProv, municipio: addrMun, tipoVia: addrTipoVia, nombreVia: addrVia, numero: addrNum });
        }
      } catch { cat = { ok: false }; }
      setCatData(cat.ok ? cat : null);

      // 2. Claude interpreta urbanismo
      setLoadMsg('Interpretando normativa urbanística con IA...');
      const query = cat.ok
        ? `Datos reales Catastro:\n- Municipio: ${cat.municipio}\n- Provincia: ${cat.provincia}\n- Uso catastral: ${cat.uso}\n- Superficie: ${cat.superficie} m²\n- Clase: ${cat.clase}\n- Ref: ${cat.rc}`
        : `Solar en España:\n- Referencia: ${rc || 'no disponible'}\n- Provincia: ${addrProv || 'no indicada'}\n- Municipio: ${addrMun || 'no indicado'}\n- Dirección: ${addrTipoVia} ${addrVia} ${addrNum}`;

      const aiUrb = await apiClaude('urbanismo', query);
      const plotArea = (cat.ok && cat.superficie > 0) ? cat.superficie : (urb.plotArea || 600);

      setUrb({
        claseUrbanistica: aiUrb?.claseUrbanistica || 'urbano_consolidado',
        calificacion: aiUrb?.calificacion || 'Residencial',
        buildability: aiUrb?.buildability || 2.2,
        occupation: aiUrb?.occupation || 70,
        floors: aiUrb?.floors || 4,
        basements: aiUrb?.basements ?? 1,
        setbackFront: aiUrb?.setbackFront ?? 0,
        setbackRear: aiUrb?.setbackRear ?? 3,
        setbackSide: aiUrb?.setbackSide ?? 0,
        usosPosibles: aiUrb?.usosPosibles || ['residencial_libre'],
        alturaMaxima: aiUrb?.alturaMaxima || 12,
        confianza: aiUrb?.confianza || 'media',
        notas: aiUrb?.notas || '',
        condicionantes: aiUrb?.condicionantes || [],
        plotArea,
        patioLoss: 5, commonAreaRatio: 16, efficiencyByUse: 84,
        parkingRatio: 1, avgUnitSize: 85, groundFloorCommercial: 0,
        municipio: cat.municipio || addrMun || '',
        provincia: cat.provincia || addrProv || '',
        refCat: cat.rc || rc,
        direccion: cat.ok ? `${cat.tipoVia} ${cat.nombreVia} ${cat.numero}` : `${addrTipoVia} ${addrVia} ${addrNum}`,
      });
      setStep(1);
    } finally { setLoading(false); }
  }, [rc, inputMode, addrProv, addrMun, addrTipoVia, addrVia, addrNum, urb.plotArea]);

  const handleMercado = useCallback(async () => {
    setLoading(true);
    setLoadMsg('Analizando mercado inmobiliario local con IA...');
    try {
      const ai = await apiClaude('mercado', `Municipio: ${urb.municipio}, Provincia: ${urb.provincia}, Uso: ${urb.calificacion}, Calidad: ${quality}, Superficie: ${urb.plotArea} m²`);
      if (ai && !ai.error) {
        setMkt({ salePriceM2: ai.salePriceM2 || 2900, salePriceCommercialM2: ai.salePriceCommercialM2 || 2100, rentPriceM2Month: ai.rentPriceM2Month || 13.5, rentCommercialM2Month: ai.rentCommercialM2Month || 12, constructionPEM: ai.constructionPEM || 1180, exitYield: ai.exitYield || 5, demanda: ai.demanda || '', tendencia: ai.tendencia || '', comentario: ai.comentario || '', fuentesReferencia: ai.fuentesReferencia || '' });
      }
      setStep(2);
    } finally { setLoading(false); }
  }, [urb, quality]);

  const handleOpciones = useCallback(async () => {
    setLoading(true);
    setLoadMsg('Generando opciones de negocio con IA...');
    try {
      const base = computeModel({ ...urb, ...mkt, ...fin, plotArea: urb.plotArea, plotCost, quality, useKey: 'residencial_libre' });
      const ai = await apiClaude('opciones', JSON.stringify({
        solar: { municipio: urb.municipio, provincia: urb.provincia, plotArea: urb.plotArea, claseUrbanistica: urb.claseUrbanistica, calificacion: urb.calificacion, usosPosibles: urb.usosPosibles, condicionantes: urb.condicionantes },
        urbanismo: { buildability: urb.buildability, floors: urb.floors, basements: urb.basements, occupation: urb.occupation },
        mercado: { salePriceM2: mkt.salePriceM2, rentPriceM2Month: mkt.rentPriceM2Month, demanda: mkt.demanda, tendencia: mkt.tendencia, exitYield: mkt.exitYield },
        viabilidad: { saleRes: base.saleRes, units: base.units, margin: base.margin, profit: base.profit, maxLandSale: base.maxLandSale },
        plotCost, quality,
      }));
      if (ai && !ai.error) {
        setOpciones(ai);
        setSelectedOpt(ai.opciones[0]?.id);
      }
      setStep(3);
    } finally { setLoading(false); }
  }, [urb, mkt, fin, plotCost, quality]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#050c18', color: '#e0eaff', fontFamily: "'Outfit', 'DM Sans', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        select option { background: #0a1628; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }
      `}</style>

      {/* Header */}
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(5,12,24,0.95)', backdropFilter: 'blur(16px)', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, background: 'linear-gradient(135deg,#5eead4,#3b82f6)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, color: '#050c18' }}>◈</div>
            <div>
              <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.02em' }}>SolarIA</span>
              <span style={{ fontSize: 10, color: '#2d4a6a', marginLeft: 8, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Viabilidad Inmobiliaria</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 2 }}>
            {STEPS.map((s, i) => (
              <button key={i} onClick={() => i <= step && setStep(i)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 20, border: 'none', cursor: i <= step ? 'pointer' : 'default', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, background: i === step ? 'rgba(94,234,212,0.1)' : 'transparent', color: i === step ? '#5eead4' : i < step ? '#5a7a9a' : '#1e3045', transition: 'all 0.15s' }}>
                <span>{s.icon}</span><span>{s.label}</span>
              </button>
            ))}
          </div>
          <div style={{ fontSize: 10, color: '#1e3045', fontFamily: "'DM Mono',monospace", fontWeight: 600 }}>API Catastro + Claude AI</div>
        </div>
      </div>

      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '36px 28px' }}>

        {/* ── STEP 0 ── */}
        {step === 0 && (
          <div style={{ animation: 'fadeUp 0.4s ease' }}>
            <div style={{ maxWidth: 620, marginBottom: 44 }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#5eead4', marginBottom: 12 }}>Análisis de Solar · Viabilidad Inmobiliaria</div>
              <h1 style={{ fontSize: 38, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.12, marginBottom: 16 }}>
                Introduce el solar.<br />
                <span style={{ background: 'linear-gradient(90deg,#5eead4,#3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>La IA hace el resto.</span>
              </h1>
              <p style={{ fontSize: 14, color: '#3d5a7a', lineHeight: 1.75 }}>
                Conectamos con la <strong style={{ color: '#5eead4' }}>API pública del Catastro</strong> (Ministerio de Hacienda) para obtener los datos reales del solar. Claude AI interpreta la normativa urbanística, analiza el mercado y genera las opciones de negocio con viabilidad económica completa.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
              {[['rc', 'Por referencia catastral'], ['address', 'Por dirección']].map(([m, l]) => (
                <button key={m} onClick={() => setInputMode(m)} style={{ padding: '8px 18px', borderRadius: 20, border: `1px solid ${inputMode === m ? '#5eead4' : 'rgba(255,255,255,0.08)'}`, background: inputMode === m ? 'rgba(94,234,212,0.08)' : 'transparent', color: inputMode === m ? '#5eead4' : '#3d5a7a', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{l}</button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, maxWidth: 860 }}>
              <Card>
                <CardTitle>{inputMode === 'rc' ? 'Referencia catastral' : 'Dirección del solar'}</CardTitle>
                {inputMode === 'rc' ? (
                  <Field label="Referencia catastral (20 caracteres)">
                    <Inp value={rc} onChange={e => setRc(e.target.value)} placeholder="Ej: 7837301YN1073N0001OX" />
                    <div style={{ fontSize: 11, color: '#2d4a6a', marginTop: 6 }}>Búscala en <strong style={{ color: '#5eead4' }}>sedecatastro.gob.es</strong> → Consulta de datos catastrales</div>
                  </Field>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                    <Field label="Provincia"><Inp value={addrProv} onChange={e => setAddrProv(e.target.value)} placeholder="Sevilla" /></Field>
                    <Field label="Municipio"><Inp value={addrMun} onChange={e => setAddrMun(e.target.value)} placeholder="Sevilla" /></Field>
                    <Field label="Tipo vía">
                      <Sel value={addrTipoVia} onChange={setAddrTipoVia}>
                        {[['CL', 'CL · Calle'], ['AV', 'AV · Avenida'], ['PZ', 'PZ · Plaza'], ['CR', 'CR · Carretera'], ['PS', 'PS · Paseo'], ['GV', 'GV · Gran Vía']].map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </Sel>
                    </Field>
                    <Field label="Nombre de la vía"><Inp value={addrVia} onChange={e => setAddrVia(e.target.value)} placeholder="Constitución" /></Field>
                    <Field label="Número"><Inp value={addrNum} onChange={e => setAddrNum(e.target.value)} placeholder="12" /></Field>
                  </div>
                )}
              </Card>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Card>
                  <CardTitle>Inversión</CardTitle>
                  <Field label="Precio del solar (€)"><Inp type="number" value={plotCost} onChange={e => setPlotCost(Number(e.target.value))} /></Field>
                  <Field label="Calidad del producto">
                    <Sel value={quality} onChange={setQuality}>
                      {[['basica', 'Básica'], ['media', 'Media'], ['media_alta', 'Media-alta'], ['alta', 'Alta'], ['premium', 'Premium']].map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </Sel>
                  </Field>
                </Card>
                <div style={{ padding: 16, background: 'rgba(94,234,212,0.04)', border: '1px solid rgba(94,234,212,0.12)', borderRadius: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#5eead4', marginBottom: 10 }}>✓ Automático</div>
                  {['Datos reales del Catastro', 'Normativa urbanística (IA)', 'Precios de mercado (IA)', 'Opciones de negocio (IA)', 'Viabilidad económica completa'].map(t => (
                    <div key={t} style={{ fontSize: 11, color: '#2d4a6a', marginBottom: 5 }}>→ {t}</div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 28, display: 'flex', alignItems: 'center', gap: 18 }}>
              <Btn primary onClick={handleSolar} disabled={loading || (inputMode === 'rc' && !rc) || (inputMode === 'address' && (!addrProv || !addrMun || !addrVia || !addrNum))}>
                {loading ? 'Analizando...' : '◈ Analizar Solar →'}
              </Btn>
              {loading && <Spin msg={loadMsg} />}
            </div>
          </div>
        )}

        {/* ── STEP 1: Urbanismo ── */}
        {step === 1 && (
          <div style={{ animation: 'fadeUp 0.4s ease' }}>
            <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#5eead4', marginBottom: 8 }}>Parámetros urbanísticos</div>
                <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em' }}>{urb.municipio || 'Solar'}{urb.provincia ? ` · ${urb.provincia}` : ''}</h2>
                {urb.refCat && <div style={{ fontSize: 12, color: '#3d5a7a', marginTop: 4 }}>Ref: {urb.refCat}</div>}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {urb.confianza && <Tag color={urb.confianza === 'alta' ? '#4ade80' : urb.confianza === 'media' ? '#fbbf24' : '#f87171'}>Confianza IA: {urb.confianza}</Tag>}
                {catData?.ok && <Tag color="#5eead4">✓ Datos Catastro reales</Tag>}
              </div>
            </div>

            {urb.notas && <div style={{ marginBottom: 16, padding: '12px 16px', background: 'rgba(94,234,212,0.05)', border: '1px solid rgba(94,234,212,0.15)', borderRadius: 12, fontSize: 13, color: '#9db8d0', lineHeight: 1.7 }}><span style={{ color: '#5eead4', fontWeight: 700 }}>IA: </span>{urb.notas}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
              <Card>
                <CardTitle>Parámetros de edificación (revisables)</CardTitle>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                  {[['Superficie solar (m²s)', 'plotArea'], ['Edificabilidad (m²t/m²s)', 'buildability', '0.1'], ['Ocupación máx. (%)', 'occupation'], ['Plantas sobre rasante', 'floors'], ['Sótanos', 'basements'], ['Altura máxima (m)', 'alturaMaxima'], ['Retranqueo frontal (m)', 'setbackFront'], ['Retranqueo trasero (m)', 'setbackRear'], ['Retranqueos laterales (m)', 'setbackSide'], ['Pérdida patios/núcleos (%)', 'patioLoss'], ['Zonas comunes (%)', 'commonAreaRatio'], ['Eficiencia útil (%)', 'efficiencyByUse'], ['Parking por unidad', 'parkingRatio', '0.1'], ['Sup. media vivienda (m²)', 'avgUnitSize'], ['Comercial planta baja (%)', 'groundFloorCommercial']].map(([label, key, step]) => (
                    <Field key={key} label={label}><Inp type="number" step={step} value={urb[key]} onChange={e => setU(key, Number(e.target.value))} /></Field>
                  ))}
                </div>
              </Card>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Card>
                  <CardTitle>Aprovechamiento estimado</CardTitle>
                  {[['Construido s/ rasante', `${n0(model.adjusted)} m²c`, '#e0eaff'], ['Vendible residencial', `${n0(model.saleRes)} m²`, '#5eead4'], ['Unidades', n0(model.units), '#5eead4'], ['Plazas parking', n0(model.parking), '#e0eaff']].map(([l, v, c]) => (
                    <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <span style={{ fontSize: 12, color: '#3d5a7a' }}>{l}</span>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700, color: c, fontSize: 13 }}>{v}</span>
                    </div>
                  ))}
                </Card>

                {urb.usosPosibles?.length > 0 && (
                  <Card>
                    <CardTitle>Usos compatibles (IA)</CardTitle>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                      {urb.usosPosibles.map(u => <Tag key={u} color="#3b82f6">{u.replace(/_/g, ' ')}</Tag>)}
                    </div>
                  </Card>
                )}

                {catData?.ok && (
                  <Card>
                    <CardTitle>Datos Catastro reales</CardTitle>
                    {[['Superficie', `${n0(catData.superficie)} m²`], ['Uso catastral', catData.uso], ['Año', catData.anyoConstruccion || 'Solar']].filter(([, v]) => v && v !== '0').map(([l, v]) => (
                      <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                        <span style={{ color: '#3d5a7a' }}>{l}</span><span style={{ color: '#9db8d0', fontWeight: 600 }}>{v}</span>
                      </div>
                    ))}
                  </Card>
                )}
              </div>
            </div>

            <div style={{ marginTop: 22, display: 'flex', gap: 10 }}>
              <Btn onClick={() => setStep(0)}>← Volver</Btn>
              <Btn primary onClick={handleMercado} disabled={loading}>{loading ? 'Analizando...' : '◎ Analizar mercado →'}</Btn>
              {loading && <Spin msg={loadMsg} />}
            </div>
          </div>
        )}

        {/* ── STEP 2: Mercado ── */}
        {step === 2 && (
          <div style={{ animation: 'fadeUp 0.4s ease' }}>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#5eead4', marginBottom: 8 }}>Mercado inmobiliario</div>
              <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em' }}>{urb.municipio} · Hipótesis de valor</h2>
            </div>

            {mkt.comentario && (
              <div style={{ marginBottom: 18, padding: '14px 18px', background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 12, fontSize: 13, color: '#9db8d0', lineHeight: 1.7 }}>
                <span style={{ color: '#3b82f6', fontWeight: 700 }}>IA: </span>{mkt.comentario}
                <span style={{ marginLeft: 10 }}>
                  {mkt.demanda && <Tag color={mkt.demanda === 'alta' ? '#4ade80' : mkt.demanda === 'media' ? '#fbbf24' : '#f87171'}>Demanda {mkt.demanda}</Tag>}
                </span>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <Card>
                <CardTitle>Precios de mercado (revisables)</CardTitle>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  {[['Venta residencial (€/m²)', 'salePriceM2'], ['Venta comercial (€/m²)', 'salePriceCommercialM2'], ['Renta residencial (€/m²/mes)', 'rentPriceM2Month'], ['Renta comercial (€/m²/mes)', 'rentCommercialM2Month'], ['PEM construcción (€/m²c)', 'constructionPEM'], ['Exit yield (%)', 'exitYield']].map(([l, k]) => (
                    <Field key={k} label={l}><Inp type="number" step="0.1" value={mkt[k]} onChange={e => setM(k, Number(e.target.value))} /></Field>
                  ))}
                </div>
              </Card>
              <Card>
                <CardTitle>Parámetros financieros (revisables)</CardTitle>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  {[['Costes adquisición', 'purchaseCostsPct', '0.001'], ['Honorarios técnicos', 'projectSoftPct', '0.01'], ['Licencias / ICIO', 'licenseTaxPct', '0.01'], ['Estructura promotora', 'developerOverheadsPct', '0.01'], ['Comercialización', 'commercialPct', '0.01'], ['Coste financiero', 'financePct', '0.01'], ['Imprevistos', 'contingencyPct', '0.01'], ['Equity (ratio)', 'equityPct', '0.01'], ['Tipo interés', 'interestRate', '0.001'], ['Meses de obra', 'monthsBuild', '1'], ['Meses ventas', 'monthsSales', '1'], ['Margen objetivo', 'targetMargin', '0.01']].map(([l, k, s]) => (
                    <Field key={k} label={l}><Inp type="number" step={s} value={fin[k]} onChange={e => setF(k, Number(e.target.value))} /></Field>
                  ))}
                </div>
              </Card>
            </div>

            <div style={{ marginTop: 22, display: 'flex', gap: 10 }}>
              <Btn onClick={() => setStep(1)}>← Volver</Btn>
              <Btn primary onClick={handleOpciones} disabled={loading}>{loading ? 'Generando...' : '◇ Generar opciones de negocio →'}</Btn>
              {loading && <Spin msg={loadMsg} />}
            </div>
          </div>
        )}

        {/* ── STEP 3: Opciones ── */}
        {step === 3 && opciones && (
          <div style={{ animation: 'fadeUp 0.4s ease' }}>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#5eead4', marginBottom: 8 }}>Estrategias recomendadas</div>
              <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.03em' }}>Opciones de negocio · {urb.municipio}</h2>
            </div>

            {opciones.recomendacion && (
              <div style={{ marginBottom: 20, padding: '16px 20px', background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 14, fontSize: 13, color: '#9db8d0', lineHeight: 1.8 }}>
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#3b82f6', marginBottom: 8 }}>Recomendación estratégica IA</div>
                {opciones.recomendacion}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 20 }}>
              {opciones.opciones.map((opt, i) => (
                <div key={opt.id} onClick={() => setSelectedOpt(opt.id)} style={{ cursor: 'pointer', padding: 22, background: selectedOpt === opt.id ? 'rgba(94,234,212,0.06)' : 'rgba(255,255,255,0.02)', border: `1px solid ${selectedOpt === opt.id ? 'rgba(94,234,212,0.4)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 16, transition: 'all 0.2s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 26, fontWeight: 800, color: selectedOpt === opt.id ? '#5eead4' : '#1e3045' }}>{String(i + 1).padStart(2, '0')}</span>
                    <Tag color={opt.riesgo === 'bajo' ? '#4ade80' : opt.riesgo === 'medio' ? '#fbbf24' : '#f87171'}>Riesgo {opt.riesgo}</Tag>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: selectedOpt === opt.id ? '#e0eaff' : '#5a7a9a' }}>{opt.nombre}</div>
                  <div style={{ fontSize: 11, color: '#2d4a6a', lineHeight: 1.65, marginBottom: 12 }}>{opt.descripcion}</div>
                  <div style={{ height: 3, background: 'rgba(255,255,255,0.04)', borderRadius: 3, marginBottom: 4 }}>
                    <div style={{ height: '100%', width: `${opt.puntuacion * 10}%`, background: selectedOpt === opt.id ? '#5eead4' : '#3b82f6', borderRadius: 3 }} />
                  </div>
                  <div style={{ fontSize: 10, color: '#2d4a6a', marginBottom: 12 }}>{opt.puntuacion}/10 · {opt.plazo}</div>
                  {opt.ventajas?.map(v => <div key={v} style={{ fontSize: 11, color: '#4ade80', marginBottom: 3 }}>+ {v}</div>)}
                  {opt.inconvenientes?.map(v => <div key={v} style={{ fontSize: 11, color: '#f87171', marginBottom: 3 }}>− {v}</div>)}
                  {opt.retornoEsperado && <div style={{ marginTop: 10, fontSize: 11, color: '#5eead4', fontWeight: 700 }}>↑ {opt.retornoEsperado}</div>}
                </div>
              ))}
            </div>

            {opciones.alertas?.length > 0 && (
              <div style={{ marginBottom: 20, padding: '14px 18px', background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.15)', borderRadius: 12 }}>
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#fbbf24', marginBottom: 10 }}>Alertas</div>
                {opciones.alertas.map(a => <div key={a} style={{ fontSize: 12, color: '#9db8d0', marginBottom: 5, lineHeight: 1.5 }}>⚠ {a}</div>)}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <Btn onClick={() => setStep(2)}>← Volver</Btn>
              <Btn primary onClick={() => setStep(4)}>✦ Ver viabilidad económica →</Btn>
            </div>
          </div>
        )}

        {/* ── STEP 4: Resultado ── */}
        {step === 4 && (
          <div style={{ animation: 'fadeUp 0.4s ease' }}>
            <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#5eead4', marginBottom: 8 }}>Resultado económico</div>
                <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em' }}>{urb.municipio} · {opciones?.opciones?.find(o => o.id === selectedOpt)?.nombre || 'Análisis'}</h2>
                <div style={{ fontSize: 12, color: '#3d5a7a', marginTop: 4 }}>{urb.plotArea} m²s · {n0(model.adjusted)} m²c · {n0(model.units)} uds.</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn onClick={() => setStep(3)}>← Cambiar opción</Btn>
                <Btn onClick={() => { setStep(0); setOpciones(null); setCatData(null); }}>◈ Nuevo solar</Btn>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
              <Kpi label="Beneficio venta" value={fmt(model.profit)} hint={`Margen: ${pct(model.margin)}`} color={mcolor} />
              <Kpi label="TIR estimada" value={pct(model.irr)} hint="Modelo simplificado" color="#3b82f6" />
              <Kpi label="ROI equity" value={pct(model.roiEq)} color="#a78bfa" />
              <Kpi label="Ingresos venta" value={fmt(model.salesRev)} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
              <Card>
                <CardTitle>Desglose económico</CardTitle>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <tbody>
                    {[['Solar', plotCost, false], ['Gastos adquisición', model.buyFees, false], ['Hard cost', model.hardCost, false], ['Soft costs', model.soft, false], ['Licencias y tasas', model.lic, false], ['Imprevistos', model.cont, false], ['Financiación', model.finCost, false], ['Comercialización', model.mktCost, false], ['── Total coste', model.totalSale, true], ['── Ingresos venta', model.salesRev, true], ['── Beneficio', model.profit, 'profit']].map(([l, v, b]) => (
                      <tr key={l} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '9px 0', color: b ? '#e0eaff' : '#3d5a7a', fontWeight: b ? 700 : 400 }}>{l}</td>
                        <td style={{ padding: '9px 0', textAlign: 'right', fontFamily: "'DM Mono',monospace", fontWeight: b ? 700 : 500, fontSize: b ? 14 : 13, color: b === 'profit' ? (model.profit >= 0 ? '#4ade80' : '#f87171') : b ? '#e0eaff' : '#3d5a7a' }}>{fmt(v)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Card>
                  <CardTitle>Build to Rent / Patrimonial</CardTitle>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <Kpi label="Renta bruta anual" value={fmt(model.rent)} color="#a78bfa" />
                    <Kpi label="NOI" value={fmt(model.noi)} color="#a78bfa" />
                    <Kpi label="Valor estabilizado" value={fmt(model.stabVal)} hint={`Cap rate ${pct(model.capRate)}`} />
                    <Kpi label="Beneficio patrimonial" value={fmt(model.profitHold)} color={model.profitHold >= 0 ? '#4ade80' : '#f87171'} />
                  </div>
                </Card>

                <Card>
                  <CardTitle>Oferta máxima por el solar</CardTitle>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                    <Kpi label="Modelo venta" value={fmt(model.maxLandSale)} color="#5eead4" />
                    <Kpi label="Modelo patrimonial" value={fmt(model.maxLandHold)} color="#3b82f6" />
                  </div>
                  <div style={{ padding: '10px 14px', borderRadius: 10, fontSize: 12, lineHeight: 1.6, background: landOk ? 'rgba(74,222,128,0.06)' : 'rgba(248,113,113,0.06)', border: `1px solid ${landOk ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}`, color: landOk ? '#4ade80' : '#f87171' }}>
                    {landOk ? `✓ El precio (${fmt(plotCost)}) está dentro del rango aconsejable.` : `✗ El precio (${fmt(plotCost)}) supera la oferta máxima razonable.`}
                  </div>
                </Card>

                <Card>
                  <CardTitle>Modelo financiero apalancado</CardTitle>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <Kpi label="Equity" value={fmt(model.eq)} />
                    <Kpi label="Deuda" value={fmt(model.debt)} />
                    <Kpi label="Coste financiero" value={fmt(model.finLev)} color="#fbbf24" />
                    <Kpi label="Beneficio apalancado" value={fmt(model.profLev)} color={model.profLev >= 0 ? '#4ade80' : '#f87171'} />
                  </div>
                </Card>
              </div>
            </div>

            <Card>
              <CardTitle>Sensibilidad del beneficio a precio de venta</CardTitle>
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={model.stress} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                    <XAxis dataKey="name" tick={{ fill: '#3d5a7a', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#3d5a7a', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${Math.round(v / 1000)}k€`} width={60} />
                    <Tooltip content={({ active, payload, label }) => active && payload?.length ? <div style={{ background: '#0a1628', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}><div style={{ color: '#3d5a7a', marginBottom: 3 }}>{label}</div><div style={{ fontWeight: 700, color: payload[0].value >= 0 ? '#4ade80' : '#f87171' }}>{fmt(payload[0].value)}</div></div> : null} />
                    <Bar dataKey="profit" radius={[5, 5, 0, 0]}>
                      {model.stress.map((e, i) => <Cell key={i} fill={e.profit >= 0 ? '#5eead4' : '#f87171'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
