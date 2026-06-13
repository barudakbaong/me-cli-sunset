import { describe, expect, it } from "vitest";
import { renderLayout } from "./engine";

describe("MyXL templates", () => {
  it("renders login page with OTP form", () => {
    const html = renderLayout("login", new Request("http://localhost/login"), {
      page_title: "Login",
      show_tab_login: true,
      pending_otp: false,
      phone: "",
      tabs: [{ id: "login", icon: "fa-solid fa-key", label: "Login", active: true, href: "?tab=login" }],
    });
    expect(html).toContain("Login pakai OTP");
    expect(html).toContain("/login/request-otp");
  });

  it("renders bookmark page", () => {
    const html = renderLayout("bookmark", new Request("http://localhost/bookmark"), {
      page_title: "Bookmark",
      has_bookmarks: true,
      bookmarks: [{ family_name: "F", variant_name: "V", option_name: "O", order: 1, family_code: "FC", is_enterprise: false }],
    });
    expect(html).toContain("Bookmark");
    expect(html).toContain("/bookmark/remove");
  });

  it("renders circle page with forms", () => {
    const html = renderLayout("circle", new Request("http://localhost/circle"), {
      page_title: "Circle",
      group_json: "{}",
      has_members: false,
      has_spend: false,
      has_bonus: false,
      group_id: "G1",
    });
    expect(html).toContain("/circle/invite");
    expect(html).toContain("/circle/create");
  });

  it("renders register form", () => {
    const html = renderLayout("register", new Request("http://localhost/register"), {
      page_title: "Register",
      has_res: false,
      msisdn: "",
    });
    expect(html).toContain("Register (Dukcapil)");
    expect(html).toContain("/register/puk");
  });

  it("renders family loop form", () => {
    const html = renderLayout("family_loop", new Request("http://localhost/purchase/family-loop"), {
      page_title: "Loop Beli Family",
      family_code: "FAM-123",
    });
    expect(html).toContain("Loop Beli Family");
    expect(html).toContain("/purchase/family-loop/start");
    expect(html).toContain("FAM-123");
  });

  it("renders purchase result with pending job poll", () => {
    const html = renderLayout("purchase_result", new Request("http://localhost/purchase/OPT1"), {
      page_title: "Pembelian",
      title: "Memproses pembelian…",
      job_pending: true,
      job_id: "job-123",
      result_json: "{}",
      result_success: false,
      result_has_qr: false,
      has_qris_img: false,
      has_result_data: false,
      has_result_details: false,
      result_details: [],
    });
    expect(html).toContain("/internal/jobs/purchase/job-123");
    expect(html).toContain("Memproses pembelian");
  });

  it("renders dashboard with active user", () => {
    const html = renderLayout("dashboard", new Request("http://localhost/"), {
      page_title: "Beranda",
      active_user: { number: 6281234567890, subscription_type: "PREPAID" },
      dashboard_stats: [{ label: "Pulsa", value: "Rp 10.000" }],
      active_packages_count: 2,
      has_tier: false,
    });
    expect(html).toContain("6281234567890");
    expect(html).toContain("Paket Aktif");
  });
});