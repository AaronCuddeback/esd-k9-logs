import "fake-indexeddb/auto";

// jsdom lacks crypto.subtle in some versions; Node's webcrypto covers it.
import { webcrypto } from "node:crypto";
if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, "crypto", { value: webcrypto });
}
