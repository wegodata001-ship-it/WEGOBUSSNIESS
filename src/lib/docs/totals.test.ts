import assert from "node:assert/strict";
import { calculateDocumentTotals, lineAmount } from "@/lib/docs/totals";

assert.equal(lineAmount({ qty: 2, unitPrice: 1500, priceMode: "UNIT" }), 3000);
assert.equal(lineAmount({ qty: 2, unitPrice: 1500, priceMode: "INCLUDED" }), 0);
assert.equal(lineAmount({ qty: 2, unitPrice: 1500, priceMode: "NONE" }), 0);

const plusVat = calculateDocumentTotals({
  lines: [{ qty: 1, unitPrice: 1000, priceMode: "UNIT" }],
  discount: 0,
  discountType: "AMOUNT",
  vatRate: 0.18,
  vatInclusive: false,
});
assert.equal(plusVat.beforeVat, 1000);
assert.equal(plusVat.vat, 180);
assert.equal(plusVat.total, 1180);

const inclusive = calculateDocumentTotals({
  lines: [{ qty: 1, unitPrice: 1180, priceMode: "UNIT" }],
  discount: 0,
  discountType: "AMOUNT",
  vatRate: 0.18,
  vatInclusive: true,
});
assert.equal(inclusive.total, 1180);
assert.equal(inclusive.beforeVat, 1000);
assert.equal(inclusive.vat, 180);

const discounted = calculateDocumentTotals({
  lines: [{ qty: 1, unitPrice: 2000, priceMode: "UNIT" }],
  discount: 10,
  discountType: "PERCENT",
  vatRate: 0.18,
  vatInclusive: false,
});
assert.equal(discounted.discount, 200);
assert.equal(discounted.beforeVat, 1800);
assert.equal(discounted.total, 2124);

console.log("DOCUMENT_TOTALS_PASS");
