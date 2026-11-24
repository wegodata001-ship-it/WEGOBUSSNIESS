import assert from "node:assert/strict";
import { allocateByTaskOrder, allocationsTotal } from "@/lib/finance/allocate";
import { money } from "@/lib/finance/money";
import {
  calculateProjectBasePrice,
  calculateTaskPrice,
  DEFAULT_BUSINESS_VAT_RATE,
  paymentStatusFor,
  remainingBalance,
  resolveProjectBaseVatMode,
} from "@/lib/finance/vat";

const vat = DEFAULT_BUSINESS_VAT_RATE;
const taskA = calculateTaskPrice(1000, vat);
const taskB = calculateTaskPrice(500, vat);

// Project base VAT modes (rate from settings, not hardcoded in callers).
assert.equal(resolveProjectBaseVatMode(undefined), "EXCLUDING_VAT");
assert.equal(resolveProjectBaseVatMode(null), "EXCLUDING_VAT");
assert.equal(resolveProjectBaseVatMode("INCLUDING_VAT"), "INCLUDING_VAT");

const excluding = calculateProjectBasePrice(5000, vat, "EXCLUDING_VAT");
assert.equal(excluding.priceBeforeVat, 5000);
assert.equal(excluding.vatAmount, money(5000 * vat));
assert.equal(excluding.priceIncludingVat, money(5000 + excluding.vatAmount));
assert.equal(excluding.priceIncludingVat, 5900);

const including = calculateProjectBasePrice(5000, vat, "INCLUDING_VAT");
assert.equal(including.priceIncludingVat, 5000);
assert.equal(including.priceBeforeVat, money(5000 / (1 + vat)));
assert.equal(including.vatAmount, money(5000 - including.priceBeforeVat));
assert.equal(money(including.priceBeforeVat + including.vatAmount), 5000);

// Switching mode with same entered digits changes totals as expected.
const switchedToExcluding = calculateProjectBasePrice(5000, vat, "EXCLUDING_VAT");
const switchedToIncluding = calculateProjectBasePrice(5000, vat, "INCLUDING_VAT");
assert.notEqual(switchedToExcluding.priceIncludingVat, switchedToIncluding.priceIncludingVat);
assert.equal(switchedToExcluding.priceIncludingVat, 5900);
assert.equal(switchedToIncluding.priceIncludingVat, 5000);

// Custom business rate (not frozen 18%).
const rate17 = calculateProjectBasePrice(1000, 0.17, "EXCLUDING_VAT");
assert.equal(rate17.vatRate, 0.17);
assert.equal(rate17.priceIncludingVat, money(1000 + 170));


assert.equal(taskA.priceBeforeVat, 1000);
assert.equal(taskA.vatAmount, money(1000 * vat));
assert.equal(taskA.priceIncludingVat, money(1000 + taskA.vatAmount));
assert.equal(taskB.priceBeforeVat, 500);
assert.equal(taskB.vatAmount, money(500 * vat));
assert.equal(taskB.priceIncludingVat, money(500 + taskB.vatAmount));

const subtotal = money(taskA.priceBeforeVat + taskB.priceBeforeVat);
const vatTotal = money(taskA.vatAmount + taskB.vatAmount);
const total = money(taskA.priceIncludingVat + taskB.priceIncludingVat);
assert.equal(subtotal, 1500);
assert.equal(total, money(subtotal + vatTotal));

const first = allocateByTaskOrder([
  { id: "A", balanceDue: taskA.priceIncludingVat },
  { id: "B", balanceDue: taskB.priceIncludingVat },
], 1000);
assert.equal(allocationsTotal(first.allocations), 1000);
assert.equal(first.allocations[0]?.amount, 1000);
assert.equal(first.allocations[1]?.amount, 0);
assert.equal(paymentStatusFor(1000, taskA.priceIncludingVat), "PARTIALLY_PAID");
assert.equal(remainingBalance(taskA.priceIncludingVat, 1000), money(taskA.priceIncludingVat - 1000));

const rest = remainingBalance(taskA.priceIncludingVat, 1000)! + taskB.priceIncludingVat;
const second = allocateByTaskOrder([
  { id: "A", balanceDue: remainingBalance(taskA.priceIncludingVat, 1000)! },
  { id: "B", balanceDue: taskB.priceIncludingVat },
], rest);
assert.equal(second.leftover, 0);
assert.equal(paymentStatusFor(taskA.priceIncludingVat, taskA.priceIncludingVat), "PAID");
assert.equal(remainingBalance(taskA.priceIncludingVat, taskA.priceIncludingVat), 0);
assert.equal(paymentStatusFor(0, taskA.priceIncludingVat), "UNPAID");
assert.equal(paymentStatusFor(0, null), null);

console.log("PAYMENTS_TEST_PASS");
