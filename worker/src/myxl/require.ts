import type { Context } from "hono";
import type { WebuiUserRecord } from "../auth/users";
import { getTheme } from "../auth/users";
import { htmlResponse, renderErrorPage } from "../ssr";
import type { AppEnv } from "../types";
import { getActiveUserSafe, listAccounts, type ActiveUser } from "./accounts";
import { createMyXlClients } from "./clients";
import type { MyXlClients } from "./accounts";
import { renderMyXlPage } from "./render";

export interface ActiveSession {
  webuiUser: WebuiUserRecord;
  activeUser: ActiveUser;
  clients: MyXlClients;
}

export function requireWebuiUser(c: Context<AppEnv>): WebuiUserRecord | Response {
  const webuiUser = c.get("webuiUser");
  if (!webuiUser) return c.redirect(`/u/login?next=${encodeURIComponent(c.req.path)}`, 303);
  return webuiUser;
}

export function renderWebuiPage(
  c: Context<AppEnv>,
  webuiUser: WebuiUserRecord,
  template: string,
  ctx: Record<string, unknown> = {},
): Response {
  return htmlResponse(
    renderMyXlPage(c.req.raw, template, webuiUser, {
      page_title: (ctx.page_title as string) ?? "WebUI-XL",
      user_theme: getTheme(webuiUser),
      webui_user: { username: webuiUser.username },
      ...ctx,
    }),
  );
}

export async function requireActiveSession(c: Context<AppEnv>): Promise<ActiveSession | Response> {
  const webuiUser = c.get("webuiUser");
  if (!webuiUser) return c.redirect("/u/login", 303);

  const storage = c.get("storage");
  let clients: MyXlClients;
  try {
    clients = createMyXlClients(c.env, storage, webuiUser.username);
  } catch (e) {
    const html = renderErrorPage(c.req.raw, {
      title: "Konfigurasi",
      message: `MyXL API belum dikonfigurasi: ${e}`,
    });
    return htmlResponse(html, 500);
  }

  const activeUser = await getActiveUserSafe(storage, webuiUser.username, clients);
  if (!activeUser) {
    const html = renderErrorPage(c.req.raw, {
      title: "Login dulu",
      message: "Belum ada akun aktif.",
    });
    return htmlResponse(html, 401);
  }

  return { webuiUser, activeUser, clients };
}

export async function myxlPageContext(c: Context<AppEnv>, session: ActiveSession) {
  const storage = c.get("storage");
  return {
    active_user: {
      number: session.activeUser.number,
      subscription_type: session.activeUser.subscription_type,
    },
    accounts: await listAccounts(storage, session.webuiUser.username),
  };
}

export function renderActivePage(
  c: Context<AppEnv>,
  session: ActiveSession,
  template: string,
  ctx: Record<string, unknown> = {},
): Response {
  return htmlResponse(
    renderMyXlPage(c.req.raw, template, session.webuiUser, {
      active_user: {
        number: session.activeUser.number,
        subscription_type: session.activeUser.subscription_type,
      },
      ...ctx,
    }),
  );
}