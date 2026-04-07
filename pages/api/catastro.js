// pages/api/catastro.js
// Servidor proxy para la API del Catastro — evita restricciones CORS del navegador

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { mode, rc, provincia, municipio, tipoVia, nombreVia, numero } = req.body;

  const BASE = 'https://ovc.catastro.meh.es/ovcservweb/OVCSWLocalizacionRC';

  let url = '';
  if (mode === 'rc' && rc) {
    url = `${BASE}/ovccallejero.asmx/Consulta_DNPRC?RefCat=${encodeURIComponent(rc.trim())}`;
  } else if (mode === 'address') {
    url = `${BASE}/ovccallejero.asmx/Consulta_DNPLOC?Provincia=${encodeURIComponent(provincia)}&Municipio=${encodeURIComponent(municipio)}&SiglaVia=${encodeURIComponent(tipoVia)}&NombreVia=${encodeURIComponent(nombreVia)}&Numero=${encodeURIComponent(numero)}&Bloque=&Escalera=&Piso=&Puerta=`;
  } else {
    return res.status(400).json({ error: 'Parámetros incorrectos' });
  }

  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'text/xml, application/xml' }
    });
    const text = await response.text();

    // Parse XML básico
    const get = (tag, xml) => {
      const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)<\/${tag}>`, 'i'));
      return match ? match[1].trim() : '';
    };

    const ok = !text.includes('<lerr>') && !text.includes('No existe') && text.includes('<nm>');

    const data = {
      ok,
      rc: get('rc', text) || get('pc1', text) + get('pc2', text),
      provincia: get('np', text),
      municipio: get('nm', text),
      tipoVia: get('tv', text),
      nombreVia: get('nv', text),
      numero: get('pnp', text),
      cp: get('dp', text),
      uso: get('luso', text),
      superficie: parseFloat(get('sfc', text)) || parseFloat(get('stot', text)) || 0,
      clase: get('cn', text),
      anyoConstruccion: get('ant', text),
      rawSnippet: text.substring(0, 500),
    };

    return res.status(200).json(data);
  } catch (error) {
    console.error('Catastro API error:', error);
    return res.status(200).json({ ok: false, error: error.message });
  }
}
