import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

// 1. دالة جلب البيانات (GET)
export async function GET() {
  const { data, error } = await supabase.from('employees').select('*');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// 2. دالة إرسال البيانات (POST)
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { data, error } = await supabase
      .from('employees') 
      .insert([body])
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data }, { status: 201 });

  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}