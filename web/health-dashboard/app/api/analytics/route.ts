import { NextRequest,NextResponse } from "next/server";
export async function GET(req:NextRequest) {
  const base=process.env.GET_HEALTH_URL;
  if (!base) return NextResponse.json({error:"Persistent Appwrite service is not configured"},{status:503});
  const auth=req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return NextResponse.json({error:"Sign in to view stored history"},{status:401});
  const days=req.nextUrl.searchParams.get("days") || "1";
  if (!["1","7","30"].includes(days)) return NextResponse.json({error:"Invalid range"},{status:400});
  try {
    const url=new URL(base);url.pathname=url.pathname.replace(/\/get-health-data\/?$/,"/analytics");url.search=`days=${days}&bucket=${days==="1"?"hour":"day"}`;
    const response=await fetch(url,{headers:{"x-hdt-jwt":auth.slice(7)},cache:"no-store",signal:AbortSignal.timeout(15000)});
    return NextResponse.json(await response.json(),{status:response.status});
  }catch{return NextResponse.json({error:"Stored history unavailable"},{status:502});}
}
