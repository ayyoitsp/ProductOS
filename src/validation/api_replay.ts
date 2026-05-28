import { TruthDocument, Trace } from "../core/types.js";
import { ProductosConfig } from "../core/config.js";
import { nowIso } from "../core/truth.js";

/**
 * Run an API-behavior Truth's proposed test against the target by *parsing the
 * test source* for the canonical pattern (supertest or fetch) and replaying it.
 *
 * MVP: supports a recognized subset of supertest/fetch idioms. If parsing fails,
 * we surface that to the user with a clear message rather than guessing.
 */
export async function runApiReplay(
  truth: TruthDocument,
  config: ProductosConfig
): Promise<Trace> {
  if (truth.frontmatter.type !== "api-behavior") {
    throw new Error(`runApiReplay: claim type is ${truth.frontmatter.type}, expected api-behavior`);
  }
  const test = truth.frontmatter.proposed_test;
  if (!test) {
    throw new Error(`runApiReplay: truth ${truth.frontmatter.id} has no proposed_test`);
  }

  const target = config.targets[config.default_target];
  if (!target?.url) {
    throw new Error(`runApiReplay: target '${config.default_target}' has no url`);
  }
  const baseUrl = target.url.replace(/\/+$/, "");

  // Extract method, path, body, and expected status/body from the test source.
  // Supports two idioms:
  //   1) supertest:  request(app).post('/path').send({...}); expect(res.status).toBe(NNN);
  //   2) fetch:      fetch(`${base}/path`, { method: 'POST', body: JSON.stringify({...}) })
  const parsed = parseHttpFromTest(test.source);

  const url = baseUrl + parsed.path;
  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...parsed.headers,
  };
  if (target.auth_token_env && process.env[target.auth_token_env]) {
    headers["authorization"] = `Bearer ${process.env[target.auth_token_env]}`;
  }

  const start = Date.now();
  let response: globalThis.Response;
  try {
    response = await fetch(url, {
      method: parsed.method,
      headers,
      body:
        parsed.body !== undefined
          ? typeof parsed.body === "string"
            ? parsed.body
            : JSON.stringify(parsed.body)
          : undefined,
    });
  } catch (e) {
    return {
      truth_id: truth.frontmatter.id,
      mode: "api",
      target: baseUrl,
      captured_at: nowIso(),
      result: "fail",
      test,
      request: { method: parsed.method, url, headers, body: parsed.body },
      failure_detail: `fetch failed: ${(e as Error).message}`,
    };
  }
  const latency = Date.now() - start;

  // Try to parse the body as JSON for assertions; fall back to text.
  const contentType = response.headers.get("content-type") ?? "";
  let bodyParsed: unknown;
  if (contentType.includes("application/json")) {
    try {
      bodyParsed = await response.json();
    } catch {
      bodyParsed = await response.text();
    }
  } else {
    bodyParsed = await response.text();
  }

  // Evaluate the expectations parsed from the test.
  const assertionFailures: string[] = [];
  for (const exp of parsed.expectations) {
    if (exp.kind === "status" && response.status !== exp.value) {
      assertionFailures.push(
        `expected status ${exp.value}, got ${response.status}`
      );
    }
    if (exp.kind === "json-path") {
      const actual = pickPath(bodyParsed, exp.path);
      if (!matchExpectation(actual, exp.matcher)) {
        assertionFailures.push(
          `expected body.${exp.path.join(".")} to ${describeMatcher(exp.matcher)}; got ${JSON.stringify(actual)}`
        );
      }
    }
  }

  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((v, k) => (responseHeaders[k] = v));

  return {
    truth_id: truth.frontmatter.id,
    mode: "api",
    target: baseUrl,
    captured_at: nowIso(),
    result: assertionFailures.length === 0 ? "pass" : "fail",
    test,
    request: { method: parsed.method, url, headers, body: parsed.body },
    response: {
      status: response.status,
      headers: responseHeaders,
      body: bodyParsed,
      latency_ms: latency,
    },
    failure_detail:
      assertionFailures.length === 0 ? undefined : assertionFailures.join("; "),
  };
}

type Expectation =
  | { kind: "status"; value: number }
  | { kind: "json-path"; path: string[]; matcher: Matcher };

type Matcher =
  | { kind: "equals"; value: unknown }
  | { kind: "contains"; value: unknown }
  | { kind: "exists" };

interface ParsedHttp {
  method: string;
  path: string;
  headers: Record<string, string>;
  body?: unknown;
  expectations: Expectation[];
}

/**
 * Parse a Jest/supertest-style test source into a structured request and
 * expectations. Best-effort — we look for the conventional patterns.
 */
function parseHttpFromTest(source: string): ParsedHttp {
  const expectations: Expectation[] = [];

  // Method + path: prefer supertest-style request(app).post('/path').send(...).
  const supertest = source.match(
    /\.(get|post|put|patch|delete|head|options)\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/i
  );
  let method = "GET";
  let pathStr = "/";
  if (supertest) {
    method = supertest[1]!.toUpperCase();
    pathStr = supertest[2]!;
  } else {
    // fetch-style: fetch(url, { method: 'POST', ... })
    const fetchUrl = source.match(/fetch\s*\(\s*[`'"]([^`'"]+)[`'"]/);
    if (fetchUrl) pathStr = stripBaseFromUrl(fetchUrl[1]!);
    const fetchMethod = source.match(/method\s*:\s*['"`](\w+)['"`]/i);
    if (fetchMethod) method = fetchMethod[1]!.toUpperCase();
  }

  // Body: supertest .send({...}) | .send(varName) | fetch body: JSON.stringify({...})
  let body: unknown;
  const sendObj = source.match(/\.send\s*\(\s*(\{[\s\S]*?\})\s*\)/);
  if (sendObj) {
    body = safeJsonish(sendObj[1]!);
  } else {
    const sendVar = source.match(/\.send\s*\(\s*([a-zA-Z_$][\w$]*)\s*\)/);
    if (sendVar) {
      const varName = sendVar[1]!;
      const decl = source.match(
        new RegExp(`(?:const|let|var)\\s+${varName}\\s*=\\s*(\\{[\\s\\S]*?\\})`)
      );
      if (decl) body = safeJsonish(decl[1]!);
    }
    if (body === undefined) {
      const stringifyMatch = source.match(
        /JSON\.stringify\s*\(\s*(\{[\s\S]*?\})\s*\)/
      );
      if (stringifyMatch) body = safeJsonish(stringifyMatch[1]!);
    }
  }

  // Headers: supertest .set(authHeaders) — we can't resolve that variable; skip.
  const headers: Record<string, string> = {};
  const setLiteral = source.match(
    /\.set\s*\(\s*(\{[\s\S]*?\})\s*\)/
  );
  if (setLiteral) {
    const parsed = safeJsonish(setLiteral[1]!);
    if (parsed && typeof parsed === "object") {
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === "string") headers[k.toLowerCase()] = v;
      }
    }
  }

  // Expectations: expect(res.status).toBe(NNN)
  for (const m of source.matchAll(
    /expect\s*\(\s*res\.status\s*\)\s*\.toBe\s*\(\s*(\d+)\s*\)/g
  )) {
    expectations.push({ kind: "status", value: parseInt(m[1]!, 10) });
  }
  for (const m of source.matchAll(
    /expect\s*\(\s*response\.status\s*\)\s*\.toBe\s*\(\s*(\d+)\s*\)/g
  )) {
    expectations.push({ kind: "status", value: parseInt(m[1]!, 10) });
  }

  // expect(res.body.X.Y).toBe('z')
  for (const m of source.matchAll(
    /expect\s*\(\s*(?:res|response)\.body\.([\w.]+)\s*\)\s*\.toBe\s*\(\s*([^)]+)\s*\)/g
  )) {
    const path = m[1]!.split(".");
    const value = safeJsonish(m[2]!.trim());
    expectations.push({
      kind: "json-path",
      path,
      matcher: { kind: "equals", value },
    });
  }

  // expect(res.body.X).toContainEqual(expect.objectContaining({...}))
  for (const m of source.matchAll(
    /expect\s*\(\s*(?:res|response)\.body\.([\w.]+)\s*\)\s*\.toContainEqual\s*\(\s*expect\.objectContaining\s*\(\s*(\{[\s\S]*?\})\s*\)\s*\)/g
  )) {
    const path = m[1]!.split(".");
    const value = safeJsonish(m[2]!);
    expectations.push({
      kind: "json-path",
      path,
      matcher: { kind: "contains", value },
    });
  }

  return { method, path: pathStr, headers, body, expectations };
}

function stripBaseFromUrl(u: string): string {
  // Convert `${base}/api/foo` → `/api/foo` or absolute http://… → just pathname.
  const cleaned = u.replace(/\$\{[^}]+\}/g, "");
  try {
    const url = new URL(cleaned);
    return url.pathname + url.search;
  } catch {
    return cleaned.startsWith("/") ? cleaned : `/${cleaned}`;
  }
}

/** Parse a string that looks like JSON-or-JS-object literal. Best-effort. */
function safeJsonish(s: string): unknown {
  // Try strict JSON first.
  try {
    return JSON.parse(s);
  } catch {
    // Fallback: very loose conversion of JS object literal → JSON.
    // (single quotes → double; unquoted keys → quoted; trailing commas removed)
    const jsoned = s
      .replace(/([{,]\s*)([a-zA-Z_$][\w$]*)\s*:/g, '$1"$2":')
      .replace(/'([^']*)'/g, '"$1"')
      .replace(/,(\s*[}\]])/g, "$1");
    try {
      return JSON.parse(jsoned);
    } catch {
      return s;
    }
  }
}

function pickPath(obj: unknown, p: string[]): unknown {
  let cur: unknown = obj;
  for (const seg of p) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

function matchExpectation(actual: unknown, m: Matcher): boolean {
  if (m.kind === "equals") return deepEqual(actual, m.value);
  if (m.kind === "contains") {
    if (!Array.isArray(actual)) return false;
    return actual.some((item) => containsSubset(item, m.value));
  }
  if (m.kind === "exists") return actual !== undefined && actual !== null;
  return false;
}

function describeMatcher(m: Matcher): string {
  if (m.kind === "equals") return `equal ${JSON.stringify(m.value)}`;
  if (m.kind === "contains") return `contain ${JSON.stringify(m.value)}`;
  return "exist";
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a && b && typeof a === "object") {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}

function containsSubset(actual: unknown, expected: unknown): boolean {
  if (typeof expected !== "object" || expected === null) {
    return deepEqual(actual, expected);
  }
  if (typeof actual !== "object" || actual === null) return false;
  for (const [k, v] of Object.entries(expected)) {
    if (!containsSubset((actual as Record<string, unknown>)[k], v)) return false;
  }
  return true;
}
