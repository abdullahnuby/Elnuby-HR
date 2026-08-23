import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function GET() {
  // إضافة .schema('hr') للوصول إلى الجداول الصحيحة
  const { data, error } = await supabase.schema('hr').from('employees').select('*');
  
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // 1. استبعاد حقل action الوهمي الخاص بالواجهة الأمامية
    const { action, ...employeeData } = body;

    // 2. استخدام .schema('hr') لتوجيه الإدخال للمكان الصحيح
    const { data, error } = await supabase
      .schema('hr')
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