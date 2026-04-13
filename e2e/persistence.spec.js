import { test, expect } from "@playwright/test";
import { execSync, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import net from "node:net";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Must match `drinkImageKey` in `src/utils/imageCache.js` for this drink. */
const IDB_KEY = "test mocktail|vodka";

/** 1×1 transparent PNG — not a real cocktail photo, tiny payload. */
const TINY_PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

let previewProc;

function waitForPort(port, host = "127.0.0.1", timeoutMs = 45_000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const socket = net.createConnection({ port, host }, () => {
        socket.end();
        resolve();
      });
      socket.on("error", () => {
        socket.destroy();
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Port ${port} did not open within ${timeoutMs}ms`));
        } else {
          setTimeout(tryConnect, 150);
        }
      });
    };
    tryConnect();
  });
}

function startPreviewServer() {
  const viteCli = path.join(root, "node_modules", "vite", "bin", "vite.js");
  previewProc = spawn(process.execPath, [viteCli, "preview", "--host", "127.0.0.1", "--port", "5173"], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env },
  });
  previewProc.stderr?.on("data", (chunk) => {
    process.stderr.write(chunk);
  });
  previewProc.stdout?.on("data", (chunk) => {
    process.stdout.write(chunk);
  });
  return waitForPort(5173);
}

function stopPreviewServer() {
  if (!previewProc) return;
  previewProc.kill("SIGTERM");
  previewProc = undefined;
}

test.describe("Client persistence (localStorage + IndexedDB)", () => {
  test.beforeAll(async () => {
    execSync("npm run build", { cwd: root, stdio: "inherit" });
    await startPreviewServer();
  });

  test.afterAll(() => {
    stopPreviewServer();
  });

  test("saved AI drink image survives page reload and preview server restart", async ({
    page,
  }) => {
    await page.goto("/");

    await page.evaluate(
      async ({ dataUrl, idbKey }) => {
        const drink = {
          id: "e2e-persist-1",
          name: "Test Mocktail",
          source: "gemini",
          image: null,
          ingredients: [{ name: "Vodka", measure: "1 oz" }],
          instructions: "Stir gently.",
          glass: "Rocks",
          tagline: "E2E placeholder",
          matchCount: 1,
          rating: 0,
          notes: "",
          savedAt: Date.now(),
        };
        localStorage.setItem("bar-help-saved", JSON.stringify([drink]));

        await new Promise((resolve, reject) => {
          const req = indexedDB.open("bar-help-images", 1);
          req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains("images")) {
              db.createObjectStore("images");
            }
          };
          req.onsuccess = () => {
            const db = req.result;
            const tx = db.transaction("images", "readwrite");
            tx.objectStore("images").put(dataUrl, idbKey);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
          };
          req.onerror = () => reject(req.error);
        });
      },
      { dataUrl: TINY_PNG_DATA_URL, idbKey: IDB_KEY },
    );

    await page.reload({ waitUntil: "load" });
    await page.getByRole("button", { name: /Saved/ }).click();

    const img = page.getByRole("img", { name: "Test Mocktail" });
    await expect(img).toBeVisible();
    await expect(img).toHaveAttribute("src", /^data:image\/png/);

    // Simulate "restart the server": Vite preview is stateless; client storage must persist.
    stopPreviewServer();
    await new Promise((r) => setTimeout(r, 800));
    await startPreviewServer();

    await page.reload({ waitUntil: "load" });
    await page.getByRole("button", { name: /Saved/ }).click();

    await expect(img).toBeVisible();
    await expect(img).toHaveAttribute("src", /^data:image\/png/);
  });
});
