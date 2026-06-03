import { execFile, spawn, type ChildProcess, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

type JsonRecord = Record<string, unknown>;

type CdpMessage = {
  id?: number;
  method?: string;
  params?: JsonRecord;
  result?: unknown;
  error?: { message?: string; data?: string };
  sessionId?: string;
};

type PendingCommand = {
  reject: (reason: Error) => void;
  resolve: (value: unknown) => void;
};

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpDir = path.join(projectRoot, ".tmp");
const host = process.env.LOCAL_SMOKE_HOST ?? "127.0.0.1";
const appPort = Number(process.env.LOCAL_SMOKE_PORT ?? 3100);
const debugPort = Number(process.env.LOCAL_SMOKE_DEBUG_PORT ?? 9222);
const hotelId = "hotel_realistic_pecos";
const screenshotPath = path.join(tmpDir, "local-browser-smoke-reservations.png");

class CdpConnection {
  private readonly pending = new Map<number, PendingCommand>();
  private readonly eventHandlers: Array<(message: CdpMessage) => void> = [];
  private nextId = 1;

  private constructor(private readonly socket: WebSocket) {
    socket.addEventListener("message", (event) => this.handleMessage(event.data));
    socket.addEventListener("close", () => {
      const error = new Error("Browser debugging connection closed.");
      for (const command of this.pending.values()) command.reject(error);
      this.pending.clear();
    });
  }

  static async connect(url: string) {
    const socket = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Timed out connecting to browser debugging socket.")), 10_000);
      socket.addEventListener("open", () => {
        clearTimeout(timer);
        resolve();
      });
      socket.addEventListener("error", () => {
        clearTimeout(timer);
        reject(new Error("Failed to connect to browser debugging socket."));
      });
    });
    return new CdpConnection(socket);
  }

  onEvent(handler: (message: CdpMessage) => void) {
    this.eventHandlers.push(handler);
  }

  send<T = JsonRecord>(method: string, params: JsonRecord = {}, sessionId?: string): Promise<T> {
    const id = this.nextId++;
    const payload = sessionId ? { id, method, params, sessionId } : { id, method, params };
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: (value) => resolve(value as T), reject });
      this.socket.send(JSON.stringify(payload));
    });
  }

  close() {
    this.socket.close();
  }

  private handleMessage(data: unknown) {
    const text = typeof data === "string" ? data : String(data);
    const message = JSON.parse(text) as CdpMessage;
    if (message.id) {
      const command = this.pending.get(message.id);
      if (!command) return;
      this.pending.delete(message.id);
      if (message.error) {
        command.reject(new Error(`${message.error.message ?? "CDP command failed"}${message.error.data ? `: ${message.error.data}` : ""}`));
      } else {
        command.resolve(message.result ?? {});
      }
      return;
    }

    for (const handler of this.eventHandlers) handler(message);
  }
}

async function main() {
  await mkdir(tmpDir, { recursive: true });

  const port = await findOpenPort(appPort);
  const cdpPort = await findOpenPort(debugPort);
  const baseUrl = `http://${host}:${port}`;
  const browserPath = findBrowserPath();
  const browserProfilePath = path.join(tmpdir(), `hotel-web-local-browser-smoke-profile-${Date.now()}`);

  let server: ChildProcessWithoutNullStreams | null = null;
  let browser: ChildProcess | null = null;
  let cdp: CdpConnection | null = null;
  let serverExit: { code: number | null; signal: NodeJS.Signals | null } | null = null;

  try {
    console.log(`Starting Next dev server on ${baseUrl} in demo mode...`);
    server = spawn("bun", ["run", "dev", "--", "--hostname", host, "--port", String(port)], {
      cwd: projectRoot,
      env: {
        ...process.env,
        CLERK_SECRET_KEY: "",
        DATABASE_URL: "",
        HOTEL_APP_DEMO_MODE: "true",
        NEXT_TELEMETRY_DISABLED: "1",
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "",
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let serverOutput = "";
    server.stdout.setEncoding("utf8");
    server.stderr.setEncoding("utf8");
    server.stdout.on("data", (chunk: string) => {
      serverOutput += chunk;
      process.stdout.write(chunk);
    });
    server.stderr.on("data", (chunk: string) => {
      serverOutput += chunk;
      process.stderr.write(chunk);
    });
    server.on("exit", (code, signal) => {
      serverExit = { code, signal };
    });

    await waitFor("Next dev server", async () => {
      if (serverExit) {
        throw new Error(`Next dev server exited before smoke test: ${JSON.stringify(serverExit)}\n${serverOutput}`);
      }
      try {
        const response = await fetch(`${baseUrl}/sign-in`, { redirect: "manual" });
        return response.status < 500;
      } catch {
        return false;
      }
    }, 45_000);

    console.log(`Starting headless browser from ${browserPath}...`);
    browser = spawn(browserPath, [
      "--headless=new",
      "--disable-gpu",
      "--disable-gpu-compositing",
      "--disable-direct-composition",
      "--disable-d3d11",
      "--disable-extensions",
      "--disable-background-networking",
      "--disable-default-apps",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-features=CalculateNativeWinOcclusion",
      "--remote-debugging-address=127.0.0.1",
      "--window-size=1440,1000",
      `--remote-debugging-port=${cdpPort}`,
      `--user-data-dir=${browserProfilePath}`,
      "about:blank",
    ], {
      cwd: projectRoot,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    browser.stdout?.setEncoding("utf8");
    browser.stderr?.setEncoding("utf8");
    browser.stderr?.on("data", (chunk: string) => process.stderr.write(chunk));

    const version = await waitFor("browser debugging endpoint", async () => {
      try {
        const response = await fetch(`http://${host}:${cdpPort}/json/version`);
        if (!response.ok) return false;
        return (await response.json()) as { webSocketDebuggerUrl?: string };
      } catch {
        return false;
      }
    }, 20_000);

    if (!version.webSocketDebuggerUrl) throw new Error("Browser debugging endpoint did not return a WebSocket URL.");
    cdp = await CdpConnection.connect(version.webSocketDebuggerUrl);

    const browserErrors: string[] = [];
    cdp.onEvent((message) => {
      if (message.method === "Runtime.exceptionThrown") {
        browserErrors.push(formatRuntimeException(message.params));
      }
      if (message.method === "Log.entryAdded" && isErrorLogEntry(message.params)) {
        browserErrors.push(formatLogEntry(message.params));
      }
      if (message.method === "Runtime.consoleAPICalled" && message.params?.type === "error") {
        browserErrors.push(`console.error: ${JSON.stringify(message.params.args ?? [])}`);
      }
    });

    const { sessionId } = await createPage(cdp);
    await cdp.send("Runtime.enable", {}, sessionId);
    await cdp.send("Log.enable", {}, sessionId);
    await cdp.send("Page.enable", {}, sessionId);

    console.log("Running browser smoke flow...");
    await navigate(cdp, sessionId, `${baseUrl}/sign-in`);
    await waitForText(cdp, sessionId, "Demo access code");

    await evaluate(cdp, sessionId, `
      (() => {
        const input = document.querySelector('input[placeholder="1, 2, 3, 31-34, or 4"]');
        if (!(input instanceof HTMLInputElement)) throw new Error("Demo access code input not found.");
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        if (!setter) throw new Error("Unable to set demo access code input.");
        setter.call(input, "2");
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        return input.value;
      })()
    `);
    await waitFor("demo submit button", () => evaluate<boolean>(cdp!, sessionId, `!document.querySelector('button[type="submit"]')?.hasAttribute("disabled")`), 5_000);
    await evaluate(cdp, sessionId, `
      (() => {
        const form = document.querySelector("form.login-form");
        if (!(form instanceof HTMLFormElement)) throw new Error("Demo login form not found.");
        form.requestSubmit();
        return true;
      })()
    `);

    await waitFor("hotel dashboard navigation", async () => {
      const href = await evaluate<string>(cdp!, sessionId, "location.href");
      return href.includes(`/hotels/${hotelId}`) ? href : false;
    }, 15_000);
    await waitForText(cdp, sessionId, "Create walk-in");

    await navigate(cdp, sessionId, `${baseUrl}/hotels/${hotelId}/front-desk`);
    await waitForText(cdp, sessionId, "Create walk-in");
    await waitForText(cdp, sessionId, "Table and booking board");

    await navigate(cdp, sessionId, `${baseUrl}/hotels/${hotelId}/front-desk/reservations`);
    await waitForText(cdp, sessionId, "Booking board");
    await waitFor("booking board element", () => evaluate<boolean>(cdp!, sessionId, `document.querySelector(".booking-board") !== null`), 15_000);

    const screenshot = await cdp.send<{ data: string }>("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }, sessionId);
    await writeFile(screenshotPath, Buffer.from(screenshot.data, "base64"));

    if (browserErrors.length > 0) {
      throw new Error(`Browser reported errors:\n${browserErrors.map((error) => `- ${error}`).join("\n")}`);
    }

    console.log(`Local browser smoke passed. Screenshot: ${path.relative(projectRoot, screenshotPath)}`);
  } finally {
    cdp?.close();
    if (browser) await stopProcessTree(browser);
    if (server) await stopProcessTree(server);
    await rm(browserProfilePath, { force: true, recursive: true }).catch(() => undefined);
  }
}

async function createPage(cdp: CdpConnection) {
  const target = await cdp.send<{ targetId: string }>("Target.createTarget", { url: "about:blank" });
  return cdp.send<{ sessionId: string }>("Target.attachToTarget", { targetId: target.targetId, flatten: true });
}

async function navigate(cdp: CdpConnection, sessionId: string, url: string) {
  await cdp.send("Page.navigate", { url }, sessionId);
  await waitFor(`page load: ${url}`, () => evaluate<boolean>(cdp, sessionId, `document.readyState === "complete"`), 20_000);
}

async function waitForText(cdp: CdpConnection, sessionId: string, text: string) {
  await waitFor(`text: ${text}`, async () => {
    const bodyText = await evaluate<string>(cdp, sessionId, "document.body?.innerText ?? ''");
    return bodyText.includes(text);
  }, 20_000);
}

async function evaluate<T>(cdp: CdpConnection, sessionId: string, expression: string) {
  const response = await cdp.send<{
    exceptionDetails?: { text?: string; exception?: { description?: string; value?: string } };
    result?: { value?: T };
  }>("Runtime.evaluate", {
    awaitPromise: true,
    expression,
    returnByValue: true,
  }, sessionId);

  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.exception?.description ?? response.exceptionDetails.text ?? "Browser evaluation failed.");
  }

  return response.result?.value as T;
}

async function waitFor<T>(label: string, probe: () => Promise<T | false> | T | false, timeoutMs: number, intervalMs = 250): Promise<T> {
  const startedAt = Date.now();
  let lastError: unknown;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const result = await probe();
      if (result) return result;
    } catch (error) {
      lastError = error;
    }
    await delay(intervalMs);
  }

  const suffix = lastError instanceof Error ? ` Last error: ${lastError.message}` : "";
  throw new Error(`Timed out waiting for ${label}.${suffix}`);
}

async function findOpenPort(startAt: number) {
  for (let port = startAt; port < startAt + 100; port += 1) {
    if (await canListen(port)) return port;
  }
  throw new Error(`No open port found from ${startAt} to ${startAt + 99}.`);
}

async function canListen(port: number) {
  return new Promise<boolean>((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

function findBrowserPath() {
  const candidates = [
    process.env.LOCAL_SMOKE_BROWSER,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  throw new Error("No Chrome or Edge executable found. Set LOCAL_SMOKE_BROWSER to a Chromium-compatible browser path.");
}

async function stopProcessTree(child: ChildProcess) {
  if (!child.pid) return;

  if (process.platform === "win32") {
    await execFileAsync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true }).catch(() => undefined);
    return;
  }

  child.kill("SIGTERM");
  await Promise.race([
    new Promise<void>((resolve) => child.once("exit", () => resolve())),
    delay(3_000).then(() => child.kill("SIGKILL")),
  ]);
}

function isErrorLogEntry(params: JsonRecord | undefined) {
  const entry = params?.entry as JsonRecord | undefined;
  return entry?.level === "error";
}

function formatLogEntry(params: JsonRecord | undefined) {
  const entry = params?.entry as JsonRecord | undefined;
  return String(entry?.text ?? "browser log error");
}

function formatRuntimeException(params: JsonRecord | undefined) {
  const exceptionDetails = params?.exceptionDetails as JsonRecord | undefined;
  const exception = exceptionDetails?.exception as JsonRecord | undefined;
  return String(exception?.description ?? exceptionDetails?.text ?? "browser runtime exception");
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

await main();
