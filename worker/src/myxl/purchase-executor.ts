import {
  EWALLET_FORM_METHODS,
  settlementBalanceWithRetry,
  settlementMultipayment,
  settlementQris,
  getQrisCode,
  type PaymentItem,
  type PurchaseRuntime,
} from "../clients/purchase";
import type { EngselClient } from "../clients/engsel";
import type { StorageBackend } from "../storage/types";
import { makeCustomDecoyItem, makeDecoyItem } from "./decoy";
import { buildPaymentItem } from "./purchase";

export interface PurchaseExecutionResult {
  title: string;
  result: unknown;
  qrisCode?: string | null;
}

export async function executeBalancePurchase(
  rt: PurchaseRuntime,
  items: PaymentItem[],
  paymentFor: string,
  overwriteAmount: number,
  tokenConfirmationIdx = 0,
  amountIdx = -1,
): Promise<PurchaseExecutionResult> {
  const res = await settlementBalanceWithRetry(rt, items, {
    paymentFor,
    askOverwrite: false,
    overwriteAmount,
    tokenConfirmationIdx,
    amountIdx,
  });
  return { title: "Pembelian Pulsa", result: res };
}

export async function executeQrisPurchase(
  rt: PurchaseRuntime,
  items: PaymentItem[],
  paymentFor: string,
  overwriteAmount: number,
  tokenConfirmationIdx = 0,
  amountIdx = -1,
  title = "Bayar via QRIS",
): Promise<PurchaseExecutionResult> {
  const tx = await settlementQris(rt, items, {
    paymentFor,
    askOverwrite: false,
    overwriteAmount,
    tokenConfirmationIdx,
    amountIdx,
  });
  if (!tx || typeof tx !== "string") {
    return { title: "QRIS gagal", result: tx };
  }
  const qrisCode = await getQrisCode(rt, tx);
  return {
    title,
    result: { transaction_id: tx, qr_code: qrisCode },
    qrisCode,
  };
}

export async function executeEwalletPurchase(
  rt: PurchaseRuntime,
  items: PaymentItem[],
  method: string,
  walletNumber: string,
  paymentFor: string,
  overwriteAmount: number,
  tokenConfirmationIdx = 0,
  amountIdx = -1,
  title?: string,
): Promise<PurchaseExecutionResult> {
  const pm = EWALLET_FORM_METHODS[method];
  if (!pm) return { title: "Metode invalid", result: { message: method } };
  const res = await settlementMultipayment(rt, items, walletNumber, pm, {
    paymentFor,
    askOverwrite: false,
    overwriteAmount,
    tokenConfirmationIdx,
    amountIdx,
  });
  return { title: title ?? `Bayar via ${pm}`, result: res };
}

export async function executeDecoyPurchase(
  rt: PurchaseRuntime,
  storage: StorageBackend,
  username: string,
  subscriptionType: string,
  pkg: Record<string, unknown>,
  method: string,
  paymentFor: string,
  qrisAmount: number,
): Promise<PurchaseExecutionResult> {
  const item = buildPaymentItem(pkg);
  const mainName = item.item_name;
  const pkgPaymentFor = String(
    ((pkg.package_family as Record<string, unknown> | undefined)?.payment_for as string) ?? paymentFor,
  );

  if (method === "decoy_balance" || method === "decoy_balance_v2") {
    const decoy = await makeDecoyItem(storage, username, rt.engsel, rt.tokens.id_token, "balance", subscriptionType);
    if ("error" in decoy) return { title: "Decoy gagal", result: { message: decoy.error } };
    const paymentItems = [item, decoy.item];
    const total = item.item_price + decoy.item.item_price;
    const isV2 = method === "decoy_balance_v2";
    const res = await settlementBalanceWithRetry(rt, paymentItems, {
      paymentFor: isV2 ? "" : pkgPaymentFor,
      askOverwrite: false,
      overwriteAmount: total,
      tokenConfirmationIdx: isV2 ? 1 : 0,
    });
    const title = isV2 ? "Pulsa + Decoy V2" : "Pulsa + Decoy";
    return { title, result: res };
  }

  if (method === "decoy_qris" || method === "decoy_qris0") {
    const decoyKind = method === "decoy_qris0" ? "qris0" : "qris";
    const decoy = await makeDecoyItem(storage, username, rt.engsel, rt.tokens.id_token, decoyKind, subscriptionType);
    if ("error" in decoy) return { title: "Decoy gagal", result: { message: decoy.error } };
    const paymentItems = [item, decoy.item];
    const amount = qrisAmount < 0 ? item.item_price + decoy.item.item_price : qrisAmount;
    const out = await executeQrisPurchase(rt, paymentItems, "SHARE_PACKAGE", amount, 1, -1, `QRIS + Decoy (${decoyKind})`);
    if (typeof out.result === "object" && out.result) {
      (out.result as Record<string, unknown>).amount_used = amount;
      (out.result as Record<string, unknown>).main_price = item.item_price;
      (out.result as Record<string, unknown>).decoy_price = decoy.item.item_price;
    }
    return { ...out, title: `${out.title} · ${mainName}` };
  }

  if (method.startsWith("decoy_custom_")) {
    const name = method.slice("decoy_custom_".length);
    const custom = await makeCustomDecoyItem(storage, username, rt.engsel, rt.tokens.id_token, name);
    if ("error" in custom) return { title: "Custom decoy gagal", result: { message: custom.error } };
    const paymentItems = [item, custom.item];
    const total = item.item_price + custom.item.item_price;
    if (custom.base === "balance") {
      const res = await settlementBalanceWithRetry(rt, paymentItems, {
        paymentFor: pkgPaymentFor,
        askOverwrite: false,
        overwriteAmount: total,
        tokenConfirmationIdx: 0,
      });
      return { title: `Pulsa + Decoy (${name})`, result: res };
    }
    const amount = qrisAmount < 0 ? total : qrisAmount;
    const out = await executeQrisPurchase(rt, paymentItems, "SHARE_PACKAGE", amount, 1, -1, `QRIS + Decoy (${name})`);
    return out;
  }

  return { title: "Metode invalid", result: { message: method } };
}

export async function executeOptionPurchase(
  rt: PurchaseRuntime,
  storage: StorageBackend,
  username: string,
  subscriptionType: string,
  engsel: EngselClient,
  optionCode: string,
  method: string,
  paymentFor: string,
  walletNumber: string,
  qrisAmount: number,
): Promise<PurchaseExecutionResult> {
  const pkg = await engsel.getPackage(rt.tokens.id_token, optionCode);
  if (!pkg) {
    return { title: "Tidak ditemukan", result: { message: `Option ${optionCode} tidak ada.` } };
  }
  const item = buildPaymentItem(pkg);

  if (method === "balance") {
    return executeBalancePurchase(rt, [item], paymentFor, item.item_price);
  }
  if (method === "qris") {
    return executeQrisPurchase(rt, [item], paymentFor, item.item_price);
  }
  if (method in EWALLET_FORM_METHODS) {
    return executeEwalletPurchase(rt, [item], method, walletNumber, paymentFor, item.item_price);
  }
  if (method.startsWith("decoy_")) {
    return executeDecoyPurchase(rt, storage, username, subscriptionType, pkg, method, paymentFor, qrisAmount);
  }
  return { title: "Metode invalid", result: { message: `Method '${method}' tidak dikenal.` } };
}