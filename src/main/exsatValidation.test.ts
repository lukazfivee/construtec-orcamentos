import assert from 'node:assert/strict';
import { parseExsatIndividualProduct, parseIndividualProductPrice } from './exsatFetcher';

// 1. Currency normalization
assert.equal(parseIndividualProductPrice('1550,53'), 1550.53);
assert.equal(parseIndividualProductPrice('1.550,53'), 1550.53);
assert.equal(parseIndividualProductPrice('1.500'), 1500);
assert.equal(parseIndividualProductPrice('1.500,00'), 1500);
assert.equal(parseIndividualProductPrice('1.500.000'), 1500000);
assert.equal(parseIndividualProductPrice('1500'), 1500);
assert.equal(parseIndividualProductPrice('R$ 299,99'), 299.99);
assert.equal(parseIndividualProductPrice('R$ 576,16'), 576.16);
assert.equal(parseIndividualProductPrice(''), 0);
assert.equal(parseIndividualProductPrice(undefined), 0);

// 2. Confirmed item (price matches)
const confirmedHtml = `
  <div class="product-card">
    <div class="product-sku">4570042</div>
    <span class="titprodutoscar"><a href="/produtos/detalhes/4570042/camera-tv-ip-dome-vipc-1230-d-g2/" class="product-title">Câmera CFTV Dome VIPC 1230 D G2</a></span>
    <div class="product-pricing">
      <div class="price-current">R$ 225,65</div>
      <div class="price-installment">10x de R$ 25,00</div>
    </div>
  </div>
`;
const confirmedResult = parseExsatIndividualProduct(confirmedHtml, '4570042', 225.65);
assert.equal(confirmedResult.status, 'confirmed');
assert.equal(confirmedResult.currentCost, 225.65);

// 3. Divergent item (price differs, e.g. 299.99 -> 576.16)
const divergentHtml = `
  <div class="product-card">
    <div class="product-sku">4564068</div>
    <span class="titprodutoscar"><a href="/produtos/detalhes/4564068/camera-bullet/" class="product-title">Câmera Bullet</a></span>
    <div class="product-pricing">
      <div class="price-current">R$ 576,16</div>
      <div class="price-installment">10x de R$ 64,00</div>
    </div>
  </div>
`;
const divergentResult = parseExsatIndividualProduct(divergentHtml, '4564068', 299.99);
assert.equal(divergentResult.status, 'divergent');
assert.equal(divergentResult.currentCost, 576.16);

// 4. Unavailable item (stock out / indisponível)
const unavailableHtml = `
  <div class="product-card">
    <div class="product-sku">4750220</div>
    <span class="titprodutoscar"><a href="/produtos/detalhes/4750220/sensor/" class="product-title">Sensor</a></span>
    <div class="product-pricing">
      <span class="stock-status">Produto Indisponível</span>
      <div class="price-current">R$ 0,00</div>
    </div>
  </div>
`;
const unavailableResult = parseExsatIndividualProduct(unavailableHtml, '4750220', 229.90);
assert.equal(unavailableResult.status, 'unavailable');
assert.equal(unavailableResult.currentCost, 0);

// 5. Code not found in search results
const notFoundHtml = `
  <div class="row">
    <h1>Nenhum produto encontrado</h1>
  </div>
`;
const notFoundResult = parseExsatIndividualProduct(notFoundHtml, '99999999', 100);
assert.equal(notFoundResult.status, 'unavailable');
assert.equal(notFoundResult.currentCost, 0);

// 6. Multiple cards in search: exact SKU matching
const multiCardsHtml = `
  <div class="product-card">
    <div class="product-sku">00060</div>
    <div class="product-pricing"><div class="price-current">R$ 9,90</div></div>
  </div>
  <div class="product-card">
    <div class="product-sku">0006</div>
    <div class="product-pricing"><div class="price-current">R$ 0,93</div></div>
  </div>
`;
const exactSkuResult = parseExsatIndividualProduct(multiCardsHtml, '0006', 0.93);
assert.equal(exactSkuResult.status, 'confirmed');
// 7. Promotional fallback: strike-through old price should be ignored
const promoHtml = `
  <div class="product-card">
    <div class="product-sku">PROMO123</div>
    <div class="product-pricing">
      <del class="price-old">R$ 350,00</del>
      <span class="price-cash">R$ 280,00</span>
    </div>
  </div>
`;
const promoResult = parseExsatIndividualProduct(promoHtml, 'PROMO123', 280.00);
assert.equal(promoResult.status, 'confirmed');
assert.equal(promoResult.currentCost, 280.00);

console.log('Todos os testes de validação individual Exsat passaram com sucesso!');
