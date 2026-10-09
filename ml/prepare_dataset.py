"""Download the published release and reproduce the bundled subset."""
import csv
import hashlib
import io
from pathlib import Path
import urllib.request
import zipfile

URL = "https://physionet.org/content/qol-stress/get-zip/1.0.0/"
EXPECTED = "a8c668be74859a816d299b450b5094f7c47d9f0b97d3691aa610ed37b9e8fcf5"
TARGET = Path(__file__).resolve().parent / "data"

def prepare():
    with urllib.request.urlopen(URL, timeout=60) as response:
        archive = zipfile.ZipFile(io.BytesIO(response.read()))
    name = next(n for n in archive.namelist() if n.endswith("/data/ecg.csv"))
    raw = archive.read(name)
    if hashlib.sha256(raw).hexdigest() != EXPECTED:
        raise ValueError("Publisher CSV checksum changed; inspect before replacing data")
    rows = list(csv.DictReader(io.StringIO(raw.decode())))
    if len(rows) != 132 or {r["phase"] for r in rows} != {"relax", "stress"}:
        raise ValueError("Unexpected dataset schema or labels")
    ids = {u: f"P{i + 1:03}" for i, u in enumerate(sorted({r["username"] for r in rows}))}
    if len(ids) != 66: raise ValueError("Unexpected subject count")
    TARGET.mkdir(exist_ok=True)
    with (TARGET / "qol_stress.csv").open("w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["heart_rate", "subject_id", "stress_label"])
        for row in rows:
            writer.writerow([row["heart_rate"], ids[row["username"]], int(row["phase"] == "stress")])
    license_name = next(n for n in archive.namelist() if n.endswith("/LICENSE.txt"))
    (TARGET / "QOL_STRESS_LICENSE.txt").write_bytes(archive.read(license_name))
    print(f"Prepared {len(rows)} measurements from {len(ids)} subjects")

if __name__ == "__main__": prepare()
