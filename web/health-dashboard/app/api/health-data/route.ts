import { NextResponse } from "next/server";
import axios from "axios";

export async function GET() {
  const url = process.env.GET_HEALTH_URL;
  if (!url) return NextResponse.json({ error: "Set GET_HEALTH_URL to your Appwrite health-data endpoint" }, { status: 503 });
  try {
    const response = await axios.get(url, { timeout: 10000 });
    return NextResponse.json(response.data);
  } catch {
    return NextResponse.json({ error: "Health-data service unavailable" }, { status: 502 });
  }
}
