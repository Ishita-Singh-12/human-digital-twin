# QoL_Stress research baseline

Source: https://physionet.org/content/qol-stress/1.0.0/
Authors: Amaia Calvo, Ander Cejudo, Cristina Martin. Version 1.0.0.
License: CC BY 4.0. Full terms are in QOL_STRESS_LICENSE.txt.

qol_stress.csv is a derived subset of data/ecg.csv: heart_rate, a deterministic
remapping of the pseudonymous username to P001..P066, and phase mapped as
relax=0, stress=1. No synthetic measurements or labels were added.
Original ecg.csv SHA256:
a8c668be74859a816d299b450b5094f7c47d9f0b97d3691aa610ed37b9e8fcf5

132 measurements from 66 participants. Heart rate is associated with short
ECG recordings taken after each experimental phase, not an all-day watch
signal. Steps and sleep are not available as labeled model inputs. Calories
in the upstream daily summaries are not equivalent to phase-level stress
features and are not used here.

Validation is participant-disjoint to avoid leakage between the two records
from each person. BPM alone performs around chance. This is a transparent
class-project baseline, not a usable medical or mental-health classifier.
No accuracy claim should be interpreted as probability of a user's health.
