# ELNUBY HR — مرحلة العقود والتعيينات

تمت إضافة طبقة العقود والتكليفات المؤقتة مع قواعد تواريخ أساسية.

## العقود
- عقد دائم أو محدد المدة عبر contract_type.
- تاريخ بداية ونهاية.
- حالة العقد: مسودة، ساري، منتهٍ، منتهى، مجدد.
- منع نهاية تسبق البداية على مستوى قاعدة البيانات والـAPI.
- سجل العقد مرتبط بالموظف.
- إنشاء العقد يسجل حدثًا في السجل الوظيفي.

## التكليفات
تم تجهيز جدول employee_delegations للتكليف المؤقت بالمشروع مع تاريخ بداية ونهاية وسبب وحالة.

## المسارات الجديدة
- employee_contracts
- create_employee_contract

## الاختبارات
Employment contracts/assignments PASS
Existing contract/security/operational/auth-offline/notifications/monthly-reports/employee-profile tests PASS
