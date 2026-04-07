// pages/index.js v2 — SolarIA con contexto enriquecido en cada llamada a IA

import { useState, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { computeModel, QUALITY_FACTORS } from '../lib/model';

const fmt = (n) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number.isFinite(n) ? n : 0);
const pct = (n) => `${(n * 100).toFixed(1)}%`;
const n0 = (n) => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(Number.isFinite(n) ? n : 0);

async function apiCatastro(body) {
  const r = await fetch('/api/catastro', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return r.json();
}

async function apiClaude(type, message) {
  const r = await fetch('/api/claude', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, message }) });
  return r.json();
}

// ─── UI ───────────────────────────────────────────────────────────────────────
const IS = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f0f6ff', fontSize: 14, padding: '10px 14px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' };

function Field({ label, children, hint }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#4a6080', marginBottom: 6 }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 11, color: '#2d4a6a', marginTop: 4 }}>{hint}</div>}
    </div>
  );
}
function Inp({ value, onChange, type = 'text', step, placeholder }) {
  const [f, setF] = useState(false);
  return <input type={type} value={value} step={step} placeholder={placeholder} onChange={onChange}
    style={{ ...IS, borderColor: f ? '#5eead4' : 'rgba(255,255,255,0.1)' }}
    onFocus={() => setF(true)} onBlur={() => setF(false)} />;
}
function Sel({ value, onChange, children }) {
  return <select value={value} onChange={e => onChange(e.target.value)} style={{ ...IS, appearance: 'none', cursor: 'pointer' }}>{children}</select>;
}
function Kpi({ label, value, hint, color = '#e0eaff', size = 'md' }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}22`, borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#3d5570', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: size === 'lg' ? 26 : 20, fontWeight: 800, color, letterSpacing: '-0.03em', fontFamily: "'DM Mono',monospace", lineHeight: 1 }}>{value}</div>
      {hint && <div style={{ fontSize: 10, color: '#3d5570', marginTop: 4 }}>{hint}</div>}
    </div>
  );
}
function Card({ children, style }) {
  return <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: 24, ...style }}>{children}</div>;
}
function CT({ children }) {
  return <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#5eead4', marginBottom: 18 }}>{children}</div>;
}
function Tag({ children, color = '#5eead4' }) {
  return <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', padding: '3px 10px', borderRadius: 20, background: color + '18', color, border: `1px solid ${color}35`, marginRight: 6, marginBottom: 4 }}>{children}</span>;
}
function Btn({ onClick, disabled, children, primary, small }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: small ? '8px 16px' : '12px 26px', border: primary ? 'none' : '1px solid rgba(255,255,255,0.08)',
      borderRadius: 10, fontFamily: 'inherit', fontSize: small ? 12 : 13, fontWeight: 800, cursor: disabled ? 'not-allowed' : 'pointer',
      background: primary ? 'linear-gradient(135deg,#5eead4,#3b82f6)' : 'rgba(255,255,255,0.04)',
      color: primary ? '#050c18' : '#3d5a7a', opacity: disabled ? 0.5 : 1, transition: 'all 0.15s',
    }}>{children}</button>
  );
}
function Spin({ msg }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 16, height: 16, border: '2px solid rgba(94,234,212,0.2)', borderTopColor: '#5eead4', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <span style={{ fontSize: 13, color: '#5eead4', fontWeight: 600 }}>{msg}</span>
    </div>
  );
}
function Progress({ steps, current }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {steps.map((s, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: i === current ? 'rgba(94,234,212,0.1)' : 'transparent', color: i === current ? '#5eead4' : i < current ? '#5a7a9a' : '#1e3045', transition: 'all 0.2s' }}>
          <span>{s.icon}</span><span>{s.label}</span>
        </div>
      ))}
    </div>
  );
}

const STEPS = [{ label: 'Solar', icon: '◈' }, { label: 'Urbanismo', icon: '⬡' }, { label: 'Mercado', icon: '◎' }, { label: 'Opciones', icon: '◇' }, { label: 'Resultado', icon: '✦' }];

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function SolarIA() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadMsg, setLoadMsg] = useState('');
  const [catData, setCatData] = useState(null);
  const [inputMode, setInputMode] = useState('rc');
  const [rc, setRc] = useState('');
  const [addrProv, setAddrProv] = useState('');
  const [addrMun, setAddrMun] = useState('');
  const [addrTipoVia, setAddrTipoVia] = useState('CL');
  const [addrVia, setAddrVia] = useState('');
  const [addrNum, setAddrNum] = useState('');
  const [plotCost, setPlotCost] = useState('');
  const [quality, setQuality] = useState('media_alta');
  const [urb, setUrb] = useState({ claseUrbanistica: '', calificacion: '', zona: '', buildability: 2.2, occupation: 70, floors: 4, basements: 1, setbackFront: 0, setbackRear: 3, setbackSide: 0, fondoEdificable: 0, alturaMaxima: 12, usosPosibles: [], usosPosiblesDetalle: '', parkingRatio: 1, parkingRatioMin: 1, vpoObligatorio: false, vpoPct: 0, proteccionPatrimonial: 'ninguna', confianza: '', fuenteNormativa: '', notas: '', condicionantes: [], parametrosReferencia: '', plotArea: 0, patioLoss: 5, commonAreaRatio: 16, efficiencyByUse: 84, avgUnitSize: 85, groundFloorCommercial: 0, municipio: '', provincia: '', refCat: '', direccion: '' });
  const setU = (k, v) => setUrb(p => ({ ...p, [k]: v }));
  const [mkt, setMkt] = useState({ salePriceM2: 0, salePriceM2Min: 0, salePriceM2Max: 0, salePriceCommercialM2: 0, rentPriceM2Month: 0, rentCommercialM2Month: 0, constructionPEM: 0, exitYield: 5, demanda: '', tendencia: '', absorcionMeses: 0, comentario: '', riesgos: [], oportunidades: [] });
  const setM = (k, v) => setMkt(p => ({ ...p, [k]: v }));
  const [fin, setFin] = useState({ purchaseCostsPct: 0.035, projectSoftPct: 0.12, licenseTaxPct: 0.055, developerOverheadsPct: 0.03, commercialPct: 0.03, financePct: 0.05, contingencyPct: 0.05, stabilizedOccupancy: 93, opexPctOnRent: 24, targetMargin: 0.18, monthsBuild: 18, monthsSales: 8, equityPct: 0.30, interestRate: 0.055, parkingCostPerSpace: 18000, urbanizationCost: 70 });
  const setF = (k, v) => setFin(p => ({ ...p, [k]: v }));
  const [opciones, setOpciones] = useState(null);
  const [selectedOpt, setSelectedOpt] = useState(null);

  const selKey = opciones?.opciones?.find(o => o.id === selectedOpt)?.useMultiplierKey || 'residencial_libre';
  const model = computeModel({ ...urb, ...mkt, ...fin, plotArea: urb.plotArea, plotCost: Number(plotCost) || 0, quality, useKey: selKey });
  const mcolor = model.margin >= 0.18 ? '#4ade80' : model.margin >= 0.12 ? '#fbbf24' : '#f87171';
  const landOk = (Number(plotCost) || 0) <= Math.max(model.maxLandSale, model.maxLandHold);

  // ── STEP 0→1: Catastro + Claude Urbanismo ────────────────────────────────
  const handleSolar = useCallback(async () => {
    setLoading(true);
    try {
      // 1. API Catastro
      setLoadMsg('Consultando API del Catastro (Ministerio de Hacienda)...');
      let cat = { ok: false };
      try {
        if (inputMode === 'rc' && rc.trim()) {
          cat = await apiCatastro({ mode: 'rc', rc: rc.trim() });
        } else if (inputMode === 'address' && addrProv && addrMun && addrVia && addrNum) {
          cat = await apiCatastro({ mode: 'address', provincia: addrProv, municipio: addrMun, tipoVia: addrTipoVia, nombreVia: addrVia, numero: addrNum });
        }
      } catch (e) { cat = { ok: false }; }
      setCatData(cat.ok ? cat : null);

      // 2. Claude con contexto MUY enriquecido
      setLoadMsg('Interpretando normativa urbanística específica con IA...');

      // Construir prompt ultra-específico con todos los datos disponibles
      const contexto = cat.ok ? `
DATOS REALES DEL CATASTRO ESPAÑOL (API Ministerio de Hacienda):
- Referencia catastral: ${cat.rc}
- Municipio: ${cat.municipio}
- Provincia: ${cat.provincia}
- Código postal: ${cat.cp || 'no disponible'}
- Dirección: ${cat.direccion || 'no disponible'}
- Uso catastral (luso): "${cat.uso}" ${cat.usosMultiples?.length > 1 ? `(también: ${cat.usosMultiples.slice(1).join(', ')})` : ''}
- Destino edificatorio catastral: "${cat.destinoEdif || 'no disponible'}"
- Clase del inmueble: ${cat.clase === 'U' ? 'Urbana' : cat.clase === 'R' ? 'Rústica' : cat.clase || 'no disponible'}
- Superficie de la finca/solar: ${cat.superficiePlot || cat.superficie} m²
- Superficie construida existente: ${cat.superficieCons || 0} m²
- Año de construcción: ${cat.anyoConstruccion || 'solar sin construir o no disponible'}
- Estado: ${cat.esSolar ? 'SOLAR SIN EDIFICAR' : cat.esUrbanoConstruido ? 'EDIFICIO EXISTENTE (posible derribo o reforma)' : 'Inmueble'}
- Coordenadas GPS: ${cat.tieneCoords ? `Latitud ${cat.lat.toFixed(5)}, Longitud ${cat.lng.toFixed(5)}` : 'no disponibles en esta consulta'}
- Calidad de producto objetivo del promotor: ${quality}

Analiza este solar con todos estos datos reales y devuelve los parámetros urbanísticos ESPECÍFICOS del PGOU/normativa 
vigente en ${cat.municipio} (${cat.provincia}) para una parcela con estas características en esa localización exacta.
Identifica el barrio/zona usando las coordenadas GPS si están disponibles, el código postal y la dirección.
Sé muy específico en la edificabilidad, ocupación, alturas y usos según la normativa real de ${cat.municipio}.` 
      : `
DATOS INTRODUCIDOS POR EL USUARIO (sin datos de Catastro disponibles):
- Referencia catastral: ${rc || 'no disponible'}
- Provincia: ${addrProv || 'no indicada'}
- Municipio: ${addrMun || 'no indicado'}
- Tipo de vía: ${addrTipoVia}
- Nombre de vía: ${addrVia || 'no indicada'}
- Número: ${addrNum || 'no indicado'}
- Calidad de producto objetivo: ${quality}

Analiza este solar basándote en los datos disponibles. Aplica la normativa urbanística habitual 
del municipio indicado para una zona residencial urbana consolidada típica.`;

      const aiUrb = await apiClaude('urbanismo', contexto);
      const plotArea = (cat.ok && (cat.superficiePlot || cat.superficie) > 0)
        ? (cat.superficiePlot || cat.superficie)
        : (urb.plotArea || 500);

      // Aplicar TODOS los campos devueltos por la IA
      setUrb({
        claseUrbanistica: aiUrb?.claseUrbanistica || 'urbano_consolidado',
        calificacion: aiUrb?.calificacion || 'Residencial',
        zona: aiUrb?.zona || '',
        buildability: aiUrb?.buildability || 2.2,
        occupation: aiUrb?.occupation || 70,
        floors: aiUrb?.floors || 4,
        alturaMaxima: aiUrb?.alturaMaxima || 12,
        basements: aiUrb?.basements ?? 1,
        setbackFront: aiUrb?.setbackFront ?? 0,
        setbackRear: aiUrb?.setbackRear ?? 3,
        setbackSide: aiUrb?.setbackSide ?? 0,
        fondoEdificable: aiUrb?.fondoEdificable || 0,
        usosPosibles: aiUrb?.usosPosibles || ['residencial_libre'],
        usosPosiblesDetalle: aiUrb?.usosPosiblesDetalle || '',
        parkingRatio: aiUrb?.parkingRatioMin || 1,
        parkingRatioMin: aiUrb?.parkingRatioMin || 1,
        vpoObligatorio: aiUrb?.vpoObligatorio || false,
        vpoPct: aiUrb?.vpoPct || 0,
        proteccionPatrimonial: aiUrb?.proteccionPatrimonial || 'ninguna',
        confianza: aiUrb?.confianza || 'media',
        fuenteNormativa: aiUrb?.fuenteNormativa || '',
        notas: aiUrb?.notas || '',
        condicionantes: aiUrb?.condicionantes || [],
        parametrosReferencia: aiUrb?.parametrosReferencia || '',
        plotArea,
        patioLoss: 5, commonAreaRatio: 16, efficiencyByUse: 84, avgUnitSize: 85, groundFloorCommercial: 0,
        municipio: cat.municipio || addrMun || '',
        provincia: cat.provincia || addrProv || '',
        refCat: cat.rc || rc,
        direccion: cat.direccion || `${addrTipoVia} ${addrVia} ${addrNum}`,
        cp: cat.cp || '',
        lat: cat.lat,
        lng: cat.lng,
      });
      setStep(1);
    } finally { setLoading(false); }
  }, [rc, inputMode, addrProv, addrMun, addrTipoVia, addrVia, addrNum, urb.plotArea, quality]);

  // ── STEP 1→2: Claude Mercado con contexto completo ───────────────────────
  const handleMercado = useCallback(async () => {
    setLoading(true);
    setLoadMsg('Analizando precios de mercado específicos para esta zona...');
    try {
      const contextoMercado = `
SOLAR A ANALIZAR — DATOS CONFIRMADOS:
- Municipio: ${urb.municipio}
- Provincia: ${urb.provincia}
- Código postal: ${urb.cp || 'no disponible'}
- Dirección: ${urb.direccion || 'no disponible'}
- Barrio/zona identificada: ${urb.zona || 'no determinada aún'}
- Coordenadas GPS: ${urb.lat ? `Lat ${urb.lat.toFixed(4)}, Lng ${urb.lng.toFixed(4)}` : 'no disponibles'}
- Uso catastral real: "${catData?.uso || 'residencial'}"
- Superficie solar: ${urb.plotArea} m²
- Superficie construida existente: ${catData?.superficieCons || 0} m² (${catData?.esSolar ? 'solar vacío' : 'con edificio existente'})
- Año construcción existente: ${catData?.anyoConstruccion || 'no aplica'}
- Calificación urbanística: ${urb.calificacion}
- Clase urbanística: ${urb.claseUrbanistica}
- Usos posibles: ${urb.usosPosibles?.join(', ')}
- Calidad del producto objetivo: ${quality}
- Parámetros edificatorios: ${urb.buildability} m²t/m²s, ${urb.floors} plantas, ${urb.occupation}% ocupación
- Fondo edificable: ${urb.fondoEdificable || 'libre'}
- Protección patrimonial: ${urb.proteccionPatrimonial}

Proporciona precios de mercado MUY ESPECÍFICOS para este municipio y barrio/zona.
Considera: (1) si es zona prime, media o periférica dentro del municipio, 
(2) la demanda real actual en esa zona, (3) los costes de construcción ajustados a la región,
(4) el yield de salida apropiado para inversores institucionales en ese mercado.`;

      const ai = await apiClaude('mercado', contextoMercado);
      if (ai && !ai.error) {
        setMkt({
          salePriceM2: ai.salePriceM2 || 2500,
          salePriceM2Min: ai.salePriceM2Min || ai.salePriceM2 * 0.9,
          salePriceM2Max: ai.salePriceM2Max || ai.salePriceM2 * 1.15,
          salePriceCommercialM2: ai.salePriceCommercialM2 || 1800,
          rentPriceM2Month: ai.rentPriceM2Month || 12,
          rentCommercialM2Month: ai.rentCommercialM2Month || 10,
          constructionPEM: ai.constructionPEM || 1200,
          exitYield: ai.exitYield || 5.5,
          demanda: ai.demanda || 'media',
          tendencia: ai.tendencia || 'estable',
          absorcionMeses: ai.absorcionMeses || 12,
          precioAlquilerNuevaCons: ai.precioAlquilerNuevaCons || ai.rentPriceM2Month * 1.2,
          comentario: ai.comentario || '',
          riesgos: ai.riesgos || [],
          oportunidades: ai.oportunidades || [],
          fuentesReferencia: ai.fuentesReferencia || '',
        });
      }
      setStep(2);
    } finally { setLoading(false); }
  }, [urb, catData, quality]);

  // ── STEP 2→3: Claude Opciones con modelo económico real ──────────────────
  const handleOpciones = useCallback(async () => {
    setLoading(true);
    setLoadMsg('Generando estrategias de negocio óptimas para este solar...');
    try {
      const base = computeModel({ ...urb, ...mkt, ...fin, plotArea: urb.plotArea, plotCost: Number(plotCost) || 0, quality, useKey: 'residencial_libre' });

      const contextoOpciones = `
INFORME COMPLETO DEL SOLAR:

1. DATOS CATASTRALES REALES:
- Ref. catastral: ${urb.refCat}
- Municipio: ${urb.municipio} (${urb.provincia})
- Dirección: ${urb.direccion}
- Barrio/zona: ${urb.zona || 'no determinada'}
- CP: ${urb.cp || 'no disponible'}
- Superficie solar: ${urb.plotArea} m²
- Uso catastral: "${catData?.uso || 'residencial'}"
- Estado actual: ${catData?.esSolar ? 'solar vacío' : `edificio de ${catData?.anyoConstruccion || '?'}, ${catData?.superficieCons || 0} m²c`}

2. NORMATIVA URBANÍSTICA ESPECÍFICA:
- Calificación: ${urb.calificacion}
- Fuente normativa: ${urb.fuenteNormativa || 'PGOU municipal'}
- Edificabilidad: ${urb.buildability} m²t/m²s
- Ocupación: ${urb.occupation}%
- Plantas: ${urb.floors} sobre rasante (H max: ${urb.alturaMaxima}m)
- Sótanos: ${urb.basements}
- Retranqueos: frontal ${urb.setbackFront}m / trasero ${urb.setbackRear}m / lateral ${urb.setbackSide}m
- Fondo edificable: ${urb.fondoEdificable || 'libre'}
- Usos posibles: ${urb.usosPosibles?.join(', ')}
- Detalle usos: ${urb.usosPosiblesDetalle || ''}
- VPO obligatorio: ${urb.vpoObligatorio ? `Sí, ${urb.vpoPct}%` : 'No'}
- Protección patrimonial: ${urb.proteccionPatrimonial}
- Condicionantes: ${urb.condicionantes?.join('; ') || 'ninguno detectado'}

3. MERCADO LOCAL (${urb.municipio} - ${urb.zona || 'zona'}):
- Precio venta vivienda nueva: ${mkt.salePriceM2} €/m² (rango: ${mkt.salePriceM2Min}-${mkt.salePriceM2Max} €/m²)
- Precio venta comercial: ${mkt.salePriceCommercialM2} €/m²
- Alquiler residencial: ${mkt.rentPriceM2Month} €/m²/mes (nueva construcción: ${mkt.precioAlquilerNuevaCons || (mkt.rentPriceM2Month * 1.2).toFixed(1)} €/m²/mes)
- Alquiler comercial: ${mkt.rentCommercialM2Month} €/m²/mes
- PEM construcción: ${mkt.constructionPEM} €/m²c
- Exit yield: ${mkt.exitYield}%
- Demanda: ${mkt.demanda} | Tendencia: ${mkt.tendencia}
- Absorción estimada: ${mkt.absorcionMeses} meses para vender promoción completa
- Análisis de mercado: ${mkt.comentario}
- Riesgos de mercado: ${mkt.riesgos?.join('; ')}
- Oportunidades: ${mkt.oportunidades?.join('; ')}

4. MODELO ECONÓMICO BASE (residencial libre, calidad ${quality}):
- Superficie construida estimada: ${n0(base.adjusted)} m²c
- Superficie vendible residencial: ${n0(base.saleRes)} m²
- Unidades estimadas: ${n0(base.units)} viviendas (~${urb.avgUnitSize || 85} m² media)
- Ingresos estimados venta: ${fmt(base.salesRev)}
- Coste total estimado: ${fmt(base.totalSale)}
- Beneficio estimado: ${fmt(base.profit)}
- Margen sobre ventas: ${pct(base.margin)}
- Precio solar actual (si conocido): ${plotCost ? fmt(Number(plotCost)) : 'no indicado'}
- Oferta máxima calculada por solar: ${fmt(base.maxLandSale)}

Propón las 3 mejores estrategias para ESTE solar específico. Considera el tamaño (${urb.plotArea}m²), 
la zona (${urb.zona || urb.municipio}), los usos permitidos y el mercado local real.`;

      const ai = await apiClaude('opciones', contextoOpciones);
      if (ai && !ai.error) {
        setOpciones(ai);
        setSelectedOpt(ai.opciones?.[0]?.id);
      }
      setStep(3);
    } finally { setLoading(false); }
  }, [urb, mkt, fin, plotCost, quality, catData]);

  const canAnalyze = inputMode === 'rc' ? rc.trim().length >= 14 : (addrProv && addrMun && addrVia && addrNum);

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#050c18', color: '#e0eaff', fontFamily: "'Outfit','DM Sans',system-ui,sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        select option{background:#0a1628}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:4px}
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
          <Progress steps={STEPS} current={step} />
          <div style={{ fontSize: 10, color: '#1e3045', fontFamily: "'DM Mono',monospace", fontWeight: 600 }}>Catastro + Claude AI</div>
        </div>
      </div>

      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '36px 28px' }}>

        {/* ── STEP 0 ── */}
        {step === 0 && (
          <div style={{ animation: 'fadeUp 0.4s ease' }}>
            <div style={{ maxWidth: 620, marginBottom: 44 }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#5eead4', marginBottom: 12 }}>Viabilidad Inmobiliaria · IA</div>
              <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.12, marginBottom: 16 }}>
                Introduce el solar.<br />
                <span style={{ background: 'linear-gradient(90deg,#5eead4,#3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Todo lo demás es automático.</span>
              </h1>
              <p style={{ fontSize: 14, color: '#3d5a7a', lineHeight: 1.75 }}>
                Conectamos con la <strong style={{ color: '#5eead4' }}>API del Catastro</strong> para obtener datos reales: superficie, uso, coordenadas GPS. 
                Con eso, Claude AI aplica la normativa urbanística específica de ese municipio y barrio, 
                analiza los precios de mercado reales de esa zona, y genera las opciones de negocio con viabilidad económica completa.
              </p>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
              {[['rc', 'Por referencia catastral'], ['address', 'Por dirección']].map(([m, l]) => (
                <button key={m} onClick={() => setInputMode(m)} style={{ padding: '8px 18px', borderRadius: 20, border: `1px solid ${inputMode === m ? '#5eead4' : 'rgba(255,255,255,0.08)'}`, background: inputMode === m ? 'rgba(94,234,212,0.08)' : 'transparent', color: inputMode === m ? '#5eead4' : '#3d5a7a', fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{l}</button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, maxWidth: 900 }}>
              <Card>
                <CT>{inputMode === 'rc' ? 'Referencia catastral' : 'Dirección del solar'}</CT>
                {inputMode === 'rc' ? (
                  <Field label="Referencia catastral (14-20 caracteres)" hint="Encuéntrala en sedecatastro.gob.es → Consulta de datos catastrales → busca por dirección">
                    <Inp value={rc} onChange={e => setRc(e.target.value)} placeholder="Ej: 7837301YN1073N0001OX" />
                  </Field>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                    <Field label="Provincia"><Inp value={addrProv} onChange={e => setAddrProv(e.target.value)} placeholder="Sevilla" /></Field>
                    <Field label="Municipio"><Inp value={addrMun} onChange={e => setAddrMun(e.target.value)} placeholder="Sevilla" /></Field>
                    <Field label="Tipo vía">
                      <Sel value={addrTipoVia} onChange={setAddrTipoVia}>
                        {[['CL','Calle'],['AV','Avenida'],['PZ','Plaza'],['CR','Carretera'],['PS','Paseo'],['GV','Gran Vía'],['CM','Camino']].map(([k,v]) => <option key={k} value={k}>{k} · {v}</option>)}
                      </Sel>
                    </Field>
                    <div style={{ gridColumn: '1/3' }}><Field label="Nombre de la vía"><Inp value={addrVia} onChange={e => setAddrVia(e.target.value)} placeholder="Constitución" /></Field></div>
                    <Field label="Número"><Inp value={addrNum} onChange={e => setAddrNum(e.target.value)} placeholder="12" /></Field>
                  </div>
                )}
              </Card>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Card>
                  <CT>Inversión</CT>
                  <Field label="Precio del solar (€)" hint="Déjalo en blanco si aún no lo sabes">
                    <Inp type="number" value={plotCost} onChange={e => setPlotCost(e.target.value)} placeholder="Ej: 480000" />
                  </Field>
                  <Field label="Calidad del producto">
                    <Sel value={quality} onChange={setQuality}>
                      {[['basica','Básica'],['media','Media'],['media_alta','Media-alta'],['alta','Alta'],['premium','Premium']].map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                    </Sel>
                  </Field>
                </Card>
                <div style={{ padding: 16, background: 'rgba(94,234,212,0.04)', border: '1px solid rgba(94,234,212,0.12)', borderRadius: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#5eead4', marginBottom: 10 }}>✓ Totalmente automático</div>
                  {['Superficie real del solar (Catastro)', 'Uso catastral y coordenadas GPS', 'Normativa PGOU específica del municipio', 'Edificabilidad y parámetros por zona', 'Precios de mercado locales reales', 'Opciones de negocio optimizadas', 'Viabilidad económica completa'].map(t => (
                    <div key={t} style={{ fontSize: 11, color: '#2d4a6a', marginBottom: 4 }}>→ {t}</div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 28, display: 'flex', alignItems: 'center', gap: 18 }}>
              <Btn primary onClick={handleSolar} disabled={loading || !canAnalyze}>
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
                <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em' }}>
                  {urb.municipio}{urb.provincia ? ` · ${urb.provincia}` : ''}
                  {urb.zona ? <span style={{ fontSize: 16, color: '#5a7a9a', fontWeight: 600 }}> · {urb.zona}</span> : null}
                </h2>
                {urb.refCat && <div style={{ fontSize: 12, color: '#3d5a7a', marginTop: 4 }}>Ref: {urb.refCat}{urb.cp ? ` · CP ${urb.cp}` : ''}</div>}
                {urb.fuenteNormativa && <div style={{ fontSize: 11, color: '#5eead4', marginTop: 4 }}>📋 {urb.fuenteNormativa}</div>}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                {urb.confianza && <Tag color={urb.confianza === 'alta' ? '#4ade80' : urb.confianza === 'media' ? '#fbbf24' : '#f87171'}>Confianza IA: {urb.confianza}</Tag>}
                {catData?.ok && <Tag color="#5eead4">✓ Catastro real</Tag>}
                {catData?.tieneCoords && <Tag color="#3b82f6">📍 GPS</Tag>}
                {urb.proteccionPatrimonial !== 'ninguna' && <Tag color="#f87171">⚠ Protección patrimonial</Tag>}
              </div>
            </div>

            {/* Nota IA */}
            {urb.notas && (
              <div style={{ marginBottom: 14, padding: '12px 16px', background: 'rgba(94,234,212,0.05)', border: '1px solid rgba(94,234,212,0.15)', borderRadius: 12, fontSize: 13, color: '#9db8d0', lineHeight: 1.7 }}>
                <span style={{ color: '#5eead4', fontWeight: 700 }}>Análisis urbanístico IA: </span>{urb.notas}
              </div>
            )}
            {urb.usosPosiblesDetalle && (
              <div style={{ marginBottom: 14, padding: '10px 14px', background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.12)', borderRadius: 10, fontSize: 12, color: '#7aa3c8', lineHeight: 1.65 }}>
                <span style={{ color: '#3b82f6', fontWeight: 700 }}>Usos: </span>{urb.usosPosiblesDetalle}
              </div>
            )}
            {urb.condicionantes?.length > 0 && (
              <div style={{ marginBottom: 14, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {urb.condicionantes.map(c => <span key={c} style={{ fontSize: 11, padding: '4px 10px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 16, color: '#fbbf24' }}>⚠ {c}</span>)}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
              <Card>
                <CT>Parámetros edificatorios (generados por IA · editables)</CT>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                  <Field label="Superficie solar (m²s)"><Inp type="number" value={urb.plotArea} onChange={e => setU('plotArea', Number(e.target.value))} /></Field>
                  <Field label="Edificabilidad (m²t/m²s)"><Inp type="number" step="0.1" value={urb.buildability} onChange={e => setU('buildability', Number(e.target.value))} /></Field>
                  <Field label="Ocupación máx. (%)"><Inp type="number" value={urb.occupation} onChange={e => setU('occupation', Number(e.target.value))} /></Field>
                  <Field label="Plantas sobre rasante"><Inp type="number" value={urb.floors} onChange={e => setU('floors', Number(e.target.value))} /></Field>
                  <Field label="Altura máxima (m)"><Inp type="number" step="0.5" value={urb.alturaMaxima} onChange={e => setU('alturaMaxima', Number(e.target.value))} /></Field>
                  <Field label="Sótanos"><Inp type="number" value={urb.basements} onChange={e => setU('basements', Number(e.target.value))} /></Field>
                  <Field label="Retranqueo frontal (m)"><Inp type="number" step="0.5" value={urb.setbackFront} onChange={e => setU('setbackFront', Number(e.target.value))} /></Field>
                  <Field label="Retranqueo trasero (m)"><Inp type="number" step="0.5" value={urb.setbackRear} onChange={e => setU('setbackRear', Number(e.target.value))} /></Field>
                  <Field label="Retranqueos laterales (m)"><Inp type="number" step="0.5" value={urb.setbackSide} onChange={e => setU('setbackSide', Number(e.target.value))} /></Field>
                  <Field label="Parking por vivienda"><Inp type="number" step="0.1" value={urb.parkingRatio} onChange={e => setU('parkingRatio', Number(e.target.value))} /></Field>
                  <Field label="Sup. media vivienda (m²)"><Inp type="number" value={urb.avgUnitSize} onChange={e => setU('avgUnitSize', Number(e.target.value))} /></Field>
                  <Field label="Comercial planta baja (%)"><Inp type="number" value={urb.groundFloorCommercial} onChange={e => setU('groundFloorCommercial', Number(e.target.value))} /></Field>
                </div>
              </Card>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Card>
                  <CT>Aprovechamiento resultante</CT>
                  {[
                    ['Construido s/ rasante', `${n0(model.adjusted)} m²c`, '#e0eaff'],
                    ['Vendible residencial', `${n0(model.saleRes)} m²`, '#5eead4'],
                    ['Unidades estimadas', n0(model.units), '#5eead4'],
                    ['Plazas parking', n0(model.parking), '#e0eaff'],
                  ].map(([l, v, c]) => (
                    <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <span style={{ fontSize: 12, color: '#3d5a7a' }}>{l}</span>
                      <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700, color: c, fontSize: 13 }}>{v}</span>
                    </div>
                  ))}
                </Card>

                {urb.usosPosibles?.length > 0 && (
                  <Card>
                    <CT>Usos compatibles (IA)</CT>
                    <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                      {urb.usosPosibles.map(u => <Tag key={u} color="#3b82f6">{u.replace(/_/g, ' ')}</Tag>)}
                    </div>
                    {urb.vpoObligatorio && <div style={{ marginTop: 10, fontSize: 11, color: '#fbbf24', padding: '6px 10px', background: 'rgba(251,191,36,0.06)', borderRadius: 8 }}>⚠ Reserva VPO obligatoria: {urb.vpoPct}%</div>}
                  </Card>
                )}

                {catData?.ok && (
                  <Card>
                    <CT>Datos Catastro reales</CT>
                    {[
                      ['Superficie finca', `${n0(catData.superficiePlot || catData.superficie)} m²`],
                      ['Sup. construida existente', catData.superficieCons > 0 ? `${n0(catData.superficieCons)} m²` : 'Solar vacío'],
                      ['Uso catastral', catData.uso],
                      ['Año construcción', catData.anyoConstruccion || 'Solar'],
                      ['Coordenadas', catData.tieneCoords ? `${catData.lat?.toFixed(4)}, ${catData.lng?.toFixed(4)}` : 'No disponibles'],
                    ].filter(([, v]) => v && v !== '0' && v !== 'undefined').map(([l, v]) => (
                      <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 6 }}>
                        <span style={{ color: '#3d5a7a' }}>{l}</span>
                        <span style={{ color: '#7aa3c8', fontWeight: 600, textAlign: 'right', maxWidth: '60%' }}>{v}</span>
                      </div>
                    ))}
                  </Card>
                )}

                {urb.parametrosReferencia && (
                  <div style={{ padding: 12, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, fontSize: 11, color: '#3d5a7a', lineHeight: 1.6 }}>
                    <span style={{ color: '#5eead4', fontWeight: 700 }}>Ref: </span>{urb.parametrosReferencia}
                  </div>
                )}
              </div>
            </div>

            <div style={{ marginTop: 22, display: 'flex', gap: 10 }}>
              <Btn onClick={() => setStep(0)}>← Volver</Btn>
              <Btn primary onClick={handleMercado} disabled={loading}>{loading ? 'Analizando...' : '◎ Analizar mercado local →'}</Btn>
              {loading && <Spin msg={loadMsg} />}
            </div>
          </div>
        )}

        {/* ── STEP 2: Mercado ── */}
        {step === 2 && (
          <div style={{ animation: 'fadeUp 0.4s ease' }}>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#5eead4', marginBottom: 8 }}>Mercado inmobiliario local</div>
              <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em' }}>
                {urb.municipio}{urb.zona ? ` · ${urb.zona}` : ''} · Precios de mercado
              </h2>
            </div>

            {mkt.comentario && (
              <div style={{ marginBottom: 16, padding: '14px 18px', background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 12, fontSize: 13, color: '#9db8d0', lineHeight: 1.7 }}>
                <span style={{ color: '#3b82f6', fontWeight: 700 }}>Análisis de mercado IA: </span>{mkt.comentario}
                <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {mkt.demanda && <Tag color={mkt.demanda === 'alta' ? '#4ade80' : mkt.demanda === 'media' ? '#fbbf24' : '#f87171'}>Demanda {mkt.demanda}</Tag>}
                  {mkt.tendencia && <Tag color={mkt.tendencia === 'alcista' ? '#4ade80' : mkt.tendencia === 'estable' ? '#fbbf24' : '#f87171'}>{mkt.tendencia}</Tag>}
                  {mkt.absorcionMeses > 0 && <Tag color="#a78bfa">Absorción: {mkt.absorcionMeses} meses</Tag>}
                  {mkt.fuentesReferencia && <Tag color="#64748b">{mkt.fuentesReferencia}</Tag>}
                </div>
              </div>
            )}

            {(mkt.riesgos?.length > 0 || mkt.oportunidades?.length > 0) && (
              <div style={{ marginBottom: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {mkt.riesgos?.length > 0 && (
                  <div style={{ padding: '10px 14px', background: 'rgba(248,113,113,0.04)', border: '1px solid rgba(248,113,113,0.15)', borderRadius: 10 }}>
                    <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#f87171', marginBottom: 6 }}>Riesgos de mercado</div>
                    {mkt.riesgos.map(r => <div key={r} style={{ fontSize: 11, color: '#9db8d0', marginBottom: 3 }}>⚠ {r}</div>)}
                  </div>
                )}
                {mkt.oportunidades?.length > 0 && (
                  <div style={{ padding: '10px 14px', background: 'rgba(74,222,128,0.04)', border: '1px solid rgba(74,222,128,0.15)', borderRadius: 10 }}>
                    <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#4ade80', marginBottom: 6 }}>Oportunidades</div>
                    {mkt.oportunidades.map(o => <div key={o} style={{ fontSize: 11, color: '#9db8d0', marginBottom: 3 }}>✓ {o}</div>)}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <Card>
                <CT>Precios de mercado (generados por IA · editables)</CT>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <Field label={`Venta residencial (€/m²) · rango ${mkt.salePriceM2Min}-${mkt.salePriceM2Max}`}>
                    <Inp type="number" value={mkt.salePriceM2} onChange={e => setM('salePriceM2', Number(e.target.value))} />
                  </Field>
                  <Field label="Venta comercial (€/m²)">
                    <Inp type="number" value={mkt.salePriceCommercialM2} onChange={e => setM('salePriceCommercialM2', Number(e.target.value))} />
                  </Field>
                  <Field label="Alquiler residencial (€/m²/mes)">
                    <Inp type="number" step="0.1" value={mkt.rentPriceM2Month} onChange={e => setM('rentPriceM2Month', Number(e.target.value))} />
                  </Field>
                  <Field label="Alquiler comercial (€/m²/mes)">
                    <Inp type="number" step="0.1" value={mkt.rentCommercialM2Month} onChange={e => setM('rentCommercialM2Month', Number(e.target.value))} />
                  </Field>
                  <Field label="PEM construcción (€/m²c)">
                    <Inp type="number" value={mkt.constructionPEM} onChange={e => setM('constructionPEM', Number(e.target.value))} />
                  </Field>
                  <Field label="Exit yield (%)">
                    <Inp type="number" step="0.1" value={mkt.exitYield} onChange={e => setM('exitYield', Number(e.target.value))} />
                  </Field>
                </div>
              </Card>
              <Card>
                <CT>Parámetros financieros (editables)</CT>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  {[
                    ['Costes adquisición', 'purchaseCostsPct', '0.001'],
                    ['Honorarios técnicos', 'projectSoftPct', '0.01'],
                    ['Licencias / ICIO', 'licenseTaxPct', '0.01'],
                    ['Estructura promotora', 'developerOverheadsPct', '0.01'],
                    ['Comercialización', 'commercialPct', '0.01'],
                    ['Coste financiero', 'financePct', '0.01'],
                    ['Imprevistos', 'contingencyPct', '0.01'],
                    ['Equity (ratio)', 'equityPct', '0.01'],
                    ['Tipo interés', 'interestRate', '0.001'],
                    ['Meses de obra', 'monthsBuild', '1'],
                    ['Meses ventas', 'monthsSales', '1'],
                    ['Margen objetivo', 'targetMargin', '0.01'],
                  ].map(([l, k, s]) => (
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
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#5eead4', marginBottom: 8 }}>Estrategias de negocio</div>
              <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em' }}>{urb.municipio}{urb.zona ? ` · ${urb.zona}` : ''} · {n0(urb.plotArea)} m²s</h2>
            </div>

            {opciones.recomendacion && (
              <div style={{ marginBottom: 20, padding: '16px 20px', background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: 14, fontSize: 13, color: '#9db8d0', lineHeight: 1.8 }}>
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#3b82f6', marginBottom: 8 }}>Recomendación estratégica IA</div>
                {opciones.recomendacion}
                {opciones.precioMaximoSolarOrientativo > 0 && (
                  <div style={{ marginTop: 10, fontSize: 12, color: '#5eead4', fontWeight: 700 }}>
                    💰 Precio máximo orientativo por el solar: {fmt(opciones.precioMaximoSolarOrientativo)}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 20 }}>
              {opciones.opciones?.map((opt, i) => (
                <div key={opt.id} onClick={() => setSelectedOpt(opt.id)}
                  style={{ cursor: 'pointer', padding: 22, background: selectedOpt === opt.id ? 'rgba(94,234,212,0.06)' : 'rgba(255,255,255,0.02)', border: `1px solid ${selectedOpt === opt.id ? 'rgba(94,234,212,0.4)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 16, transition: 'all 0.2s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 26, fontWeight: 800, color: selectedOpt === opt.id ? '#5eead4' : '#1e3045' }}>{String(i + 1).padStart(2, '0')}</span>
                    <Tag color={opt.riesgo === 'bajo' ? '#4ade80' : opt.riesgo === 'medio' ? '#fbbf24' : '#f87171'}>Riesgo {opt.riesgo}</Tag>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, color: selectedOpt === opt.id ? '#e0eaff' : '#5a7a9a' }}>{opt.nombre}</div>
                  <div style={{ fontSize: 11, color: '#2d4a6a', lineHeight: 1.65, marginBottom: 12 }}>{opt.descripcion}</div>
                  <div style={{ height: 3, background: 'rgba(255,255,255,0.04)', borderRadius: 3, marginBottom: 4 }}>
                    <div style={{ height: '100%', width: `${opt.puntuacion * 10}%`, background: selectedOpt === opt.id ? '#5eead4' : '#3b82f6', borderRadius: 3 }} />
                  </div>
                  <div style={{ fontSize: 10, color: '#2d4a6a', marginBottom: 12 }}>{opt.puntuacion}/10 · {opt.plazo}</div>
                  {opt.retornoEsperado && <div style={{ fontSize: 11, color: '#5eead4', fontWeight: 700, marginBottom: 10 }}>↑ {opt.retornoEsperado}</div>}
                  {opt.factoresClave && <div style={{ fontSize: 11, color: '#3b82f6', marginBottom: 10, lineHeight: 1.5 }}>🔑 {opt.factoresClave}</div>}
                  {opt.ventajas?.map(v => <div key={v} style={{ fontSize: 11, color: '#4ade80', marginBottom: 3 }}>+ {v}</div>)}
                  {opt.inconvenientes?.map(v => <div key={v} style={{ fontSize: 11, color: '#f87171', marginBottom: 3 }}>− {v}</div>)}
                </div>
              ))}
            </div>

            {opciones.alertas?.length > 0 && (
              <div style={{ marginBottom: 20, padding: '14px 18px', background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.15)', borderRadius: 12 }}>
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#fbbf24', marginBottom: 10 }}>Alertas y condicionantes</div>
                {opciones.alertas.map(a => <div key={a} style={{ fontSize: 12, color: '#9db8d0', marginBottom: 5, lineHeight: 1.5 }}>⚠ {a}</div>)}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <Btn onClick={() => setStep(2)}>← Volver</Btn>
              <Btn primary onClick={() => setStep(4)}>✦ Ver viabilidad económica completa →</Btn>
            </div>
          </div>
        )}

        {/* ── STEP 4: Resultado ── */}
        {step === 4 && (
          <div style={{ animation: 'fadeUp 0.4s ease' }}>
            <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#5eead4', marginBottom: 8 }}>Resultado económico</div>
                <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em' }}>
                  {urb.municipio}{urb.zona ? ` · ${urb.zona}` : ''} · {opciones?.opciones?.find(o => o.id === selectedOpt)?.nombre || 'Análisis'}
                </h2>
                <div style={{ fontSize: 12, color: '#3d5a7a', marginTop: 4 }}>
                  {urb.plotArea} m²s · {n0(model.adjusted)} m²c · {n0(model.units)} uds. · {urb.calificacion}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn small onClick={() => setStep(3)}>← Cambiar opción</Btn>
                <Btn small onClick={() => { setStep(0); setOpciones(null); setCatData(null); setUrb(u => ({ ...u, plotArea: 0, municipio: '', provincia: '' })); }}>◈ Nuevo solar</Btn>
              </div>
            </div>

            {/* KPIs principales */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
              <Kpi label="Beneficio venta" value={fmt(model.profit)} hint={`Margen: ${pct(model.margin)}`} color={mcolor} size="lg" />
              <Kpi label="TIR estimada" value={pct(model.irr)} hint="Modelo simplificado" color="#3b82f6" size="lg" />
              <Kpi label="ROI equity" value={pct(model.roiEq)} color="#a78bfa" size="lg" />
              <Kpi label="Ingresos venta" value={fmt(model.salesRev)} size="lg" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
              <Card>
                <CT>Desglose económico completo</CT>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <tbody>
                    {[
                      ['Solar', Number(plotCost) || 0, false],
                      ['Gastos adquisición', model.buyFees, false],
                      ['Hard cost (obra + parking + sótanos)', model.hardCost, false],
                      ['Soft costs (honorarios técnicos)', model.soft, false],
                      ['Licencias y tasas (ICIO)', model.lic, false],
                      ['Imprevistos', model.cont, false],
                      ['Financiación promotora', model.finCost, false],
                      ['Comercialización', model.mktCost, false],
                      ['── Total coste promoción', model.totalSale, true],
                      ['── Ingresos totales venta', model.salesRev, true],
                      ['── Beneficio bruto', model.profit, 'profit'],
                    ].map(([l, v, b]) => (
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
                  <CT>Alternativa patrimonial BTR</CT>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <Kpi label="Renta bruta anual" value={fmt(model.rent)} color="#a78bfa" />
                    <Kpi label="NOI" value={fmt(model.noi)} color="#a78bfa" />
                    <Kpi label="Valor estabilizado" value={fmt(model.stabVal)} hint={`Cap rate ${pct(model.capRate)}`} />
                    <Kpi label="Beneficio patrimonial" value={fmt(model.profitHold)} color={model.profitHold >= 0 ? '#4ade80' : '#f87171'} />
                  </div>
                </Card>

                <Card>
                  <CT>Oferta máxima por el solar</CT>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                    <Kpi label="Modelo venta" value={fmt(model.maxLandSale)} color="#5eead4" />
                    <Kpi label="Modelo patrimonial" value={fmt(model.maxLandHold)} color="#3b82f6" />
                  </div>
                  {opciones?.precioMaximoSolarOrientativo > 0 && (
                    <div style={{ marginBottom: 10, padding: '8px 12px', background: 'rgba(94,234,212,0.05)', border: '1px solid rgba(94,234,212,0.15)', borderRadius: 8, fontSize: 11, color: '#5eead4' }}>
                      IA recomienda máximo: {fmt(opciones.precioMaximoSolarOrientativo)}
                    </div>
                  )}
                  {Number(plotCost) > 0 && (
                    <div style={{ padding: '10px 14px', borderRadius: 10, fontSize: 12, lineHeight: 1.6, background: landOk ? 'rgba(74,222,128,0.06)' : 'rgba(248,113,113,0.06)', border: `1px solid ${landOk ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}`, color: landOk ? '#4ade80' : '#f87171' }}>
                      {landOk ? `✓ El precio (${fmt(Number(plotCost))}) está dentro del rango aconsejable.` : `✗ El precio (${fmt(Number(plotCost))}) supera la oferta máxima razonable.`}
                    </div>
                  )}
                </Card>

                <Card>
                  <CT>Modelo financiero apalancado</CT>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <Kpi label="Equity" value={fmt(model.eq)} />
                    <Kpi label="Deuda promotora" value={fmt(model.debt)} />
                    <Kpi label="Coste financiero" value={fmt(model.finLev)} color="#fbbf24" />
                    <Kpi label="Beneficio apalancado" value={fmt(model.profLev)} color={model.profLev >= 0 ? '#4ade80' : '#f87171'} />
                  </div>
                </Card>
              </div>
            </div>

            <Card>
              <CT>Sensibilidad del beneficio a variación del precio de venta</CT>
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={model.stress} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
                    <XAxis dataKey="name" tick={{ fill: '#3d5a7a', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#3d5a7a', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${Math.round(v / 1000)}k€`} width={60} />
                    <Tooltip content={({ active, payload, label }) => active && payload?.length
                      ? <div style={{ background: '#0a1628', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
                        <div style={{ color: '#3d5a7a', marginBottom: 3 }}>{label}</div>
                        <div style={{ fontWeight: 700, color: payload[0].value >= 0 ? '#4ade80' : '#f87171' }}>{fmt(payload[0].value)}</div>
                      </div> : null} />
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
