import { Hono, type Context } from "hono";
import {
  COOKIE_NAME,
  SESSION_MAX_AGE,
  makeSessionToken,
} from "../auth/session";
import { authenticate, createUser, getTheme, loadUsers } from "../auth/users";
import { htmlResponse, renderWebuiLogin } from "../ssr";
import type { AppEnv } from "../types";

function safeNext(next: string | undefined): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/";
}

function setSessionCookie(c: { req: { url: string }; header: (name: string, value: string) => void }, token: string) {
  const secure = new URL(c.req.url).protocol === "https:";
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    `Max-Age=${SESSION_MAX_AGE}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (secure) parts.push("Secure");
  c.header("Set-Cookie", parts.join("; "));
}

function clearSessionCookie(c: { header: (name: string, value: string) => void }) {
  c.header("Set-Cookie", `${COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax`);
}

export const webuiAuth = new Hono<AppEnv>();

webuiAuth.get("/u/login", async (c) => {
  const url = new URL(c.req.url);
  const storage = c.get("storage");
  const html = renderWebuiLogin(c.req.raw, {
    mode: "login",
    error: url.searchParams.get("error") ?? undefined,
    info: url.searchParams.get("info") ?? undefined,
    username: url.searchParams.get("username") ?? undefined,
    users_count: (await loadUsers(storage)).length,
    next: safeNext(url.searchParams.get("next") ?? "/"),
    user_theme: getTheme(c.get("webuiUser")),
  });
  return htmlResponse(html);
});

webuiAuth.post("/u/login", async (c) => {
  const body = await c.req.parseBody();
  const username = String(body.username ?? "");
  const password = String(body.password ?? "");
  const next = safeNext(String(body.next ?? "/"));
  const storage = c.get("storage");

  const user = await authenticate(storage, username, password);
  if (!user) {
    const html = renderWebuiLogin(c.req.raw, {
      mode: "login",
      error: "Username atau password salah.",
      username,
      next,
      users_count: (await loadUsers(storage)).length,
      user_theme: getTheme(c.get("webuiUser")),
    });
    return htmlResponse(html, 401);
  }

  const token = await makeSessionToken(user.username, await storage.getSessionSecret());
  const res = c.redirect(next, 303);
  setSessionCookie(c, token);
  return res;
});

webuiAuth.get("/u/register", async (c) => {
  const url = new URL(c.req.url);
  const storage = c.get("storage");
  const html = renderWebuiLogin(c.req.raw, {
    mode: "register",
    error: url.searchParams.get("error") ?? undefined,
    info: url.searchParams.get("info") ?? undefined,
    username: url.searchParams.get("username") ?? undefined,
    users_count: (await loadUsers(storage)).length,
    user_theme: getTheme(c.get("webuiUser")),
  });
  return htmlResponse(html);
});

webuiAuth.post("/u/register", async (c) => {
  const body = await c.req.parseBody();
  const username = String(body.username ?? "");
  const password = String(body.password ?? "");
  const passwordConfirm = String(body.password_confirm ?? "");
  const storage = c.get("storage");

  if (password !== passwordConfirm) {
    const html = renderWebuiLogin(c.req.raw, {
      mode: "register",
      error: "Password tidak cocok.",
      username,
      users_count: (await loadUsers(storage)).length,
      user_theme: getTheme(c.get("webuiUser")),
    });
    return htmlResponse(html, 400);
  }

  const result = await createUser(storage, username, password);
  if (!result.ok) {
    const html = renderWebuiLogin(c.req.raw, {
      mode: "register",
      error: result.error,
      username,
      users_count: (await loadUsers(storage)).length,
      user_theme: getTheme(c.get("webuiUser")),
    });
    return htmlResponse(html, 400);
  }

  const token = await makeSessionToken(username.toLowerCase().trim(), await storage.getSessionSecret());
  const res = c.redirect("/", 303);
  setSessionCookie(c, token);
  return res;
});

const logoutHandler = (c: Context<AppEnv>) => {
  clearSessionCookie(c);
  return c.redirect("/u/login", 303);
};

webuiAuth.get("/u/logout", logoutHandler);
webuiAuth.post("/u/logout", logoutHandler);