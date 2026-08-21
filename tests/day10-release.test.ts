import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { parseDxf } from "../lib/dxf";
import { canRetryTask } from "../lib/task-policy";
import { MAX_DXF_BYTES, validateDxfUploadMetadata } from "../lib/upload-policy";

test("release gate parses at least ten representative DXF fixtures", async () => {
  const names = (await readdir("tests/fixtures/dxf")).filter((name) => /^\d+.*\.dxf$/i.test(name)).sort();
  assert.ok(names.length >= 10, `expected at least 10 DXF fixtures, got ${names.length}`);
  for (const name of names) {
    const model = parseDxf(await readFile(`tests/fixtures/dxf/${name}`, "utf8"));
    assert.ok(model.previewSvg.includes("<svg"), name);
    assert.ok(model.boundary.areaSquareMeters > 0, name);
    if (name.startsWith("16_")) assert.equal(model.diagnostics.blockDownstreamGeneration, true);
  }
});

test("release gate rejects open and multiple-boundary DXF files", async () => {
  const open = await readFile("tests/fixtures/dxf/invalid_open_boundary.dxf", "utf8");
  const multiple = await readFile("tests/fixtures/dxf/invalid_multiple_boundaries.dxf", "utf8");
  assert.throws(() => parseDxf(open), /DXF_BOUNDARY_NOT_CLOSED/);
  assert.throws(() => parseDxf(multiple), /DXF_MULTIPLE_BOUNDARIES/);
});

test("50 MB upload boundary and invalid metadata are enforced without allocating a large file", () => {
  assert.deepEqual(validateDxfUploadMetadata({ fileName: "site.dxf", contentType: "application/dxf", size: MAX_DXF_BYTES }), { ok: true });
  assert.equal(validateDxfUploadMetadata({ fileName: "site.dxf", size: MAX_DXF_BYTES + 1 }).ok, false);
  assert.equal(validateDxfUploadMetadata({ fileName: "site.dwg", size: 100 }).ok, false);
  assert.equal(validateDxfUploadMetadata({ fileName: "site.dxf", contentType: "image/png", size: 100 }).ok, false);
  assert.equal(validateDxfUploadMetadata({ fileName: "site.dxf", size: 0 }).ok, false);
});

test("failed and timed-out tasks retry at most three times", () => {
  assert.equal(canRetryTask("FAILED", 0), true);
  assert.equal(canRetryTask("TIMED_OUT", 2), true);
  assert.equal(canRetryTask("FAILED", 3), false);
  assert.equal(canRetryTask("SUCCEEDED", 0), false);
  assert.equal(canRetryTask("RUNNING", 0), false);
});
