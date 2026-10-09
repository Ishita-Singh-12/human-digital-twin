import { NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body;
  try { body = await req.json(); }
  catch { return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 }); }
  const bpm = body?.bpm;
  if (typeof bpm !== "number" || !Number.isFinite(bpm) || bpm < 30 || bpm > 220) {
    return NextResponse.json({ success: false, error: "BPM must be between 30 and 220" }, { status: 400 });
  }
  const root = path.resolve(process.env.HDT_PROJECT_ROOT || path.join(process.cwd(), "../.."));
  const venv = path.join(root, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
  const python = process.env.HDT_PYTHON || (fs.existsSync(venv) ? venv : process.platform === "win32" ? "python" : "python3");
  const script = path.resolve(process.env.HDT_MODEL_SCRIPT || path.join(root, "ml/main.py"));
  return new Promise<Response>((resolve) => {
    const child = spawn(python, [script, String(bpm), "--json"], { cwd: root, env: process.env, shell: false });
    let stdout = "", stderr = "", settled = false;
    const finish = (payload: object, status = 200) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(NextResponse.json(payload, { status }));
    };
    const timer = setTimeout(() => { child.kill(); finish({ success: false, error: "Model timed out" }, 504); }, 30000);
    child.stdout.on("data", (chunk) => { stdout += chunk; if (stdout.length > 65536) { child.kill(); finish({ success: false, error: "Model output exceeded limit" }, 500); } });
    child.stderr.on("data", (chunk) => { stderr = (stderr + chunk).slice(-4096); });
    child.on("error", () => finish({ success: false, error: "Python unavailable. Set HDT_PYTHON or install the project virtual environment." }, 503));
    child.on("close", (code) => {
      if (code !== 0) {
        console.error("Model failed", stderr);
        return finish({ success: false, error: "Model failed. Check dataset configuration and server logs." }, 500);
      }
      try {
        const result = JSON.parse(stdout);
        // Legacy text is neutral, never relabeled as a Healthy/Not Healthy diagnosis.
        finish({ success: true, result, output: `Research baseline only\nValidation accuracy: ${(result.accuracy * 100).toFixed(1)}%\n${result.disclaimer}` });
      } catch { finish({ success: false, error: "Invalid model response" }, 500); }
    });
  });
}
