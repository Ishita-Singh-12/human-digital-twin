import { NextRequest, NextResponse } from "next/server";
export async function GET(req: NextRequest) {
  const url = process.env.GET_HEALTH_URL;
  if (!url) return NextResponse.json({error:"Set GET_HEALTH_URL to your persistent Appwrite function"},{status:503});
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return NextResponse.json({error:"Sign in to view your stored readings"},{status:401});
  try {
    const response = await fetch(url,{headers:{"x-hdt-jwt":auth.slice(7)},cache:"no-store",signal:AbortSignal.timeout(10000)});
    const data=await response.json();return NextResponse.json(data,{status:response.status});
  } catch {return NextResponse.json({error:"Health-data service unavailable"},{status:502});}
}
