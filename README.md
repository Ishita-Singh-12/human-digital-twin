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

Use a Node server with Python and model files, or the Docker setup. The Appwrite
function now uses timestamped, private database documents and descriptive hourly/daily
aggregates. See `appwrite_function/SETUP.md` for required schema, indexes, authenticated
execution and dashboard platform configuration. Deployment alone does not provision
Appwrite. The dashboard signs into Appwrite before reading personal data; demo mode
remains clearly labeled. The Wear OS sender still needs authenticated session handling
and physical-device testing; anonymous legacy POSTs are deliberately rejected.

See `ml/MODEL_CARD.md` for the richer ECG/EDA pipeline and its limits.
Train its local artifact with `.venv/bin/python ml/stress_model.py train`.
EDA needs separate supported hardware; the current watch does not supply it.

## Dependency maintenance

Use npm with the checked-in package-lock.json. The stale alternate pnpm lock
was removed so it cannot silently reinstall the old vulnerable tree. The
security update pins Next 15.5.27, React 19.3.0, Axios 1.20.0, Tailwind 4.3.3
and PostCSS 8.5.29, with reviewed lodash/browserslist/PostCSS overrides for
transitive advisories. `npm ci --legacy-peer-deps` and `npm audit` passed with
zero known npm vulnerabilities at update time. This is not an overall security
audit: authentication, durable health-data storage and deployment remain work.
