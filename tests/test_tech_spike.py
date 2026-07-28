import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from tools.tech_spike import FIXTURES, OUTPUT, VALID_SITES, generate_fixtures, metrics, parse_site_boundary, run


class TechSpikeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        generate_fixtures()

    def test_eight_standard_dxf_files_parse(self):
        self.assertEqual(len(VALID_SITES), 8)
        for name in VALID_SITES:
            points = parse_site_boundary(FIXTURES / f"{name}.dxf")
            self.assertGreater(metrics(points)["areaMm2"], 0)

    def test_rectangle_metrics_are_exact(self):
        value = metrics(parse_site_boundary(FIXTURES / "01_rectangle_18x24m.dxf"))
        self.assertEqual(value["areaMm2"], 432_000_000)
        self.assertEqual(value["perimeterMm"], 84_000)

    def test_open_boundary_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "SITE_BOUNDARY_NOT_CLOSED"):
            parse_site_boundary(FIXTURES / "invalid_open_boundary.dxf")

    def test_multiple_boundaries_are_rejected(self):
        with self.assertRaisesRegex(ValueError, "SITE_BOUNDARY_COUNT_INVALID"):
            parse_site_boundary(FIXTURES / "invalid_multiple_boundaries.dxf")

    def test_all_toolchain_artifacts_are_nonempty(self):
        run()
        for filename in ["site-preview.png", "house-massing.obj", "concept-package.pptx", "concept-package.pdf", "validation-report.json"]:
            path = OUTPUT / filename
            self.assertTrue(path.exists(), filename)
            self.assertGreater(path.stat().st_size, 100, filename)


if __name__ == "__main__":
    unittest.main()
