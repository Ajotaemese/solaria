// pages/api/claude.js
// Servidor que llama a Claude — la API Key nunca sale al navegador

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEMS = {
  urbanismo: `Eres un experto urbanista español con amplio conocimiento de la normativa urbanística de todos los municipios de España y del PGOU vigente.
Recibirás datos reales de Catastro de un inmueble/solar español y deberás interpretar los parámetros urbanísticos aplicables.
Devuelve EXCLUSIVAMENTE un objeto JSON con estos campos (sin texto adicional, solo el JSON):
{
  "claseUrbanistica": "urbano_consolidado"|"urbano_no_consolidado"|"urbanizable"|"no_urbanizable",
  "calificacion": string,
  "buildability": number,
  "occupation": number,
  "floors": number,
  "basements": number,
  "setbackFront": number,
  "setbackRear": number,
  "setbackSide": number,
  "usosPosibles": array de strings,
  "alturaMaxima": number,
  "confianza": "alta"|"media"|"baja",
  "notas": string,
  "condicionantes": array de strings
}`,

  mercado: `Eres un experto en el mercado inmobiliario español con datos de precios actualizados hasta 2025.
Devuelve EXCLUSIVAMENTE un objeto JSON:
{
  "salePriceM2": number,
  "salePriceCommercialM2": number,
  "rentPriceM2Month": number,
  "rentCommercialM2Month": number,
  "constructionPEM": number,
  "exitYield": number,
  "demanda": "alta"|"media"|"baja",
  "tendencia": "alcista"|"estable"|"bajista",
  "comentario": string,
  "fuentesReferencia": string
}`,

  opciones: `Eres un consultor senior de real estate español especializado en estudios de viabilidad de promociones inmobiliarias.
Propón las 3 mejores estrategias de negocio para este solar.
Devuelve EXCLUSIVAMENTE un JSON:
{
  "opciones": [
    {
      "id": string,
      "nombre": string,
      "descripcion": string,
      "puntuacion": number,
      "riesgo": "bajo"|"medio"|"alto",
      "plazo": string,
      "retornoEsperado": string,
      "ventajas": array de strings,
      "inconvenientes": array de strings,
      "useMultiplierKey": "residencial_libre"|"residencial_alquiler"|"coliving"|"residencia_estudiantes"|"apartahotel"|"hotel"|"oficinas"
    }
  ],
  "recomendacion": string,
  "alertas": array de strings
}`,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { type, message } = req.body;
  const system = SYSTEMS[type];

  if (!system) {
    return res.status(400).json({ error: 'Tipo de análisis no válido' });
  }

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system,
      messages: [{ role: 'user', content: message }],
    });

    const text = response.content.map(b => b.text || '').join('');
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return res.status(200).json({ error: 'No se pudo parsear la respuesta', raw: text });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return res.status(200).json(parsed);
  } catch (error) {
    console.error('Claude API error:', error);
    return res.status(500).json({ error: error.message });
  }
}
