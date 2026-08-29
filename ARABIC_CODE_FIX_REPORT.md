# إصلاح النسخة العربية

تمت إعادة جميع الأسماء البرمجية الداخلية إلى أسماء ASCII/إنجليزية حتى لا تتسبب الترجمة العربية في كسر TypeScript/Next.js.

- HR_MANAGER بدل ترجمة الدور داخل identifier/value.
- PENDING_HR بدل ترجمة الحالة داخل identifier/value.
- writeAuditLog بدل ترجمة اسم الدالة.
- decideLeaveHR بدل ترجمة اسم الدالة.
- ExcelCenter وdownloadExcel وexportExcel وimportExcel وparseExcel وtemplateExcel للأسماء البرمجية الداخلية.
- أبقيت النصوص المعروضة للمستخدم بالعربية.
- إزالة آخر ظهور لعبارة GPS من واجهة المستخدم.
- إزالة أسماء الجداول التقنية من النصوص الظاهرة للمستخدم.

التحقق:
- تحليل Syntax لـ 41 ملف TS/TSX: PASS
- npm test: PASS
