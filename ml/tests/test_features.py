import json
from pathlib import Path
import sys
import tempfile
import unittest

ML=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ML))
from extract_features import eda_features, rr_features
from stress_model import train, predict, training_frame

class FeatureTests(unittest.TestCase):
    def test_regular_rr(self):
        f=rr_features([1000]*30)
        self.assertEqual(f['rmssd_ms'],0)
        self.assertEqual(f['median_hr_bpm'],60)
    def test_eda_summary(self):
        f=eda_features([1]*12)
        self.assertEqual(f['eda_mean'],1)
        self.assertEqual(f['eda_std'],0)
    def test_bad_signals(self):
        for x in [[],[1]*9,[float('nan')]*20,[-1]*20]:
            with self.assertRaises(ValueError): eda_features(x)
        with self.assertRaises(ValueError): rr_features([100]*30)
    def test_pairing(self):
        f=training_frame()
        self.assertEqual(len(f),120)
        self.assertEqual(f.subject_id.nunique(),60)
        self.assertTrue((f.groupby('subject_id').stress_label.nunique()==2).all())
    def test_artifact_roundtrip(self):
        with tempfile.TemporaryDirectory() as d:
            p=Path(d)/'model.joblib';train(p)
            r=predict([1,1.2,1.1,1.4,1.3,1.2,1.4,1.3,1.1,1.2,1.4],p)
            self.assertIn(r['prediction'],[0,1])
            self.assertIn('disclaimer',r)
            self.assertNotIn('confidence',r)
            json.dumps(r,allow_nan=False)
    def test_missing_artifact(self):
        with self.assertRaises(FileNotFoundError): predict([1]*12,'/tmp/no-such-hdt-artifact.joblib')
