import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

// 1. دالة جلب البيانات (GET)
export async function GET() {
  const { data, error } = await supabase.from('employees').select('*');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // 1. استبعاد حقل 'action' (وأي حقول واجهة أخرى) من البيانات قبل الحفظ
    const { action, ...employeeData } = body;

    // 2. إرسال البيانات النظيفة فقط إلى Supabase
    const { data, error } = await supabase
      .from('employees') 
      .insert([employeeData])
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, data }, { status: 201 });

  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}