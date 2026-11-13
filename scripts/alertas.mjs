// Alertas SMN para El Trébol -> docs/alertas.json (sin dependencias, Node 20+)
import { writeFileSync, mkdirSync } from 'node:fs';

const LAT = -32.2, LON = -61.7;
const FEED_URL = 'https://ssl.smn.gob.ar/CAP/AR.php';
const UA = 'AlertaWebBlogger/1.0';
const MAX_DOCS = 40;

const tag = (xml, n) => {
  const m = xml.match(new RegExp('<(?:\\w+:)?' + n + '[^>]*>([\\s\\S]*?)</(?:\\w+:)?' + n + '>'));
  return m ? decodificar(m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim()) : '';
};
const decodificar = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

export function parsePoligono(t) {
  return t.trim().split(/\s+/).map(p => p.split(',').map(parseFloat)).filter(p => p.length === 2 && !isNaN(p[0]) && !isNaN(p[1]));
}
export function puntoEnPoligono(lat, lon, poly) {
  let dentro = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [yi, xi] = poly[i], [yj, xj] = poly[j];
    if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}
export function nivelDesde(texto, sev) {
  const t = (texto || '').toUpperCase();
  if (t.includes('ROJ')) return 'rojo';
  if (t.includes('NARANJ')) return 'naranja';
  if (t.includes('AMARILL')) return 'amarillo';
  if (sev === 'Extreme') return 'rojo';
  if (sev === 'Severe') return 'naranja';
  if (sev === 'Moderate') return 'amarillo';
  return 'advertencia';
}
export function resumirCap(xml) {
  const infos = [...xml.matchAll(/<(?:\w+:)?info[ >][\s\S]*?<\/(?:\w+:)?info>/g)].map(m => {
    const b = m[0];
    const polygons = [...b.matchAll(/<(?:\w+:)?polygon[^>]*>([\s\S]*?)<\/(?:\w+:)?polygon>/g)].map(p => parsePoligono(p[1]));
    return { event: tag(b, 'event'), severity: tag(b, 'severity'), headline: tag(b, 'headline'),
      description: tag(b, 'description'), instruction: tag(b, 'instruction'),
      effective: tag(b, 'effective'), onset: tag(b, 'onset'), expires: tag(b, 'expires'), polygons };
  });
  return { msgType: tag(xml.replace(/<(?:\w+:)?info[ >][\s\S]*<\/(?:\w+:)?info>/g, ''), 'msgType'), sent: tag(xml.replace(/<(?:\w+:)?info[ >][\s\S]*<\/(?:\w+:)?info>/g, ''), 'sent'), infos };
}
export function filtrar(resumenes, ahora = new Date()) {
  let out = [];
  for (const r of resumenes) {
    if (r.msgType === 'Cancel') continue;
    for (const i of r.infos) {
      if (i.expires && new Date(i.expires) < ahora) continue;
      if (!i.polygons.some(p => puntoEnPoligono(LAT, LON, p))) continue;
      out.push({ nivel: nivelDesde(i.event + ' ' + i.headline, i.severity), evento: i.event,
        titulo: i.headline || i.event, descripcion: i.description, instruccion: i.instruction,
        desde: i.onset || i.effective, hasta: i.expires, enviado: r.sent });
    }
  }
  out.sort((a, b) => new Date(b.enviado) - new Date(a.enviado));
  const vistos = new Set();
  out = out.filter(a => { const k = a.evento + '|' + a.nivel; if (vistos.has(k)) return false; vistos.add(k); return true; });
  const orden = { rojo: 0, naranja: 1, amarillo: 2, advertencia: 3 };
  return out.sort((a, b) => orden[a.nivel] - orden[b.nivel]);
}

async function get(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error('HTTP ' + r.status + ' en ' + url);
  return r.text();
}

async function main() {
  let salida;
  try {
    const rss = await get(FEED_URL);
    if (!rss.includes('<')) throw new Error('El feed no devolvió XML');
    const urls = [...new Set(rss.match(/https?:\/\/[^\s<>"']+\.xml/g) || [])]
      .sort((a, b) => ((b.match(/CAP_(\d{14})/) || [0, '0'])[1]).localeCompare((a.match(/CAP_(\d{14})/) || [0, '0'])[1]))
      .slice(0, MAX_DOCS);
    const resumenes = [];
    for (const u of urls) { try { resumenes.push(resumirCap(await get(u))); } catch (e) { console.warn('Aviso ilegible:', e.message); } }
    salida = { ok: true, actualizado: new Date().toISOString(), alertas: filtrar(resumenes) };
  } catch (e) {
    // ok:false = "no pudimos verificar", NO "no hay alertas"
    console.error(e);
    salida = { ok: false, error: String(e), actualizado: new Date().toISOString(), alertas: [] };
  }
  mkdirSync('docs', { recursive: true });
  writeFileSync('docs/alertas.json', JSON.stringify(salida, null, 2));
  console.log(JSON.stringify(salida).slice(0, 500));
}
if (process.argv[1] && process.argv[1].endsWith('alertas.mjs')) main();
