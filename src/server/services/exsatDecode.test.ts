import assert from 'node:assert/strict';
import { parseExsatProductsHtml } from './catalog';
import { decodeExsatBody } from './exsatFetch';

// O site da EXSAT responde em ISO-8859-1: o servidor precisa respeitar o charset, senao "Camera" vira "C?mera".
const html = `<html><head><title>C\u00e2meras IP</title></head><body><h1>C\u00e2meras IP</h1>
<script>dataLayer.push({'ecommerce': {'detail': {'products': [{
  "id": "4570042", "name": "C\u00e2mera CFTV Dome VIPC 1230 D G2", "brand": "Intelbras", "category": "C\u00e2meras IP",
  "variant": "", "list_position": "1140", "quantity": "204", "price": "225.65"
}]}}});</script></body></html>`;
const latin1 = Buffer.from(html, 'latin1');

const wrong = latin1.toString('utf8');
assert.ok(wrong.includes('\ufffd'), 'sanity: UTF-8 estraga o texto ISO-8859-1');

for (const contentType of ['text/html; charset=ISO-8859-1', 'text/html; charset="iso-8859-1"', 'text/html;charset=windows-1252']) {
  const decoded = decodeExsatBody(contentType, latin1);
  assert.ok(!decoded.includes('\ufffd'), contentType);
  const [item] = parseExsatProductsHtml(decoded);
  assert.equal(item.description, 'C\u00e2mera CFTV Dome VIPC 1230 D G2');
  assert.equal(item.category, 'C\u00e2meras IP');
  assert.equal(item.currentCost, 225.65);
}

// Sem cabecalho, o meta charset decide; sem nada, UTF-8.
assert.equal(decodeExsatBody(null, Buffer.from('<meta charset="iso-8859-1">C\u00e2mera', 'latin1')).includes('C\u00e2mera'), true);
assert.equal(decodeExsatBody('text/html; charset=utf-8', Buffer.from('C\u00e2mera', 'utf8')), 'C\u00e2mera');
assert.equal(decodeExsatBody(null, Buffer.from('C\u00e2mera', 'utf8')), 'C\u00e2mera');
assert.equal(decodeExsatBody('text/html; charset=charset-que-nao-existe', Buffer.from('C\u00e2mera', 'utf8')), 'C\u00e2mera');
