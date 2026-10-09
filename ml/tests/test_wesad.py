import sys,unittest,pickle,io
from pathlib import Path
import numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from wesad_features import stats,NumericUnpickler,pulse_features
class WesadTests(unittest.TestCase):
 def test_statistics(self):
  r=stats(np.arange(240)/4,'x',4);self.assertAlmostEqual(r['x_slope'],1)
 def test_numeric_roundtrip(self):
  data={'label':np.arange(4)};self.assertTrue(np.array_equal(NumericUnpickler(io.BytesIO(pickle.dumps(data,protocol=2))).load()['label'],data['label']))
 def test_rejects_arbitrary_classes(self):
  with self.assertRaises(pickle.UnpicklingError):NumericUnpickler(io.BytesIO(pickle.dumps(Path('/tmp')))).load()
 def test_signal_features(self):
  signal=np.sin(2*np.pi*1.2*np.arange(64*60)/64);r=pulse_features(signal,64,'bvp');self.assertAlmostEqual(r['bvp_hr'],72,delta=2)
