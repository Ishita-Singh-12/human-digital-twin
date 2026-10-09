# Richer-signal upgrade: evidence, not a diagnosis

## Source and features
QoL_Stress 1.0.0, Calvo/Cejudo/Martin, CC BY 4.0:
https://physionet.org/content/qol-stress/1.0.0/

The release contains raw ~30-second ECG waveforms, HR time series and EDA
records. It contains no raw PPG or supplied RR intervals. We derive RR intervals
from ECG with NeuroKit2 and compute mean RR, SDNN, RMSSD, pNN50, RR variation
and median instantaneous HR. Do not calculate long-window LF/HF from these
short recordings. 18 waveforms contain malformed '-' tokens and 3 fail RR
quality checks; they are excluded, not interpolated.

250 Hz is supported by Fitbit's Web API data dictionary (samplingFrequencyHz):
https://assets.ctfassets.net/0ltkef2fmze1/45IN5bvBS827grKEsA8ZB0/648f3778acc936961f0572590c005ef0/Fitbit-Web-API-Data-Dictionary-Downloadable-Version-2.pdf
The release itself omits sampling frequency. Most recordings have ~7500
samples, consistent with this 30-second interpretation. Extraction takes an
explicit --sampling-rate option. ECG amplitude units are not needed for RR.

EDA features: mean, median, standard deviation, interquartile range and range
of valid skin-conductance measurements. Repeated/irregular time_sec values
are preserved; we do not invent a one-second clock or infer sampling frequency.
Device 'activation', identifiers, time of day, phase metadata, questionnaire
scores, demographics and result-classification metadata are not model inputs.

## Validation
Nested 5-fold outer / 3-fold inner StratifiedGroupKFold, seed 42. All observations
from one participant remain in a single fold. Scaling and classifier selection
(logistic regression, RBF SVM or constrained random forest) happen only inside
training data. No per-person baseline subtraction using test phase labels.

Same-cohort comparison, both valid ECG and EDA phases, 44 people / 88 records:
- BPM: 54.5% balanced accuracy
- HRV: 44.3%
- EDA: 65.9%
- HRV + EDA: 59.1%

This ECG-quality-selected cohort is NOT the headline deployment estimate.
EDA on all paired valid EDA participants: 60 people / 120 records, 56.7%
balanced accuracy. Confusion matrix [[30,30],[22,38]] (rows true relax/stress).
Subject-bootstrap 95% interval: 49.2%-64.2%, conditional on out-of-fold
predictions. The interval includes chance. It does not cover all model-selection,
sensor-domain or real-world uncertainty. Extra outer-fold seeds in this paired
balanced dataset yield the same allocation/predictions and are not independent
replications. The final trained artifact is selected with grouped inner CV on
all training subjects; nested evaluation measures the selection procedure,
not an independent test of that final fitted artifact.

## Honest conclusion
The richer research pipeline is implemented, but this release does not establish
reliable personal stress prediction. HRV did not improve this baseline. The
stronger EDA result on the smaller selected cohort must not be cherry-picked.
The labels are sequential controlled experimental phases, not diagnoses; order,
protocol and lab effects can confound them. ECG occurs after tasks. Dataset
size is small and healthy-adult-only. Daily wearable signals and another
hardware sensor may differ from these data. EDA inference needs a comparable
resting ~2-minute window with valid readings in microsiemens. No calibrated
confidence or health verdict is returned.

## Pipeline requirements
Current Wear OS app sends BPM/steps/calories/sleep only. It has not been tested
end to end. EDA requires supported skin-conductance hardware or a research
sensor/import, and a new sender/storage path for signal windows. Instantaneous
BPM cannot substitute for EDA, and averaged watch BPM cannot create RR intervals.
Real HRV inference would require validated ECG/beat-to-beat RR acquisition,
which many watches do not expose. The API rejects missing EDA arrays instead
of synthesizing signals. The supplied endpoint accepts direct research input
but does not pretend the current Appwrite/watch store is upgraded.

## Reproduce and use
```sh
python ml/prepare_dataset.py
# Download/extract the source ZIP to a scratch folder, then:
python ml/extract_features.py /path/to/release/data
python ml/evaluate_upgrade.py
python ml/check_robustness.py
python ml/stress_model.py train
```
Run the EDA predictor via stdin JSON containing eda_readings, or POST
{"mode":"eda_window","eda_readings":[...]} to /api/run-model. Readings must be
valid, finite microsiemens, from one window, not an arbitrary list of demo BPM.
Default requests with bpm use the separately labeled research baseline.

Only load locally trained artifacts. joblib/pickle files from unknown sources
are executable content, not safe model uploads. No artifact is committed.
