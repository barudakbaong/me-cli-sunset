import type { StorageBackend } from "../storage/types";
import { USER_REFRESH_TOKENS } from "../storage/keys";
import { hashPassword, verifyPassword } from "./password";

export const USERNAME_RE = /^[a-z0-9][a-z0-9_-]{2,30}$/;

export interface WebuiUserRecord {
  username: string;
  password_hash: string;
  created_at: number;
  theme?: string;
  telegram_chat_id?: number | null;
}

export async function loadUsers(storage: StorageBackend): Promise<WebuiUserRecord[]> {
  return (await storage.loadUsers()) as WebuiUserRecord[];
}

export async function getUser(storage: StorageBackend, username: string): Promise<WebuiUserRecord | null> {
  const normalized = (username || "").toLowerCase().trim();
  for (const u of await loadUsers(storage)) {
    if (u.username.toLowerCase() === normalized) return u;
  }
  return null;
}

export async function authenticate(
  storage: StorageBackend,
  username: string,
  password: string,
): Promise<WebuiUserRecord | null> {
  const user = await getUser(storage, username);
  if (!user) return null;
  if (!(await verifyPassword(password, user.password_hash))) return null;
  return user;
}

export async function createUser(
  storage: StorageBackend,
  username: string,
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized = (username || "").toLowerCase().trim();
  if (!USERNAME_RE.test(normalized)) {
    return { ok: false, error: "Username: 3-31 char, huruf kecil/angka/_/-, awalan huruf/angka." };
  }
  if (password.length < 6) {
    return { ok: false, error: "Password minimal 6 karakter." };
  }
  if (await getUser(storage, normalized)) {
    return { ok: false, error: `Username '${normalized}' sudah dipakai.` };
  }

  const users = await loadUsers(storage);
  users.push({
    username: normalized,
    password_hash: await hashPassword(password),
    created_at: Math.floor(Date.now() / 1000),
  });
  await storage.saveUsers(users);
  await storage.ensureUserDir(normalized);
  await ensureUserBootstrap(storage, normalized);
  return { ok: true };
}

export async function ensureUserBootstrap(storage: StorageBackend, username: string): Promise<void> {
  if (!(await storage.blobExists(username, USER_REFRESH_TOKENS))) {
    await storage.putBlob(username, USER_REFRESH_TOKENS, "[]");
  }
  await storage.ensureUserDir(username);
}

export function getTheme(user: WebuiUserRecord | null | undefined): string {
  return user?.theme === "light" ? "light" : "dark";
}

export async function getUserByTelegram(
  storage: StorageBackend,
  chatId: number,
): Promise<WebuiUserRecord | null> {
  for (const u of await loadUsers(storage)) {
    if (u.telegram_chat_id === chatId) return u;
  }
  return null;
}

export async function linkTelegram(
  storage: StorageBackend,
  username: string,
  chatId: number,
): Promise<boolean> {
  const users = await loadUsers(storage);
  const normalized = (username || "").toLowerCase().trim();
  let found = false;
  for (const u of users) {
    if (u.telegram_chat_id === chatId && u.username.toLowerCase() !== normalized) {
      delete u.telegram_chat_id;
    }
    if (u.username.toLowerCase() === normalized) {
      u.telegram_chat_id = chatId;
      found = true;
    }
  }
  if (!found) return false;
  await storage.saveUsers(users);
  return true;
}

export async function unlinkTelegram(storage: StorageBackend, username: string): Promise<boolean> {
  const users = await loadUsers(storage);
  const normalized = (username || "").toLowerCase().trim();
  let found = false;
  for (const u of users) {
    if (u.username.toLowerCase() === normalized) {
      delete u.telegram_chat_id;
      found = true;
    }
  }
  if (!found) return false;
  await storage.saveUsers(users);
  return true;
}

export async function changePassword(
  storage: StorageBackend,
  username: string,
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await authenticate(storage, username, currentPassword);
  if (!user) return { ok: false, error: "Password lama salah." };
  if (newPassword.length < 6) {
    return { ok: false, error: "Password baru minimal 6 karakter." };
  }

  const users = await loadUsers(storage);
  const normalized = (username || "").toLowerCase().trim();
  for (const u of users) {
    if (u.username.toLowerCase() === normalized) {
      u.password_hash = await hashPassword(newPassword);
      await storage.saveUsers(users);
      return { ok: true };
    }
  }
  return { ok: false, error: "User tidak ditemukan." };
}

export async function setTheme(
  storage: StorageBackend,
  username: string,
  theme: string,
): Promise<boolean> {
  if (theme !== "dark" && theme !== "light") return false;
  const users = await loadUsers(storage);
  const normalized = (username || "").toLowerCase().trim();
  for (const u of users) {
    if (u.username.toLowerCase() === normalized) {
      u.theme = theme;
      await storage.saveUsers(users);
      return true;
    }
  }
  return false;
}