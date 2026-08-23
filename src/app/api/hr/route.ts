import {NextResponse} from 'next/server';

export async function POST(req:Request){
  const url=process.env.GOOGLE_APPS_SCRIPT_URL;
  if(!url) return NextResponse.json({ok:false,error:'GOOGLE_APPS_SCRIPT_URL is not configured'},{status:500});
  try{
    const body=await req.text();
    const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body,redirect:'follow',cache:'no-store'});
    const text=await r.text();
    return new NextResponse(text,{status:r.ok?200:r.status,headers:{'Content-Type':'application/json'}});
  }catch{return NextResponse.json({ok:false,error:'Backend unavailable'},{status:502});}
}
