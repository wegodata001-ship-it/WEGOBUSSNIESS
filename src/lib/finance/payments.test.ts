import assert from "node:assert/strict";
import { allocateByTaskOrder, allocationsTotal } from "@/lib/finance/allocate";
import { money } from "@/lib/finance/money";
import {
  calculateEnteredPriceWithVat,
  calculateProjectBasePrice,
  calculateTaskPrice,
  DEFAULT_BUSINESS_VAT_RATE,
  paymentStatusFor,
  remainingBalance,
  resolveProjectBaseVatMode,
} from "@/lib/finance/vat";
import { computeProjectFinance } from "@/lib/finance/project-ledger";

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

// Billable task VAT modes (same entered digits, business rate).
const taskIncl = calculateEnteredPriceWithVat(1000, vat, "INCLUDING_VAT");
assert.equal(taskIncl.priceIncludingVat, 1000);
assert.equal(taskIncl.priceBeforeVat, money(1000 / (1 + vat)));
assert.equal(taskIncl.vatAmount, money(1000 - taskIncl.priceBeforeVat));

const taskExcl = calculateEnteredPriceWithVat(1000, vat, "EXCLUDING_VAT");
assert.equal(taskExcl.priceBeforeVat, 1000);
assert.equal(taskExcl.vatAmount, money(1000 * vat));
assert.equal(taskExcl.priceIncludingVat, 1180);

// Mode switch with same digits must not keep the previous total.
assert.notEqual(taskIncl.priceIncludingVat, taskExcl.priceIncludingVat);

// Partial payment against including-VAT total.
assert.equal(paymentStatusFor(400, taskIncl.priceIncludingVat), "PARTIALLY_PAID");
assert.equal(remainingBalance(taskIncl.priceIncludingVat, 400), 600);

// Legacy missing mode resolves to excluding (previous behavior).
assert.equal(resolveProjectBaseVatMode(undefined), "EXCLUDING_VAT");
const legacyTask = calculateEnteredPriceWithVat(1000, vat, resolveProjectBaseVatMode(undefined));
assert.equal(legacyTask.priceIncludingVat, 1180);

// Project base + billable tasks: totals use including-VAT once (no double VAT).
const projectBase = calculateEnteredPriceWithVat(1000, vat, "INCLUDING_VAT");
const billableTask = calculateEnteredPriceWithVat(1000, vat, "EXCLUDING_VAT");
const ledger = computeProjectFinance(
  {
    basePriceIncludingVat: projectBase.priceIncludingVat,
    basePaidAmount: 0,
  },
  [
    {
      id: "free",
      billingMode: "INCLUDED",
      priceIncludingVat: 9999,
      paidAmount: 0,
    },
    {
      id: "paid-task",
      billingMode: "BILLABLE",
      priceIncludingVat: billableTask.priceIncludingVat,
      paidAmount: 180,
    },
  ],
);
assert.equal(ledger.basePrice, 1000);
assert.equal(ledger.extrasTotal, 1180);
assert.equal(ledger.totalDue, 2180);
assert.equal(ledger.paid, 180);
assert.equal(ledger.balanceDue, 2000);
assert.equal(ledger.includedTaskCount, 1);

// Custom rate for task pricing (settings-driven, not hardcoded 18%).
const taskRate17 = calculateEnteredPriceWithVat(1000, 0.17, "EXCLUDING_VAT");
assert.equal(taskRate17.vatRate, 0.17);
assert.equal(taskRate17.priceIncludingVat, 1170);

console.log("PAYMENTS_TEST_PASS");
