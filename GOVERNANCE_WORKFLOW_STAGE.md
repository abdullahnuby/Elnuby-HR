# مرحلة حوكمة وسير الاعتماد

تم ربط مركز الاعتمادات بطلبات الإجازات والأذونات، وإضافة قواعد منع اعتماد الموظف لطلبه، مع تسجيل قرارات الاعتماد في سجل التدقيق.

الإجراءات الجديدة:
- approval_inbox
- approval_requests
- create_approval_request

قبل الإنتاج يجب تطبيق migration: `supabase/migrations/20260829_hr_governance_workflow.sql`.
