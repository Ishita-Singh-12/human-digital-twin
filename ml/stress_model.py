"""Richer-signal EDA stress-phase research model. Not clinically validated."""
import argparse
import json
import os
from pathlib import Path
import sys

import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import GridSearchCV, StratifiedGroupKFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression

from extract_features import EDA, eda_features
from evaluate_upgrade import GRID

ROOT = Path(__file__).resolve().parent
ARTIFACT = Path(os.environ.get("HDT_STRESS_MODEL_PATH", ROOT / "artifacts/eda_model.joblib"))
DISCLAIMER = "Experimental lab-phase model, not a mental-health diagnosis. Validation is modest and uncertain; do not use for medical decisions. EDA hardware is required."


def training_frame():
    frame = pd.read_csv(ROOT / "data/qol_features.csv").dropna(subset=EDA)
    paired = frame.groupby("subject_id").stress_label.nunique()
    return frame[frame.subject_id.isin(paired[paired == 2].index)]


def train(output=ARTIFACT):
    frame = training_frame()
    search = GridSearchCV(Pipeline([("scale", StandardScaler()), ("model", LogisticRegression())]), GRID,
                          scoring="balanced_accuracy", cv=StratifiedGroupKFold(n_splits=3, shuffle=True, random_state=42), n_jobs=1)
    search.fit(frame[EDA], frame.stress_label, groups=frame.subject_id)
    evaluation = json.loads((ROOT / "data/model_robustness.json").read_text())["eda_all_valid_paired"]
    artifact = {"model": search.best_estimator_, "features": EDA, "evaluation": evaluation,
                "dataset": "QoL_Stress 1.0.0", "version": 1, "units": "microsiemens", "disclaimer": DISCLAIMER}
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(artifact, output)
    return {"saved": str(output), "model": type(search.best_estimator_.named_steps["model"]).__name__,
            "records": len(frame), "subjects": int(frame.subject_id.nunique()), "evaluation": evaluation, "disclaimer": DISCLAIMER}


def predict(readings, artifact_path=ARTIFACT):
    if not Path(artifact_path).is_file():
        raise FileNotFoundError("Run python ml/stress_model.py train to create the local model artifact")
    # Load only the locally trained/trusted artifact. Pickle is not a safe upload format.
    artifact = joblib.load(artifact_path)
    if artifact["version"] != 1 or artifact["features"] != EDA:
        raise ValueError("Unsupported model artifact")
    features = eda_features(readings)
    model = artifact["model"]
    x = pd.DataFrame([features], columns=EDA)
    label = int(model.predict(x)[0])
    # No confidence number: SVM margin/probability is not calibrated personal confidence.
    return {"mode": "eda_window", "stress_state": "stress-like" if label else "relax-like", "prediction": label,
            "features": features, "valid_readings": len(readings), "evaluation": artifact["evaluation"],
            "dataset": artifact["dataset"], "disclaimer": DISCLAIMER}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["train", "predict"])
    parser.add_argument("--artifact", default=str(ARTIFACT))
    args = parser.parse_args()
    try:
        if args.action == "train": result = train(args.artifact)
        else:
            payload = json.load(sys.stdin)
            if not isinstance(payload, dict) or "eda_readings" not in payload: raise ValueError("eda_readings array required")
            result = predict(payload["eda_readings"], args.artifact)
        print(json.dumps(result, allow_nan=False))
    except (ValueError, OSError, KeyError, TypeError) as exc:
        parser.exit(1, f"Research model error: {exc}\n")
