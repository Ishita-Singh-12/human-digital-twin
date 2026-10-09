# WESAD lab stress benchmark

Official WESAD archive, Philip Schmidt and Attila Reiss (2018), downloaded from
https://ubi29.informatik.uni-siegen.de/usi/data_wesad.html and its linked archive
https://uni-siegen.sciebo.de/s/HGdUkoNlW1Ub0Gx . Reference:
Introducing WESAD, a Multimodal Dataset for Wearable Stress and Affect Detection,
https://doi.org/10.1145/3242969.3242985 . Respect dataset acknowledgment and
academic/non-commercial-use restrictions. Raw archive is not redistributed here.

## Method
15 participants, 535 non-overlapping 60-second windows, entirely within one
phase. Binary target: stress phase (2) versus baseline/amusement (1/3). Ignore
transients, meditation, and invalid labels. 375 non-stress / 160 stress windows.
No identifiers, protocol timing, questionnaire values or phase metadata are
features. All participants have both classes; no participant is excluded.

Wrist EDA/temp sampled at 4Hz and BVP at 64Hz, chest at 700Hz (documented in
official readme and https://archive.ics.uci.edu/dataset/465/wesad).
Mean/std/min/max/IQR/slope/absolute differences for each signal. Bandpass and
peak-derived pulse rate/interval features from BVP and ECG, respiration peak
count per minute. Chest EDA/temp/resp downsampled for statistics; ECG uses
native sampling. These peak features are research proxies, not validated HRV.
The synchronized official numeric pickle archive is parsed with restricted
numpy-only globals; arbitrary uploaded pickle files are not accepted.

Nested five outer / three inner StratifiedGroupKFold, seed 42. Scaling and
selection among logistic regression, RBF SVM and constrained random forest
fit inside each training split. Same complete cohort for all feature sets.
Full subject lists in each train/test fold are in wesad_evaluation.json.
Window observations from a participant never cross train/test boundaries.

## Results
| Features | Balanced accuracy | Ordinary accuracy | Conditional 95% subject-bootstrap interval |
|---|---:|---:|---:|
| Wrist EDA | 75.6% | 74.6% | 66.7%-84.6% |
| Wrist EDA + BVP + temperature | 85.2% | 87.9% | 78.0%-91.5% |
| Wrist + chest EDA/ECG/temp/resp | 84.3% | 86.7% | 75.7%-91.5% |

Chest did not improve this comparison. Do not cherry-pick ordinary accuracy as
balanced accuracy. Bootstrap resamples participants with their OOF predictions;
it is conditional on model selection, not an external validation interval.
This is a small lab benchmark. Window counts do not create 535 independent
people. Sequential protocol effects, age/gender diversity, hardware domain shift
and unmeasured real-world confounding remain. The original paper used different
features and densely overlapping windows; results are not a replication of it.

This is a different dataset, target and windowing scheme than QoL_Stress 56.7%.
Do not write "improved from 56.7% to 85.2%" as a like-for-like accuracy increase.
This demonstrates richer-signal lab classification, not personal-health insights.

## Deployment boundary
WESAD is an offline reproducible evaluation track. The existing dashboard's
QoL_Stress EDA predictor remains separate and honestly labeled. No WESAD model
is silently substituted into that different input API. Current Wear OS sender
has no EDA/BVP waveform/temp channel and cannot drive these features. Real-device
signal acquisition, matching window schema and external validation are needed
before any new inference integration. No diagnosis or advice is returned.

## Reproduce
python ml/wesad_features.py /path/to/WESAD.zip --output ml/data/wesad_features.csv
python ml/wesad_evaluate.py
On small-memory systems, extract each --subject SX separately, concatenate the
CSV files, then run evaluation. Hold the full 15-person cohort fixed.
