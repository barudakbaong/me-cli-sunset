import { Hono } from "hono";
import { getTheme } from "./auth/users";
import { sessionMiddleware } from "./middleware/session";
import { webuiAuth } from "./routes/webui-auth";
import { htmlResponse, renderErrorPage, renderLayout } from "./ssr";
import type { AppEnv } from "./types";

const app = new Hono<AppEnv>();

app.use("*", sessionMiddleware);

app.get("/health", (c) =>
  c.json({
    ok: true,
    service: "webui-xl",
    environment: c.env.ENVIRONMENT ?? "unknown",
  }),
);

app.route("/", webuiAuth);

app.get("/", (c) => {
  const user = c.get("webuiUser");
  const html = renderLayout(
    "error_body",
    c.req.raw,
    {
      title: "WebUI-XL",
      message: user
        ? `Halo, ${user.username}! Phase 2 Worker — MyXL routes coming in PR-13+.`
        : "Phase 2 Worker — SSR + session ready.",
      message_pre: false,
      page_title: "WebUI-XL",
      webui_user: user ? { username: user.username } : undefined,
      user_theme: getTheme(user),
    },
  );
  return htmlResponse(html);
});

app.get("/demo/error", (c) => {
  const html = renderErrorPage(c.req.raw, {
    title: "Demo Error",
    message: "Ini halaman error contoh dari SSR engine.",
  });
  return htmlResponse(html);
});

app.notFound((c) => {
  const html = renderErrorPage(c.req.raw, {
    title: "404",
    message: `Path tidak ditemukan: ${c.req.path}`,
  });
  return htmlResponse(html, 404);
});

export default app;