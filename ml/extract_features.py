"""Offline extraction: ECG time-domain HRV and per-phase EDA summaries.

250 Hz is documented by Fitbit-compatible export documentation and consistent
with ~7500 samples in a 30-second recording; this release omits a sample-rate
column. Invalid ECG token streams are not repaired or interpolated.
"""
import argparse
import csv
import hashlib
from pathlib import Path
import numpy as np
import pandas as pd
import neurokit2 as nk

HRV = ["mean_rr_ms", "sdnn_ms", "rmssd_ms", "pnn50", "rr_cv", "median_hr_bpm"]
EDA = ["eda_mean", "eda_median", "eda_std", "eda_iqr", "eda_range"]

def rr_features(rr):
    rr = np.asarray(rr, dtype=float)
    if len(rr) < 15 or not np.isfinite(rr).all() or np.any((rr < 300) | (rr > 2000)):
        raise ValueError("Need at least 15 finite RR intervals between 300 and 2000 ms")
    diff = np.diff(rr)
    return dict(zip(HRV, [rr.mean(), rr.std(ddof=1), np.sqrt(np.mean(diff ** 2)), np.mean(np.abs(diff) > 50), rr.std(ddof=1) / rr.mean(), 60000 / np.median(rr)]))


def eda_features(values):
    values = np.asarray(values, dtype=float)
    if values.ndim != 1 or len(values) < 10 or len(values) > 20000:
        raise ValueError("Need 10 to 20000 valid EDA readings in microsiemens")
    if not np.isfinite(values).all() or np.any((values < 0) | (values > 100)):
        raise ValueError("EDA readings must be finite and between 0 and 100 microsiemens")
    return dict(zip(EDA, [values.mean(), np.median(values), values.std(ddof=1), np.percentile(values,75)-np.percentile(values,25), np.ptp(values)]))


def ecg_features(waveform, hr, fs=250):
    values = np.array([float(v) for v in waveform.split()])
    if len(values) < 20 * fs or not np.isfinite(values).all(): raise ValueError("Incomplete or non-finite ECG")
    cleaned = nk.ecg_clean(values, sampling_rate=fs)
    _, info = nk.ecg_peaks(cleaned, sampling_rate=fs, correct_artifacts=False)
    peaks = info["ECG_R_Peaks"]
    rr = np.diff(peaks) / fs * 1000
    features = rr_features(rr)
    if abs(features["median_hr_bpm"] - hr) > max(15, hr * .25): raise ValueError("Detected HR disagrees with device HR")
    return features


def extract(source, output, fs=250):
    source = Path(source)
    raw = (source / "ecg.csv").read_bytes()
    expected = "a8c668be74859a816d299b450b5094f7c47d9f0b97d3691aa610ed37b9e8fcf5"
    if hashlib.sha256(raw).hexdigest() != expected: raise ValueError("ECG checksum mismatch")
    eda = pd.read_csv(source / "eda.csv")
    eda = eda[eda.valid_data.astype(str).str.lower().eq("true")].copy()
    groups = {}
    for (subject, phase), group in eda.groupby(["username", "phase"]):
        values = pd.to_numeric(group.scl_avg, errors="coerce").dropna().to_numpy()
        values = values[np.isfinite(values)]
        if len(values) >= 10:
            # Distribution summaries only: repeated/irregular time_sec is not a uniform clock.
            groups[(subject, phase)] = eda_features(values)
    rows = list(csv.DictReader(raw.decode().splitlines()))
    ids = {u: f"P{i + 1:03}" for i, u in enumerate(sorted({r["username"] for r in rows}))}
    result, quality = [], []
    for row in rows:
        subject, phase = row["username"], row["phase"]
        item = {"subject_id": ids[subject], "stress_label": int(phase == "stress"), "heart_rate": float(row["heart_rate"])}
        reason = "ok"
        try: item.update(ecg_features(row["waveform_samples"], item["heart_rate"], fs))
        except (ValueError, IndexError) as exc: reason = str(exc)
        item.update(groups.get((subject, phase), {}))
        quality.append({"subject_id":ids[subject], "phase":phase, "ecg_quality":reason, "has_eda":(subject,phase) in groups})
        result.append(item)
    pd.DataFrame(result).to_csv(output, index=False)
    pd.DataFrame(quality).to_csv(Path(output).with_name("feature_quality.csv"), index=False)
    print(pd.DataFrame(quality).ecg_quality.value_counts().to_string())

if __name__ == "__main__":
    p=argparse.ArgumentParser();p.add_argument("source");p.add_argument("--out",default=str(Path(__file__).parent/"data/qol_features.csv"));p.add_argument("--sampling-rate",type=int,default=250)
    a=p.parse_args();extract(a.source,a.out,a.sampling_rate)
