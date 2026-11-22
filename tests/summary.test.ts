import { beforeEach, describe, expect, it } from "vitest";
import { loadStore, resetStore, saveStore } from "../server/data/store.js";
import { newId } from "../server/data/store.js";

describe("store summary pending approvals", () => {
  beforeEach(() => {
    resetStore();
  });

  it("pending count drops after approval status changes", () => {
    const store = loadStore();
    store.approvals.push({
      id: newId("ap"),
      runId: "run_test",
      createdAt: new Date().toISOString(),
      action: "queue_send",
      status: "pending",
      payload: {},
      summary: "Test send",
    });
    saveStore(store);

    let loaded = loadStore();
    expect(loaded.approvals.filter((a) => a.status === "pending")).toHaveLength(1);

    loaded.approvals[0].status = "approved";
    saveStore(loaded);
    loaded = loadStore();
    expect(loaded.approvals.filter((a) => a.status === "pending")).toHaveLength(0);
  });
});