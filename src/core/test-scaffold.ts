import { FeatureDocument, Behavior, TestCase } from "./product.js";

/**
 * Render test stubs in the user's framework from a Feature's behaviors +
 * test_cases. ProductOS doesn't own the test runner — these stubs land in
 * the user's repo, are run by the user's CI, and results flow back through
 * the receive interface keyed on the stable id encoded in each test name.
 *
 * Each stub fails loudly (throw / NotImplementedError) until the implementer
 * fills it in. The stable id (`<area>/<feature>#<behavior>/<case>`) sits in
 * the test name verbatim so test runners that surface failures by name make
 * the link obvious in CI output.
 *
 * Deprecated test cases are skipped — the markdown carries them for history
 * but we don't scaffold runnable tests for behavior nobody currently expects.
 */

export type SupportedFramework = "jest" | "vitest" | "playwright" | "pytest";

export interface ScaffoldResult {
  framework: SupportedFramework;
  filename: string;
  content: string;
}

export function scaffoldTests(
  feature: FeatureDocument,
  framework: SupportedFramework
): ScaffoldResult {
  switch (framework) {
    case "jest":
      return { framework, filename: jsFilename(feature, "test"), content: renderJest(feature) };
    case "vitest":
      return { framework, filename: jsFilename(feature, "test"), content: renderVitest(feature) };
    case "playwright":
      return { framework, filename: jsFilename(feature, "spec"), content: renderPlaywright(feature) };
    case "pytest":
      return { framework, filename: pyFilename(feature), content: renderPytest(feature) };
  }
}

// ---------------------------------------------------------------------------
// Helpers shared across templates

function activeCases(b: Behavior): TestCase[] {
  return b.test_cases.filter((tc) => !tc.deprecated);
}

function activeBehaviors(f: FeatureDocument): Behavior[] {
  return f.frontmatter.behaviors.filter((b) => !b.deprecated && activeCases(b).length > 0);
}

function stableId(featureId: string, behaviorId: string, caseId: number): string {
  return `${featureId}#${behaviorId}/${caseId}`;
}

function gwt(tc: TestCase): { given?: string; when?: string; then?: string; steps?: string } {
  return { given: tc.given, when: tc.when, then: tc.then, steps: tc.steps };
}

function commentBlock(prefix: string, tc: TestCase): string[] {
  const { given, when, then, steps } = gwt(tc);
  const lines: string[] = [];
  if (given || when || then) {
    if (given) lines.push(`${prefix} GIVEN: ${given}`);
    if (when) lines.push(`${prefix} WHEN:  ${when}`);
    if (then) lines.push(`${prefix} THEN:  ${then}`);
  } else if (steps) {
    for (const line of steps.split("\n")) {
      if (line.trim()) lines.push(`${prefix} ${line}`);
    }
  }
  return lines;
}

function pySlug(s: string): string {
  return s.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase();
}

function jsFilename(f: FeatureDocument, kind: "test" | "spec"): string {
  return `tests/${f.frontmatter.id}.${kind}.ts`;
}

function pyFilename(f: FeatureDocument): string {
  const parts = f.frontmatter.id.split("/");
  return `tests/test_${parts.map(pySlug).join("_")}.py`;
}

// ---------------------------------------------------------------------------
// Jest

function renderJest(f: FeatureDocument): string {
  const out: string[] = [];
  out.push(`// @productos:feature ${f.frontmatter.id}`);
  out.push(`// ${f.frontmatter.title}`);
  out.push(`// Generated test stubs. Each test name carries its stable id so CI`);
  out.push(`// results map back to the Contract. Fill in setup + assertions —`);
  out.push(`// don't change the stable id prefix in the test name.`);
  out.push(``);
  for (const b of activeBehaviors(f)) {
    out.push(`describe("${f.frontmatter.id}#${b.id}", () => {`);
    out.push(`  // ${b.claim}`);
    for (const tc of activeCases(b)) {
      const id = stableId(f.frontmatter.id, b.id, tc.id);
      out.push(``);
      out.push(`  it(${JSON.stringify(`${id}: ${tc.description}`)}, async () => {`);
      for (const c of commentBlock("    //", tc)) out.push(c);
      out.push(`    throw new Error("TODO: implement ${id}");`);
      out.push(`  });`);
    }
    out.push(`});`);
    out.push(``);
  }
  return out.join("\n");
}

// ---------------------------------------------------------------------------
// Vitest — structurally identical to Jest with an explicit import

function renderVitest(f: FeatureDocument): string {
  const out: string[] = [];
  out.push(`// @productos:feature ${f.frontmatter.id}`);
  out.push(`// ${f.frontmatter.title}`);
  out.push(`// Generated test stubs. Each test name carries its stable id so CI`);
  out.push(`// results map back to the Contract. Fill in setup + assertions —`);
  out.push(`// don't change the stable id prefix in the test name.`);
  out.push(``);
  out.push(`import { describe, it } from "vitest";`);
  out.push(``);
  for (const b of activeBehaviors(f)) {
    out.push(`describe("${f.frontmatter.id}#${b.id}", () => {`);
    out.push(`  // ${b.claim}`);
    for (const tc of activeCases(b)) {
      const id = stableId(f.frontmatter.id, b.id, tc.id);
      out.push(``);
      out.push(`  it(${JSON.stringify(`${id}: ${tc.description}`)}, async () => {`);
      for (const c of commentBlock("    //", tc)) out.push(c);
      out.push(`    throw new Error("TODO: implement ${id}");`);
      out.push(`  });`);
    }
    out.push(`});`);
    out.push(``);
  }
  return out.join("\n");
}

// ---------------------------------------------------------------------------
// Playwright — uses test() and a page fixture; otherwise same idiom

function renderPlaywright(f: FeatureDocument): string {
  const out: string[] = [];
  out.push(`// @productos:feature ${f.frontmatter.id}`);
  out.push(`// ${f.frontmatter.title}`);
  out.push(`// Generated test stubs. Each test name carries its stable id so CI`);
  out.push(`// results map back to the Contract. Fill in navigation + assertions —`);
  out.push(`// don't change the stable id prefix in the test name.`);
  out.push(``);
  out.push(`import { test, expect } from "@playwright/test";`);
  out.push(``);
  for (const b of activeBehaviors(f)) {
    out.push(`test.describe("${f.frontmatter.id}#${b.id}", () => {`);
    out.push(`  // ${b.claim}`);
    for (const tc of activeCases(b)) {
      const id = stableId(f.frontmatter.id, b.id, tc.id);
      out.push(``);
      out.push(`  test(${JSON.stringify(`${id}: ${tc.description}`)}, async ({ page }) => {`);
      for (const c of commentBlock("    //", tc)) out.push(c);
      out.push(`    throw new Error("TODO: implement ${id}");`);
      out.push(`  });`);
    }
    out.push(`});`);
    out.push(``);
  }
  return out.join("\n");
}

// ---------------------------------------------------------------------------
// Pytest — class-per-behavior, method-per-case. Stable id in the docstring
// AND in the failure message so collectors that show docstrings or messages
// both surface the link.

function renderPytest(f: FeatureDocument): string {
  const out: string[] = [];
  out.push(`# @productos:feature ${f.frontmatter.id}`);
  out.push(`# ${f.frontmatter.title}`);
  out.push(`#`);
  out.push(`# Generated test stubs. Each test docstring carries its stable id so CI`);
  out.push(`# results map back to the Contract. Fill in setup + assertions — don't`);
  out.push(`# change the stable id prefix in the docstring or message.`);
  out.push(``);
  for (const b of activeBehaviors(f)) {
    const className = "Test" + pySlug(b.id).replace(/(^|_)(\w)/g, (_, _u, c: string) => c.toUpperCase());
    out.push(`class ${className}:`);
    out.push(`    """${f.frontmatter.id}#${b.id} — ${b.claim.replace(/"/g, '\\"')}"""`);
    for (const tc of activeCases(b)) {
      const id = stableId(f.frontmatter.id, b.id, tc.id);
      out.push(``);
      out.push(`    def test_${tc.id}_${pySlug(tc.description)}(self):`);
      out.push(`        """${id}: ${tc.description.replace(/"/g, '\\"')}"""`);
      for (const c of commentBlock("        #", tc)) out.push(c);
      out.push(`        raise NotImplementedError("TODO: implement ${id}")`);
    }
    out.push(``);
  }
  return out.join("\n");
}
