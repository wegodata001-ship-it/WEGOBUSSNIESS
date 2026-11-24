import assert from "node:assert/strict";
import { money } from "@/lib/finance/money";
import { calculateTaskPrice, DEFAULT_BUSINESS_VAT_RATE } from "@/lib/finance/vat";
import {
  computeProjectFinance,
  isBillableFinanceTask,
  resolveTaskBillingMode,
  sumProjectRecordedPayments,
} from "@/lib/finance/project-ledger";
import type { PaymentRecord } from "@/types/payment";

const vat = DEFAULT_BUSINESS_VAT_RATE;
const extra = calculateTaskPrice(200, vat);

// Fixed project only.
const fixedOnly = computeProjectFinance(
  { basePriceIncludingVat: 1180, basePaidAmount: 0 },
  [{ id: "t1", billingMode: "INCLUDED", priceIncludingVat: null, paidAmount: 0 }],
);
assert.equal(fixedOnly.basePrice, 1180);
assert.equal(fixedOnly.extrasTotal, 0);
assert.equal(fixedOnly.totalDue, 1180);
assert.equal(fixedOnly.includedTaskCount, 1);

// Billable tasks only (no project base).
const tasksOnly = computeProjectFinance(
  { basePriceIncludingVat: null, basePaidAmount: 0 },
  [{ id: "t2", billingMode: "BILLABLE", priceIncludingVat: extra.priceIncludingVat, paidAmount: 50 }],
);
assert.equal(tasksOnly.basePrice, 0);
assert.equal(tasksOnly.extrasTotal, extra.priceIncludingVat);
assert.equal(tasksOnly.paid, 50);
assert.equal(tasksOnly.balanceDue, money(extra.priceIncludingVat - 50));

// Combined: base + extras; included tasks ignored even if somehow priced.
const combined = computeProjectFinance(
  { basePriceIncludingVat: 1000, basePaidAmount: 400 },
  [
    { id: "free", billingMode: "INCLUDED", priceIncludingVat: 9999, paidAmount: 0 },
    { id: "paid", billingMode: "BILLABLE", priceIncludingVat: 200, paidAmount: 100 },
  ],
);
assert.equal(combined.extrasTotal, 200);
assert.equal(combined.totalDue, 1200);
assert.equal(combined.paid, 500);
assert.equal(combined.balanceDue, 700);
assert.ok(!combined.billableTaskIds.includes("free"));

// Credit when overpaid.
const credit = computeProjectFinance(
  { basePriceIncludingVat: 100, basePaidAmount: 150 },
  [],
);
assert.equal(credit.credit, 50);
assert.equal(credit.balanceDue, 0);
assert.equal(credit.paymentStatus, "CREDIT");

assert.equal(resolveTaskBillingMode({ billingMode: "INCLUDED", priceIncludingVat: null }), "INCLUDED");
assert.equal(resolveTaskBillingMode({ billingMode: "INCLUDED", priceIncludingVat: 10 }), "INCLUDED");
assert.equal(isBillableFinanceTask({ billingMode: "INCLUDED", priceIncludingVat: 10 }), false);
assert.equal(isBillableFinanceTask({ billingMode: "BILLABLE", priceIncludingVat: 10 }), true);
// Legacy priced task without mode.
assert.equal(resolveTaskBillingMode({ billingMode: "INCLUDED", priceIncludingVat: null }), "INCLUDED");
assert.equal(resolveTaskBillingMode({ billingMode: undefined as never, priceIncludingVat: 10 }), "BILLABLE");

const payments: PaymentRecord[] = [
  {
    id: "p1",
    businessId: "b",
    amount: 300,
    paymentDate: "2026-11-01",
    paymentMethod: "CASH",
    reference: "",
    notes: "",
    status: "RECORDED",
    projectId: "proj",
    allocations: [{ paymentId: "p1", target: "PROJECT_BASE", taskId: null, projectId: "proj", amount: 300 }],
    createdByUserId: "u",
    createdByEmployeeId: null,
    createdAt: null,
    cancelledByUserId: null,
    cancelledAt: null,
    cancelReason: null,
  },
  {
    id: "p2",
    businessId: "b",
    amount: 100,
    paymentDate: "2026-11-02",
    paymentMethod: "BIT",
    reference: "",
    notes: "",
    status: "VOIDED",
    projectId: "proj",
    allocations: [{ paymentId: "p2", target: "TASK", taskId: "paid", projectId: "proj", amount: 100 }],
    createdByUserId: "u",
    createdByEmployeeId: null,
    createdAt: null,
    cancelledByUserId: "u",
    cancelledAt: null,
    cancelReason: "x",
  },
];
assert.equal(sumProjectRecordedPayments(payments, "proj", new Set(["paid"])), 300);

console.log("project-ledger.test.ts: OK");
