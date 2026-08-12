import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { isFootprintClearOfRetainedObjects, isFootprintWithinBuildableArea, parseDxf } from "../lib/dxf";

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
  assert.equal(model.schemaVersion, "0.4");
  assert.equal(model.boundary.areaSquareMeters, 432);
  assert.equal(model.boundary.perimeterMeters, 84);
  assert.deepEqual(model.boundary.sideLengthsMeters, [18, 24, 18, 24]);
  assert.deepEqual(model.boundary.majorDimensionsMeters, { width: 18, height: 24 });
  assert.equal(model.buildableArea, null);
  assert.match(model.previewSvg, /<polygon/);
  assert.doesNotMatch(model.previewSvg, /data-layer="BUILDABLE_AREA"/);
});

test("accepts DXF-01 legacy POLYLINE and recognizes site semantics within tolerance", async () => {
  const source = await readFile("tests/fixtures/dxf/09_legacy_rectangular_site.dxf", "utf8");
  const model = parseDxf(source);
  const boundaries = model.polylines.filter((entity) => entity.layer === "SITE_BOUNDARY" && entity.closed);
  assert.equal(boundaries.length, 1);
  assert.equal(boundaries[0].type, "POLYLINE");
  assert.ok(Math.abs(model.boundary.areaSquareMeters - 432) / 432 <= 0.01);
  assert.equal(model.boundary.perimeterMeters, 84);
  assert.equal(model.boundary.sideLengthsMeters.length, 4);
  model.boundary.sideLengthsMeters.forEach((length, index) => {
    assert.ok(Math.abs(length - [18, 24, 18, 24][index]) <= 0.05);
  });
  assert.deepEqual(model.siteAnalysis.roadSides, ["south"]);
  assert.equal(model.siteAnalysis.roadWidthMeters, 6);
  assert.equal(model.siteAnalysis.entranceSide, "south");
  assert.equal(model.siteAnalysis.entranceWidthMeters, 4);
  assert.deepEqual(model.siteAnalysis.entranceSegment, {
    start: { x: 10000, y: 6000 },
    end: { x: 14000, y: 6000 },
  });
  assert.ok(model.siteAnalysis.northAngleDegrees !== null && Math.abs(model.siteAnalysis.northAngleDegrees) <= 2);
  assert.equal(model.siteAnalysis.northDetected, true);
  assert.match(model.previewSvg, /<polygon/);
  assert.match(model.previewSvg, /N 0°/);
  assert.match(model.previewSvg, /南侧道路 6\.0 m/);
  assert.match(model.previewSvg, /入口 4\.0 m/);
  assert.match(model.previewSvg, />18\.0 m</);
  assert.match(model.previewSvg, />24\.0 m</);
  assert.match(model.previewSvg, /场地边界、建筑控制线、临路、入口、北向和尺寸预览/);
});

test("DXF-02 auto-detects meters, preserves scale, and accepts rotated north", async () => {
  const source = await readFile("tests/fixtures/dxf/10_meter_rectangular_site.dxf", "utf8");
  const automatic = parseDxf(source);
  assert.equal(automatic.sourceUnit, "m");
  assert.equal(automatic.boundary.areaSquareMeters, 300);
  assert.equal(automatic.boundary.perimeterMeters, 70);
  assert.deepEqual(automatic.boundary.sideLengthsMeters, [15, 20, 15, 20]);
  assert.deepEqual(automatic.siteAnalysis.roadSides, ["east"]);
  assert.equal(automatic.siteAnalysis.roadWidthMeters, 4);
  assert.equal(automatic.siteAnalysis.entranceSide, "east");
  assert.equal(automatic.siteAnalysis.entranceWidthMeters, 3.5);
  assert.ok(automatic.siteAnalysis.northAngleDegrees !== null && Math.abs(automatic.siteAnalysis.northAngleDegrees - 15) <= 2);
  assert.equal(automatic.siteAnalysis.northDetected, true);
  assert.match(automatic.previewSvg, /东侧道路 4\.0 m/);
  assert.match(automatic.previewSvg, /transform="rotate\(90/);
  assert.match(automatic.previewSvg, /text-anchor="end"[^>]*>入口 3\.5 m/);

  const confirmed = parseDxf(source, { unit: "m" });
  assert.equal(confirmed.boundary.areaSquareMeters, 300);
  assert.throws(() => parseDxf(source, { unit: "mm" }), /DXF_SCALE_OUT_OF_RANGE/);
});

test("labels every L-shaped boundary edge and each road with its own width", async () => {
  const source = await readFile("tests/fixtures/dxf/11_l_shape_multi_road.dxf", "utf8");
  const model = parseDxf(source);
  assert.deepEqual(model.boundary.sideLengthsMeters, [24, 10, 10, 12, 14, 22]);
  assert.deepEqual(model.siteAnalysis.roads, [
    { side: "south", widthMeters: 5 },
    { side: "west", widthMeters: 4 },
  ]);
  assert.deepEqual(model.siteAnalysis.roadSides, ["south", "west"]);
  assert.equal(model.siteAnalysis.roadWidthMeters, 5);
  assert.equal((model.previewSvg.match(/data-edge=/g) ?? []).length, 6);
  assert.match(model.previewSvg, /南侧道路 5\.0 m/);
  assert.match(model.previewSvg, /西侧道路 4\.0 m/);
});

test("DXF-04 preserves sloped boundaries and calculates the buildable control area", async () => {
  const source = await readFile("tests/fixtures/dxf/12_trapezoid_sloped_site.dxf", "utf8");
  const expected = JSON.parse(await readFile("tests/fixtures/dxf/12_trapezoid_sloped_site.expected.json", "utf8"));
  const model = parseDxf(source);
  assert.equal(model.boundary.areaSquareMeters, expected.site_area_m2);
  model.boundary.sideLengthsMeters.forEach((length, index) => {
    assert.ok(Math.abs(length - expected.side_lengths_m[index]) <= .05);
  });
  assert.ok(model.boundary.majorDirectionDegrees > 10 && model.boundary.majorDirectionDegrees < 12);
  assert.ok(model.boundary.sideAnglesDegrees.some((angle) => angle > 90 && angle < 100));
  assert.equal(model.siteAnalysis.roadWidthMeters, expected.road_width_m);
  assert.equal(model.siteAnalysis.entranceSide, "north");
  assert.ok(model.siteAnalysis.entranceWidthMeters !== null && Math.abs(model.siteAnalysis.entranceWidthMeters - expected.entrance_width_m) <= .05);
  assert.ok(model.siteAnalysis.northAngleDegrees !== null && Math.abs(model.siteAnalysis.northAngleDegrees - expected.north_angle_deg_clockwise_from_up) <= 2);
  assert.ok(model.buildableArea);
  assert.ok(Math.abs(model.buildableArea!.areaSquareMeters - expected.buildable_area_m2) <= .05);
  assert.equal((model.previewSvg.match(/data-edge=/g) ?? []).length, 4);
  assert.match(model.previewSvg, /data-layer="BUILDABLE_AREA"/);
  assert.doesNotMatch(model.previewSvg, /stroke-dasharray/);
  assert.match(model.previewSvg, />28\.0 m</);
  assert.match(model.previewSvg, />21\.0 m</);
});

test("DXF-05 keeps site and buildable areas separate and enforces setbacks", async () => {
  const source = await readFile("tests/fixtures/dxf/13_setback_control_line.dxf", "utf8");
  const expected = JSON.parse(await readFile("tests/fixtures/dxf/13_setback_control_line.expected.json", "utf8"));
  const model = parseDxf(source);
  assert.equal(model.boundary.layer, "SITE_BOUNDARY");
  assert.equal(model.boundary.areaSquareMeters, expected.site_area_m2);
  assert.equal(model.boundary.perimeterMeters, expected.site_perimeter_m);
  assert.ok(model.buildableArea);
  assert.equal(model.buildableArea!.areaSquareMeters, expected.buildable_area_m2);
  assert.deepEqual(model.buildableArea!.setbacksMeters, expected.setbacks_m);
  assert.equal(isFootprintWithinBuildableArea(model.buildableArea, [
    { x: 7000, y: 13000 }, { x: 21000, y: 13000 }, { x: 21000, y: 28000 }, { x: 7000, y: 28000 },
  ]), true);
  assert.equal(isFootprintWithinBuildableArea(model.buildableArea, [
    { x: 5000, y: 11000 }, { x: 23000, y: 11000 }, { x: 23000, y: 30000 }, { x: 5000, y: 30000 },
  ]), false);
});

test("DXF-06 distinguishes existing objects and enforces retained-object avoidance", async () => {
  const source = await readFile("tests/fixtures/dxf/14_existing_objects.dxf", "utf8");
  const model = parseDxf(source);
  assert.equal(model.boundary.layer, "SITE_BOUNDARY");
  assert.equal(model.boundary.areaSquareMeters, 660);
  assert.equal(model.boundary.perimeterMeters, 104);
  assert.ok(model.stats.circleCount >= 4);
  assert.deepEqual(model.existingObjects.map((object) => object.type).sort(), ["building", "tree", "tree", "wall", "water"]);
  assert.equal(model.existingObjects.find((object) => object.type === "building")?.areaSquareMeters, 56);
  assert.equal(model.existingObjects.find((object) => object.type === "water")?.widthMeters, 1.2);
  assert.ok(model.existingObjects.every((object) => object.defaultAction === "keep"));
  assert.match(model.previewSvg, /data-existing-object="building"/);
  assert.match(model.previewSvg, /data-existing-object="building"><polygon[^>]+fill="#b8b8b8"[^>]+stroke="#111111"/);
  assert.match(model.previewSvg, />现状建筑<\/text>/);
  assert.match(model.previewSvg, /data-existing-object="tree"/);
  assert.match(model.previewSvg, /data-existing-object="water"/);
  assert.match(model.previewSvg, /data-existing-object="wall"/);
  const footprint = [{ x: 4000, y: 27000 }, { x: 9000, y: 27000 }, { x: 9000, y: 33000 }, { x: 4000, y: 33000 }];
  assert.equal(isFootprintClearOfRetainedObjects(footprint, model.existingObjects), false);
  assert.equal(isFootprintClearOfRetainedObjects(footprint, model.existingObjects, { "building-1": "remove" }), true);
});

test("DXF-07 reads contours, elevation points and reports terrain review risks", async () => {
  const source = await readFile("tests/fixtures/dxf/15_sloped_contour_site.dxf", "utf8");
  const expected = JSON.parse(await readFile("tests/fixtures/dxf/15_sloped_contour_site.expected.json", "utf8"));
  const model = parseDxf(source);
  assert.equal(model.boundary.areaSquareMeters, expected.site_area_m2);
  assert.equal(model.terrainAnalysis.contourCount, expected.contour_count);
  assert.deepEqual(model.terrainAnalysis.contourElevationsMeters, expected.contour_elevations_m);
  assert.equal(model.terrainAnalysis.elevationPoints.length, expected.elevation_point_count);
  assert.equal(model.terrainAnalysis.minimumElevationMeters, expected.minimum_elevation_m);
  assert.equal(model.terrainAnalysis.maximumElevationMeters, expected.maximum_elevation_m);
  assert.equal(model.terrainAnalysis.elevationDifferenceMeters, expected.site_elevation_difference_m);
  assert.equal(model.terrainAnalysis.slopeDirection, expected.slope_direction);
  assert.equal(model.terrainAnalysis.manualReviewRequired, true);
  assert.deepEqual(model.terrainAnalysis.warnings, expected.expected_warnings);
  assert.equal((model.previewSvg.match(/data-terrain="contour"/g) ?? []).length, 5);
  assert.equal((model.previewSvg.match(/data-terrain="elevation-point"/g) ?? []).length, 6);
  assert.equal((model.previewSvg.match(/data-elevation-symbol="triangle"/g) ?? []).length, 6);
  assert.equal((model.previewSvg.match(/data-terrain="elevation-band"/g) ?? []).length, 5);
  assert.doesNotMatch(model.previewSvg, /data-terrain="elevation-point"><circle/);
  assert.match(model.previewSvg, /fill="#bfe0b8"/);
  assert.match(model.previewSvg, /fill="#f4c44f"/);
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
