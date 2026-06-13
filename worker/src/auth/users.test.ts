import { describe, expect, it } from "vitest";
import { MemoryStorageBackend } from "../storage/memory-backend";
import { authenticate, createUser, loadUsers } from "./users";

describe("webui users", () => {
  it("creates and authenticates user", async () => {
    const storage = new MemoryStorageBackend();
    const created = await createUser(storage, "alice", "secret12");
    expect(created.ok).toBe(true);
    expect((await loadUsers(storage)).length).toBe(1);

    const user = await authenticate(storage, "alice", "secret12");
    expect(user?.username).toBe("alice");
    expect(await authenticate(storage, "alice", "nope")).toBeNull();
  });

  it("rejects invalid username", async () => {
    const storage = new MemoryStorageBackend();
    const result = await createUser(storage, "X", "secret12");
    expect(result.ok).toBe(false);
  });
});