import { describe, expect, it } from "vitest";
import { buildPaymentItem, formatPurchaseResult } from "./purchase";

describe("purchase helpers", () => {
  it("buildPaymentItem maps package detail", () => {
    const item = buildPaymentItem({
      token_confirmation: "abc",
      package_option: {
        package_option_code: "OPT1",
        price: 15000,
        name: "Paket 1GB",
      },
    });
    expect(item.item_code).toBe("OPT1");
    expect(item.item_price).toBe(15000);
    expect(item.token_confirmation).toBe("abc");
  });

  it("formatPurchaseResult flags success and QR", () => {
    const ctx = formatPurchaseResult("QRIS", { status: "SUCCESS", qr_code: "QR-DATA" }, "QR-DATA");
    expect(ctx.result_success).toBe(true);
    expect(ctx.has_qris_img).toBe(true);
    expect(ctx.qris_img).toContain("QR-DATA");
  });

  it("formatPurchaseResult supports pending job", () => {
    const ctx = formatPurchaseResult("Wait", { status: "PENDING" }, null, { jobPending: true, jobId: "j1" });
    expect(ctx.job_pending).toBe(true);
    expect(ctx.job_id).toBe("j1");
  });
});