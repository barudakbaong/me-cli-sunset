import type { Env } from "../env";
import { wibTodayAtUnix } from "../clients/time";
import { getUser } from "../auth/users";
import { getAccountForMsisdn, listAccounts } from "../myxl/accounts";
import { createMyXlClients } from "../myxl/clients";
import { GLOBAL_MONITOR_DAILY_SUMMARY } from "../storage/keys";
import type { StorageBackend } from "../storage/types";
import { getTextBlob } from "../myxl/blob";
import { humanizeBytes } from "../ssr/filters";
import { logLine } from "./log";
import { loadQuotaCache, updateAccountCache } from "./quota-cache";
import { resolveSendConfig, sendTelegram } from "./telegram-send";
import type { TelegramConfig } from "../telegram/config";

type SummaryState = Record<string, number>;

async function loadSummaryState(storage: StorageBackend): Promise<SummaryState> {
  const raw = await getTextBlob(storage, null, GLOBAL_MONITOR_DAILY_SUMMARY);
  if (!raw) return {};
  try {
    const data = JSON.parse(raw) as SummaryState;
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

async function saveSummaryState(storage: StorageBackend, state: SummaryState): Promise<void> {
  await storage.putBlob(null, GLOBAL_MONITOR_DAILY_SUMMARY, JSON.stringify(state));
}

function todayTargetTs(cfg: TelegramConfig, now = new Date()): number {
  return wibTodayAtUnix(cfg.daily_summary_hour, cfg.daily_summary_minute, now);
}

export async function maybeSendDailySummary(
  env: Env,
  storage: StorageBackend,
  username: string,
  tgCfg: TelegramConfig,
): Promise<void> {
  if (!tgCfg.daily_summary_enabled || !tgCfg.bot_token) return;

  const user = await getUser(storage, username);
  if (!user?.telegram_chat_id) return;

  const nowSec = Math.floor(Date.now() / 1000);
  const targetTs = todayTargetTs(tgCfg);
  if (nowSec < targetTs) return;

  const state = await loadSummaryState(storage);
  const last = state[username] ?? 0;
  if (last >= targetTs) return;

  // Fetch fresh quota data from MyXL API before sending summary
  let clients;
  try {
    clients = createMyXlClients(env, storage, username);
    const accounts = await listAccounts(storage, username);
    for (const acc of accounts) {
      const msisdn = acc.number;
      if (!msisdn) continue;
      try {
        const user = await getAccountForMsisdn(storage, username, msisdn, clients);
        if (!user) continue;
        const balance = await clients.engsel.getBalance(user.tokens.id_token);
        const data = await clients.engsel.getQuotaDetails(user.tokens.id_token);
        const quotas = ((data?.quotas as Record<string, unknown>[]) ?? []) as Record<string, unknown>[];
        await updateAccountCache(storage, username, msisdn, balance, quotas);
      } catch (e) {
        await logLine(storage, username, `[daily-summary] fetch ${msisdn} err: ${e}`);
      }
    }
  } catch (e) {
    await logLine(storage, username, `[daily-summary] client init err: ${e}`);
  }

  const cache = await loadQuotaCache(storage, username);
  if (!Object.keys(cache).length) return;

  const lines = ["<b>📊 Daily Quota Summary</b>\n"];
  for (const [msisdn, data] of Object.entries(cache)) {
    const bal = data.balance ?? {};
    const remaining = bal.remaining;
    const balStr =
      remaining != null
        ? `Rp ${Number(remaining).toLocaleString("id-ID")}`
        : "-";
    lines.push(`📱 <code>${msisdn}</code> · Pulsa: ${balStr}`);

    const quotas = data.quotas ?? [];
    for (const q of quotas.slice(0, 8)) {
      const name = String(q.name ?? "-");
      const benefits = (q.benefits as Record<string, unknown>[]) ?? [];
      const parts: string[] = [];
      for (const b of benefits.slice(0, 3)) {
        const rem = Number(b.remaining ?? 0);
        const tot = Number(b.total ?? 0);
        const pct = tot ? (rem / tot) * 100 : 0;
        const dt = String(b.data_type ?? "");
        if (dt === "DATA") parts.push(`${humanizeBytes(rem)} (${pct.toFixed(0)}%)`);
        else if (dt === "VOICE") parts.push(`${Math.round(rem / 60)}m (${pct.toFixed(0)}%)`);
        else parts.push(`${rem} (${pct.toFixed(0)}%)`);
      }
      lines.push(`  📦 ${name}: ${parts.length ? parts.join(", ") : "-"}`);
    }
    lines.push("");
  }

  const cfg = await resolveSendConfig(env, storage, username);
  const sendCfg = { bot_token: cfg.bot_token, chat_id: String(user.telegram_chat_id) };
  await sendTelegram(env, storage, lines.join("\n"), { cfg: sendCfg });
  state[username] = nowSec;
  await saveSummaryState(storage, state);
  await logLine(storage, username, `[${username}] daily summary sent to ${user.telegram_chat_id}`);
}