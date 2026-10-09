# Human digital twin

A class-project wearable dashboard: a Kotlin Wear OS app sends metrics to an
Appwrite function; a Next.js dashboard displays them; a Python baseline
explores whether BPM alone separates experimental relax/stress phases.

## Run the dashboard locally

Requirements: Python 3.10+, Node.js 20+, npm. No personal machine paths needed.

```sh
python3 -m venv .venv
# macOS/Linux:
.venv/bin/pip install -r ml/requirements.txt
# Windows: .venv\Scripts\pip install -r ml\requirements.txt
.venv/bin/python ml/main.py 72 --json
cd web/health-dashboard
npm install --legacy-peer-deps
cp .env.example .env.local
npm run dev
```

Windows: use `python` to create the environment, `.venv\Scripts\python` to run
the model, and copy `.env.example` to `.env.local` with your shell's copy command.
The checked-in CSV makes the model runnable offline after dependency install.

Set GET_HEALTH_URL in `.env.local` to your own Appwrite endpoint ending in
`/get-health-data`. Without it the data API returns a clear configuration error;
it does not silently invent live readings.

Optional server settings: HDT_PROJECT_ROOT, HDT_PYTHON, HDT_MODEL_SCRIPT and
HDT_DATASET_PATH. The defaults find `ml/main.py` relative to the dashboard
and use the root `.venv`, otherwise python3 on Unix or python on Windows.
Paths containing spaces work. The dataset defaults relative to the Python
script, not the shell's current directory. Custom datasets must have columns
heart_rate, subject_id, stress_label (0=relax, 1=stress).

## Wear OS app

Open `app/Demo` in Android Studio, install its requested SDKs and let Gradle
use Android Studio's JDK or JAVA_HOME. No machine-specific Java path is stored.
Set `HDT_HEALTH_BASE_URL` in `~/.gradle/gradle.properties`, as an environment
variable, or with `-PHDT_HEALTH_BASE_URL=https://your-function-host`.
The Wear OS app requires supported Health Services/Health Connect hardware
and permissions. Desktop setup does not simulate a physical watch.

## Dataset and honest limits

[QoL_Stress 1.0.0](https://physionet.org/content/qol-stress/1.0.0/), by Amaia
Calvo, Ander Cejudo and Cristina Martin, CC BY 4.0. See `ml/data/README.md`
for derivation and attribution. The bundled subset has 132 real ECG-associated
heart-rate observations from 66 participants with relax/stress phase labels.

The model uses only BPM. Steps, sleep and calories are display metrics, not
invented training features. Five-fold participant-disjoint validation is around
chance (48.5% in the tested setup). This model must not diagnose health, anxiety
or depression. A meaningful next stage needs richer time-window features and
matching labeled measurements. The API provides structured research results;
the legacy output is neutral and does not claim Healthy/Not Healthy.

## Tests and deployment

```sh
.venv/bin/python -m unittest discover -s ml/tests -v
cd web/health-dashboard
npx tsc --noEmit
npm run build
```

Use a Node server with Python and the model files available, or the supplied
Docker setup. Static hosting and edge runtimes cannot spawn Python. Appwrite
must be configured separately. The existing sample Appwrite function stores
values in process memory, so cold starts and multiple instances can lose or
split readings. It is not a durable, authenticated per-user health datastore.
The existing dashboard contains demo fallback metrics; its redesign must
clearly separate demo values from live data. UI redesign is pending selection.
