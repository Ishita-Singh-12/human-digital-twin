"""Reproducible BPM-only research baseline, not a health diagnosis."""
import argparse
import json
import os
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, balanced_accuracy_score
from sklearn.model_selection import StratifiedGroupKFold, cross_val_predict
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

DEFAULT_DATASET = Path(__file__).resolve().parent / "data" / "qol_stress.csv"


def load_dataset(path):
    frame = pd.read_csv(path)
    required = {"heart_rate", "subject_id", "stress_label"}
    if not required.issubset(frame.columns):
        raise ValueError("Dataset needs heart_rate, subject_id and stress_label columns")
    if frame[list(required)].isna().any().any():
        raise ValueError("Dataset contains missing required values")
    heart_rate = pd.to_numeric(frame.heart_rate, errors="raise")
    if not np.isfinite(heart_rate).all() or not heart_rate.between(30, 220).all():
        raise ValueError("Dataset BPM must be finite and between 30 and 220")
    if set(frame.stress_label.unique()) != {0, 1}:
        raise ValueError("Dataset needs both labels: 0=relax, 1=stress")
    if frame.subject_id.nunique() < 5:
        raise ValueError("Dataset needs at least five subjects for grouped validation")
    return frame


def run(bpm=None, dataset=None):
    frame = load_dataset(dataset or os.environ.get("HDT_DATASET_PATH", DEFAULT_DATASET))
    x = frame[["heart_rate"]]
    y = frame.stress_label
    model = make_pipeline(StandardScaler(), LogisticRegression(random_state=42, class_weight="balanced"))
    folds = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=42)
    predicted = cross_val_predict(model, x, y, groups=frame.subject_id, cv=folds)
    result = {
        "dataset": "QoL_Stress 1.0.0",
        "feature": "heart_rate",
        "accuracy": float(accuracy_score(y, predicted)),
        "balanced_accuracy": float(balanced_accuracy_score(y, predicted)),
        "validation": "5-fold participant-disjoint cross-validation",
        "samples": len(frame),
        "subjects": int(frame.subject_id.nunique()),
        "disclaimer": "Research-only experimental phase estimate. Heart rate alone cannot diagnose mental health or distinguish exercise from stress.",
    }
    if bpm is not None:
        if not np.isfinite(bpm) or not 30 <= bpm <= 220:
            raise ValueError("BPM must be finite and between 30 and 220")
        model.fit(x, y)
        value = pd.DataFrame({"heart_rate": [bpm]})
        label = int(model.predict(value)[0])
        result.update(prediction=label, stress_state="stress-like" if label else "relax-like", stress_probability=float(model.predict_proba(value)[0, 1]))
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("bpm", nargs="?", type=float)
    parser.add_argument("--dataset", default=None)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    try:
        result = run(args.bpm, args.dataset)
    except (ValueError, OSError) as exc:
        parser.exit(1, f"Model error: {exc}\n")
    if args.json:
        print(json.dumps(result, allow_nan=False))
    else:
        print(f"Accuracy: {result['accuracy']:.4f}")
        if args.bpm is not None:
            print(f"Predicted Stress: {result['stress_state']}")
        print(result["disclaimer"])
