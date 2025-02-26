import { NextResponse } from 'next/server';

const callRecords = [
  {
    date: '2024-03-15',
    mobile: '966501234567',
    summary: 'مناقشة تفاصيل المشروع الجديد وتحديد موعد الاجتماع القادم',
  },
  {
    date: '2024-03-17',
    mobile: '966501234567',
    summary: 'متابعة سير العمل وتحديث الخطة التنفيذية',
  },
  {
    date: '2024-03-14',
    mobile: '966512345678',
    summary: 'استفسار عن الخدمات المتاحة وطلب عرض سعر',
  },
  {
    date: '2024-03-16',
    mobile: '966512345678',
    summary: 'تأكيد موعد التسليم والاتفاق على التفاصيل النهائية',
  },
  {
    date: '2024-03-18',
    mobile: '966512345678',
    summary: 'مراجعة المستندات المطلوبة وإكمال الإجراءات',
  },
  {
    date: '2024-03-15',
    mobile: '966523456789',
    summary: 'طلب دعم فني وحل مشكلة تقنية',
  },
  {
    date: '2024-03-17',
    mobile: '966523456789',
    summary: 'متابعة حالة الطلب السابق وتأكيد الحل',
  },
  {
    date: '2024-03-14',
    mobile: '966534567890',
    summary: 'تقديم شكوى حول جودة الخدمة',
  },
  {
    date: '2024-03-16',
    mobile: '966534567890',
    summary: 'متابعة الشكوى السابقة وتقديم الحلول المناسبة',
  },
  {
    date: '2024-03-15',
    mobile: '966545678901',
    summary: 'استفسار عن المنتجات الجديدة',
  },
  {
    date: '2024-03-16',
    mobile: '966545678901',
    summary: 'طلب معلومات إضافية عن الأسعار والعروض',
  },
  {
    date: '2024-03-18',
    mobile: '966545678901',
    summary: 'تأكيد الطلب وترتيب موعد التسليم',
  },
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const number = searchParams.get('number');

  if (!number) {
    return NextResponse.json({ error: 'Number parameter is required' }, { status: 400 });
  }

  const filteredRecords = callRecords
    .filter((record) => record.mobile.includes(number))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3);

  return NextResponse.json(filteredRecords);
}
