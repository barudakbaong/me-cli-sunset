import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryStorageBackend } from "../storage/memory-backend";
import { authenticate, createUser, linkTelegram } from "../auth/users";
import { handleUpdate } from "./handler";
import { resetMemoryStateForTests } from "./state";

const sent: string[] = [];

vi.mock("./api", () => ({
  createTelegramApi: () => ({
    sendMessage: vi.fn(async (_chatId: number, text: string) => {
      sent.push(text);
      return true;
    }),
    editMessage: vi.fn(async () => true),
    answerCallbackQuery: vi.fn(async () => {}),
    sendChatAction: vi.fn(() => {}),
  }),
}));

describe("telegram handler", () => {
  beforeEach(() => {
    sent.length = 0;
    resetMemoryStateForTests();
  });

  it("/start prompts link when not linked", async () => {
    const storage = new MemoryStorageBackend();
    await handleUpdate({ ENVIRONMENT: "test", TELEGRAM_BOT_TOKEN: "tok" }, storage, {
      update_id: 1,
      message: { message_id: 1, chat: { id: 99, type: "private" }, text: "/start" },
    });
    expect(sent.some((t) => t.toLowerCase().includes("link"))).toBe(true);
  });

  it("/link authenticates and shows menu", async () => {
    const storage = new MemoryStorageBackend();
    await createUser(storage, "alice", "secret12");
    await handleUpdate({ ENVIRONMENT: "test", TELEGRAM_BOT_TOKEN: "tok" }, storage, {
      update_id: 2,
      message: { message_id: 2, chat: { id: 100, type: "private" }, text: "/link alice secret12" },
    });
    expect(sent.some((t) => t.includes("Berhasil link"))).toBe(true);
    const user = await authenticate(storage, "alice", "secret12");
    expect(user).not.toBeNull();
    await linkTelegram(storage, "alice", 100);
  });

  it("/help lists commands", async () => {
    const storage = new MemoryStorageBackend();
    await handleUpdate({ ENVIRONMENT: "test", TELEGRAM_BOT_TOKEN: "tok" }, storage, {
      update_id: 3,
      message: { message_id: 3, chat: { id: 1, type: "private" }, text: "/help" },
    });
    expect(sent.some((t) => t.includes("/kuota"))).toBe(true);
  });
});