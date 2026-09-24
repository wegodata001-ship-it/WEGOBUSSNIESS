import assert from "node:assert/strict";
import { allocateByTaskOrder, allocationsTotal } from "@/lib/finance/allocate";
import { money } from "@/lib/finance/money";
import { calculateTaskPrice, DEFAULT_BUSINESS_VAT_RATE, paymentStatusFor, remainingBalance } from "@/lib/finance/vat";

const vat = DEFAULT_BUSINESS_VAT_RATE;
const taskA = calculateTaskPrice(1000, vat);
const taskB = calculateTaskPrice(500, vat);

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
