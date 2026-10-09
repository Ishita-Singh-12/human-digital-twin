import json
import os
from pathlib import Path
import subprocess
import sys
import unittest

ML = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ML))
from main import load_dataset, run

class ModelTests(unittest.TestCase):
    def test_bundled_dataset(self):
        frame = load_dataset(ML / "data/qol_stress.csv")
        self.assertEqual(len(frame), 132)
        self.assertEqual(frame.subject_id.nunique(), 66)
        self.assertEqual(frame.groupby("subject_id").stress_label.nunique().min(), 2)

    def test_json_from_unrelated_directory(self):
        result = subprocess.run([sys.executable, str(ML / "main.py"), "72", "--json"], cwd="/tmp", check=True, capture_output=True, text=True)
        parsed = json.loads(result.stdout)
        self.assertEqual(parsed["subjects"], 66)
        self.assertIn(parsed["prediction"], [0, 1])
        self.assertIn("disclaimer", parsed)

    def test_invalid_bpm(self):
        for value in [float("nan"), float("inf"), 0, 221]:
            with self.subTest(value=value), self.assertRaises(ValueError): run(value)

    def test_reproducibility(self):
        self.assertEqual(run(72), run(72))

if __name__ == "__main__": unittest.main()
