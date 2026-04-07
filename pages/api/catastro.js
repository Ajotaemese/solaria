// pages/api/catastro.js v2
// Proxy completo — extrae TODOS los campos del Catastro incluyendo coordenadas GPS

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { mode, rc, provincia, municipio, tipoVia, nombreVia, numero } = req.body;
  const BASE = 'https://ovc.catastro.meh.es/ovcservweb/OVCSWLocalizacionRC';

  const get = (tag, xml) => {
    const m = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)<\/${tag}>`, 'i'));
    return m ? m[1].trim() : '';
  };
  const getAll = (tag, xml) => {
    const results = [];
    const re = new RegExp(`<${tag}[^>]*>([^<]*)<\/${tag}>`, 'gi');
    let m;
    while ((m = re.exec(xml)) !== null) if (m[1].trim()) results.push(m[1].trim());
    return results;
  };

  let urlDatos = '';
  let urlCoords = '';
  const rcClean = (rc || '').trim().replace(/\s/g, '');

  if (mode === 'rc' && rcClean) {
    urlDatos = `${BASE}/ovccallejero.asmx/Consulta_DNPRC?RefCat=${encodeURIComponent(rcClean)}`;
    urlCoords = `${BASE}/ovccoordenadas.asmx/Consulta_CPMRC?Provincia=&Municipio=&SRS=EPSG:4326&RC=${encodeURIComponent(rcClean)}`;
  } else if (mode === 'address' && provincia && municipio && nombreVia && numero) {
    urlDatos = `${BASE}/ovccallejero.asmx/Consulta_DNPLOC?Provincia=${encodeURIComponent(provincia)}&Municipio=${encodeURIComponent(municipio)}&SiglaVia=${encodeURIComponent(tipoVia || 'CL')}&NombreVia=${encodeURIComponent(nombreVia)}&Numero=${encodeURIComponent(numero)}&Bloque=&Escalera=&Piso=&Puerta=`;
  } else {
    return res.status(400).json({ ok: false, error: 'Parámetros insuficientes' });
  }

  try {
    const fetches = [fetch(urlDatos, { headers: { Accept: 'text/xml' } })];
    if (urlCoords) fetches.push(fetch(urlCoords, { headers: { Accept: 'text/xml' } }));

    const results = await Promise.allSettled(fetches);
    const xmlDatos = results[0].status === 'fulfilled' ? await results[0].value.text() : '';
    const xmlCoords = results[1]?.status === 'fulfilled' ? await results[1].value.text() : '';

    const ok = xmlDatos.includes('<nm>') && !xmlDatos.includes('<lerr>') && !xmlDatos.includes('No existe');

    // Campos principales del inmueble
    const rcFinal = get('rc', xmlDatos) || (get('pc1', xmlDatos) + get('pc2', xmlDatos));
    const municipioVal = get('nm', xmlDatos);
    const provinciaVal = get('np', xmlDatos);
    const cp = get('dp', xmlDatos);
    const tvVal = get('tv', xmlDatos);
    const nvVal = get('nv', xmlDatos);
    const numVal = get('pnp', xmlDatos);
    const uso = get('luso', xmlDatos);
    const usosMultiples = getAll('luso', xmlDatos);
    const cn = get('cn', xmlDatos); // U=urbana R=rústica
    const sfc = parseFloat(get('sfc', xmlDatos)) || 0;  // superficie finca
    const stot = parseFloat(get('stot', xmlDatos)) || 0; // superficie construida total
    const ant = get('ant', xmlDatos); // año construcción
    const dcc = get('dcc', xmlDatos); // destino catastral
    const bi = get('luso', xmlDatos); // bien inmueble uso

    // Coordenadas
    let lat = null, lng = null;
    if (xmlCoords) {
      const xcen = get('xcen', xmlCoords) || get('xce', xmlCoords);
      const ycen = get('ycen', xmlCoords) || get('yce', xmlCoords);
      if (xcen && ycen) { lat = parseFloat(ycen) || null; lng = parseFloat(xcen) || null; }
    }

    const superficie = sfc || stot || 0;
    const esUrbanoConstruido = cn === 'U' && stot > 0;
    const esSolar = cn === 'U' && stot === 0;
    const esRustico = cn === 'R';

    return res.status(200).json({
      ok,
      rc: rcFinal,
      provincia: provinciaVal || provincia || '',
      municipio: municipioVal || municipio || '',
      cp,
      tipoVia: tvVal,
      nombreVia: nvVal,
      numero: numVal,
      direccion: [tvVal, nvVal, numVal].filter(Boolean).join(' '),
      uso,
      usosMultiples,
      destinoEdif: dcc,
      clase: cn,
      esUrbanoConstruido,
      esSolar,
      esRustico,
      superficie,
      superficiePlot: sfc,
      superficieCons: stot,
      anyoConstruccion: ant,
      lat,
      lng,
      tieneCoords: lat !== null,
    });

  } catch (error) {
    console.error('Catastro error:', error);
    return res.status(200).json({ ok: false, error: error.message });
  }
}
