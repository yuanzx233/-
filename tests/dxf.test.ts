import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseDxf } from "../lib/dxf";

test("parses layers, lines and closed polylines into millimeters", async () => {
  const source = await readFile("tests/fixtures/dxf/01_rectangle_18x24m.dxf", "utf8");
  const model = parseDxf(source);
  assert.equal(model.normalizedUnit, "mm");
  assert.equal(model.sourceUnit, "mm");
  assert.equal(model.stats.polylineCount, 1);
  assert.equal(model.stats.lineCount, 3);
  assert.equal(model.bounds.width, 28000);
  assert.equal(model.bounds.height, 27000);
  assert.deepEqual(
    model.layers.map((layer) => layer.name).sort(),
    ["ENTRANCE", "NORTH", "ROAD", "SITE_BOUNDARY"],
  );
  const boundary = model.polylines.find((entity) => entity.layer === "SITE_BOUNDARY");
  assert.equal(boundary?.closed, true);
  assert.equal(boundary?.points.length, 4);
  assert.equal(model.schemaVersion, "0.2");
  assert.equal(model.boundary.areaSquareMeters, 432);
  assert.equal(model.boundary.perimeterMeters, 84);
  assert.deepEqual(model.boundary.sideLengthsMeters, [18, 24, 18, 24]);
  assert.deepEqual(model.boundary.majorDimensionsMeters, { width: 18, height: 24 });
  assert.match(model.previewSvg, /<polygon/);
});

test("rejects files without supported entities", () => {
  assert.throws(
    () => parseDxf("0\nSECTION\n2\nENTITIES\n0\nENDSEC\n0\nEOF\n", { unit: "mm" }),
    /DXF_NO_SUPPORTED_ENTITIES/,
  );
});

test("rejects an open site boundary with a clear code", async () => {
  const source = await readFile("tests/fixtures/dxf/invalid_open_boundary.dxf", "utf8");
  assert.throws(() => parseDxf(source), /DXF_BOUNDARY_NOT_CLOSED/);
});

test("rejects multiple site boundaries with a clear code", async () => {
  const source = await readFile("tests/fixtures/dxf/invalid_multiple_boundaries.dxf", "utf8");
  assert.throws(() => parseDxf(source), /DXF_MULTIPLE_BOUNDARIES/);
});
