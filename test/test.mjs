import { resumirCap, filtrar } from '../scripts/alertas.mjs';
const cap = (poly, exp, ev = 'Alerta NARANJA por tormentas', msg = 'Alert') => `<?xml version="1.0"?><alert xmlns="urn:oasis:names:tc:emergency:cap:1.2"><identifier>x</identifier><sent>2026-11-13T18:00:00-03:00</sent><msgType>${msg}</msgType><info><event>${ev}</event><severity>Severe</severity><headline>${ev}</headline><description>Desc &amp; mas</description><instruction>Cuidarse</instruction><effective>2026-11-13T18:00:00-03:00</effective><expires>${exp}</expires><area><polygon>${poly}</polygon></area></info></alert>`;
const dentro = '-31,-63 -31,-60 -33,-60 -33,-63 -31,-63', fuera = '-31,-58 -31,-56 -33,-56 -33,-58';
const ahora = new Date('2026-11-13T20:00:00-03:00');
const r = [cap(dentro, '2026-11-14T06:00:00-03:00'), cap(fuera, '2026-11-14T06:00:00-03:00', 'Otra'), cap(dentro, '2026-11-13T10:00:00-03:00', 'Vencida'), cap(dentro, '2026-11-14T06:00:00-03:00', 'Cancelada', 'Cancel')].map(resumirCap);
const o = filtrar(r, ahora);
console.log(o.length === 1 && o[0].nivel === 'naranja' && o[0].descripcion === 'Desc & mas' ? 'TEST OK' : 'TEST FALLA ' + JSON.stringify(o));
