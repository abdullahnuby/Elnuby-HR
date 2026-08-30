import { supabase, success, errorResponse, generateId, nowISO } from './core';
import type { SessionContext } from './core';

const MANAGEMENT = ['SYSTEM_ADMIN','HR_MANAGER','SECTOR_MANAGER','PROJECT_MANAGER'];
const HR = ['SYSTEM_ADMIN','HR_MANAGER'];
const statuses = ['DRAFT','SUBMITTED','MANAGER_APPROVED','HR_CLOSED','CANCELLED'];

function canManage(session: SessionContext) { return MANAGEMENT.includes(session.user.role); }
function canHR(session: SessionContext) { return HR.includes(session.user.role); }
function num(v: unknown) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

export async function performanceList(session: SessionContext, body: Record<string, unknown>) {
  if (!canManage(session)) return errorResponse('ليس لديك صلاحية عرض تقييمات الأداء', 403);
  let q = supabase.from('performance_reviews').select('*,employees(name,employee_id,job_title,department),performance_templates(name)').order('period_start',{ascending:false});
  if (body.employee_id) q = q.eq('employee_id', String(body.employee_id));
  if (body.status && statuses.includes(String(body.status))) q = q.eq('status', String(body.status));
  const { data, error } = await q.limit(200);
  if (error) { console.error('performanceList',error); return errorResponse('تعذر تحميل تقييمات الأداء',500); }
  return success(data || []);
}

export async function performanceTemplates(session: SessionContext) {
  if (!canManage(session)) return errorResponse('ليس لديك صلاحية عرض نماذج التقييم',403);
  const { data, error } = await supabase.from('performance_templates').select('*,performance_template_items(*)').order('created_at',{ascending:false});
  if (error) return errorResponse('تعذر تحميل نماذج التقييم',500);
  return success(data || []);
}

export async function createPerformanceTemplate(session: SessionContext, body: Record<string, unknown>) {
  if (!canHR(session)) return errorResponse('إدارة الموارد البشرية فقط يمكنها إنشاء نموذج تقييم',403);
  const name = String(body.name||'').trim();
  if (!name) return errorResponse('اسم نموذج التقييم مطلوب');
  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) return errorResponse('أضف معيار تقييم واحدًا على الأقل');
  const templateId = generateId('PTM');
  const { data, error } = await supabase.from('performance_templates').insert({ template_id: templateId, name, job_title: body.job_title ? String(body.job_title) : null, department: body.department ? String(body.department) : null, project_id: body.project_id ? String(body.project_id) : null, period_type: String(body.period_type||'ANNUAL'), status:'ACTIVE', created_by: session.user.user_id, created_at:nowISO() }).select('*').single();
  if (error) { console.error('createPerformanceTemplate',error); return errorResponse('تعذر حفظ نموذج التقييم',500); }
  const normalized = items.map((item:any,i:number)=>({ item_id: generateId('PTI'), template_id:templateId, title:String(item.title||'').trim(), description:item.description?String(item.description):null, weight:num(item.weight), max_score:num(item.max_score)||5, sort_order:i }));
  if (normalized.some((x:any)=>!x.title)) return errorResponse('كل معايير التقييم يجب أن تحتوي على اسم');
  const total = normalized.reduce((s:number,x:any)=>s+x.weight,0);
  if (Math.abs(total-100)>0.01) return errorResponse('مجموع أوزان معايير التقييم يجب أن يساوي 100%');
  const { error:itemError } = await supabase.from('performance_template_items').insert(normalized);
  if (itemError) { console.error('createPerformanceTemplate.items',itemError); return errorResponse('تعذر حفظ معايير التقييم',500); }
  return success({...data, performance_template_items:normalized},201);
}

export async function createPerformanceReview(session: SessionContext, body: Record<string, unknown>) {
  if (!canManage(session)) return errorResponse('ليس لديك صلاحية إنشاء تقييم أداء',403);
  const employeeId=String(body.employee_id||'').trim(), templateId=String(body.template_id||'').trim();
  const start=String(body.period_start||'').trim(), end=String(body.period_end||'').trim();
  if(!employeeId||!templateId||!start||!end) return errorResponse('الموظف والنموذج وفترة التقييم مطلوبة');
  if(end<start) return errorResponse('نهاية فترة التقييم لا يمكن أن تسبق بدايتها');
  const {data:template,error:te}=await supabase.from('performance_templates').select('template_id,status').eq('template_id',templateId).maybeSingle();
  if(te||!template) return errorResponse('نموذج التقييم غير موجود',404);
  if(template.status!=='ACTIVE') return errorResponse('نموذج التقييم غير نشط');
  const {data:existing}=await supabase.from('performance_reviews').select('review_id').eq('employee_id',employeeId).eq('template_id',templateId).eq('period_start',start).eq('period_end',end).not('status','eq','CANCELLED').maybeSingle();
  if(existing) return errorResponse('يوجد تقييم بالفعل لنفس الموظف والفترة',409);
  const {data,error}=await supabase.from('performance_reviews').insert({review_id:generateId('PRV'),employee_id:employeeId,template_id:templateId,period_start:start,period_end:end,reviewer_user_id:session.user.user_id,reviewer_role:session.user.role,status:'DRAFT',created_at:nowISO(),updated_at:nowISO()}).select('*').single();
  if(error){console.error('createPerformanceReview',error);return errorResponse('تعذر إنشاء تقييم الأداء',500)}
  return success(data,201);
}

export async function savePerformanceScores(session: SessionContext, body: Record<string, unknown>) {
  if(!canManage(session)) return errorResponse('ليس لديك صلاحية تعديل تقييم الأداء',403);
  const reviewId=String(body.review_id||'').trim();
  const scores=Array.isArray(body.scores)?body.scores:[];
  if(!reviewId||!scores.length)return errorResponse('التقييم ودرجات المعايير مطلوبة');
  const {data:review,error:re}=await supabase.from('performance_reviews').select('review_id,status,template_id').eq('review_id',reviewId).maybeSingle();
  if(re||!review)return errorResponse('التقييم غير موجود',404);
  if(!['DRAFT','SUBMITTED'].includes(review.status))return errorResponse('لا يمكن تعديل تقييم تم اعتماده أو إغلاقه');
  const {data:items,error:ie}=await supabase.from('performance_template_items').select('item_id,weight,max_score').eq('template_id',review.template_id);
  if(ie)return errorResponse('تعذر تحميل معايير التقييم',500);
  const itemMap=new Map((items||[]).map((x:any)=>[x.item_id,x]));
  const rows:any[]=[];
  let weighted=0, totalWeight=0;
  for(const raw of scores as any[]){ const item=itemMap.get(String(raw.item_id)); if(!item) return errorResponse('يوجد معيار تقييم غير صحيح'); const score=num(raw.score); if(score<0||score>num(item.max_score))return errorResponse(`درجة المعيار لا يمكن أن تتجاوز ${item.max_score}`); rows.push({score_id:generateId('PRS'),review_id:reviewId,item_id:item.item_id,score,comment:raw.comment?String(raw.comment):null,created_at:nowISO()}); weighted += (score/num(item.max_score))*num(item.weight); totalWeight += num(item.weight); }
  await supabase.from('performance_review_scores').delete().eq('review_id',reviewId);
  const {error}=await supabase.from('performance_review_scores').insert(rows);
  if(error){console.error('savePerformanceScores',error);return errorResponse('تعذر حفظ درجات التقييم',500)}
  const overall=totalWeight?Number(weighted/totalWeight*5):0;
  const rating=overall>=4.5?'ممتاز':overall>=3.5?'جيد جدًا':overall>=2.5?'جيد':overall>=1.5?'يحتاج تحسين':'غير مرضٍ';
  const {error:ue}=await supabase.from('performance_reviews').update({overall_score:Number(overall.toFixed(3)),final_rating:rating,updated_at:nowISO()}).eq('review_id',reviewId);
  if(ue)return errorResponse('تعذر تحديث نتيجة التقييم',500);
  return success({review_id:reviewId,overall_score:Number(overall.toFixed(3)),final_rating:rating,scores:rows});
}

export async function decidePerformanceReview(session: SessionContext, body: Record<string, unknown>) {
  const reviewId=String(body.review_id||'').trim(), decision=String(body.decision||'').trim();
  if(!reviewId)return errorResponse('رقم التقييم مطلوب');
  if(decision==='MANAGER_APPROVE') { if(!canManage(session))return errorResponse('ليس لديك صلاحية اعتماد التقييم',403); }
  else if(decision==='HR_CLOSE') { if(!canHR(session))return errorResponse('إدارة الموارد البشرية فقط يمكنها إغلاق التقييم',403); }
  else if(decision==='CANCEL') { if(!canHR(session))return errorResponse('إدارة الموارد البشرية فقط يمكنها إلغاء التقييم',403); }
  else return errorResponse('قرار التقييم غير صحيح');
  const {data:review,error}=await supabase.from('performance_reviews').select('status').eq('review_id',reviewId).maybeSingle();
  if(error||!review)return errorResponse('التقييم غير موجود',404);
  const next=decision==='MANAGER_APPROVE'?'MANAGER_APPROVED':decision==='HR_CLOSE'?'HR_CLOSED':'CANCELLED';
  const allowed=decision==='MANAGER_APPROVE'?['SUBMITTED','DRAFT']:decision==='HR_CLOSE'?['MANAGER_APPROVED','SUBMITTED']:['DRAFT','SUBMITTED','MANAGER_APPROVED'];
  if(!allowed.includes(review.status))return errorResponse('حالة التقييم لا تسمح بهذا القرار');
  if(decision==='MANAGER_APPROVE'){ const {data:scored}=await supabase.from('performance_reviews').select('overall_score').eq('review_id',reviewId).maybeSingle(); if(!scored?.overall_score || Number(scored.overall_score)<=0) return errorResponse('يجب حفظ درجات التقييم وحساب النتيجة قبل اعتمادها'); }
  const {data,error:ue}=await supabase.from('performance_reviews').update({status:next,approved_at:decision==='HR_CLOSE'?nowISO():undefined,updated_at:nowISO()}).eq('review_id',reviewId).select('*').single();
  if(ue)return errorResponse('تعذر تحديث حالة التقييم',500);
  return success(data);
}


export async function performanceGoals(session: SessionContext, body: Record<string, unknown>) {
  if (!canManage(session)) return errorResponse('ليس لديك صلاحية عرض أهداف الموظفين',403);
  let q = supabase.from('performance_goals').select('*').order('due_date',{ascending:true,nullsFirst:false}).limit(300);
  if (body.employee_id) q=q.eq('employee_id',String(body.employee_id));
  if (body.status) q=q.eq('status',String(body.status));
  const {data,error}=await q;
  if(error){console.error('performanceGoals',error);return errorResponse('تعذر تحميل أهداف الموظفين',500)}
  return success(data||[]);
}

export async function createPerformanceGoal(session: SessionContext, body: Record<string, unknown>) {
  if (!canManage(session)) return errorResponse('ليس لديك صلاحية إنشاء هدف',403);
  const employeeId=String(body.employee_id||'').trim(), title=String(body.title||'').trim();
  if(!employeeId||!title)return errorResponse('الموظف واسم الهدف مطلوبان');
  const weight=num(body.weight); if(weight<0||weight>100)return errorResponse('وزن الهدف يجب أن يكون بين 0 و100%');
  const due=body.due_date?String(body.due_date):null;
  const {data,error}=await supabase.from('performance_goals').insert({goal_id:generateId('PGL'),employee_id:employeeId,review_id:body.review_id?String(body.review_id):null,title,description:body.description?String(body.description):null,target_value:body.target_value?String(body.target_value):null,progress_value:body.progress_value?String(body.progress_value):null,weight,due_date:due,status:String(body.status||'OPEN'),created_by:session.user.user_id,created_at:nowISO(),updated_at:nowISO()}).select('*').single();
  if(error){console.error('createPerformanceGoal',error);return errorResponse('تعذر حفظ الهدف',500)}
  return success(data,201);
}

export async function updatePerformanceGoal(session: SessionContext, body: Record<string, unknown>) {
  if (!canManage(session)) return errorResponse('ليس لديك صلاحية تعديل الهدف',403);
  const goalId=String(body.goal_id||'').trim(); if(!goalId)return errorResponse('رقم الهدف مطلوب');
  const patch:any={updated_at:nowISO()};
  for(const key of ['title','description','target_value','progress_value','due_date','status']) if(body[key]!==undefined) patch[key]=body[key]===null?null:String(body[key]);
  if(body.weight!==undefined){const w=num(body.weight);if(w<0||w>100)return errorResponse('وزن الهدف يجب أن يكون بين 0 و100%');patch.weight=w;}
  const {data,error}=await supabase.from('performance_goals').update(patch).eq('goal_id',goalId).select('*').single();
  if(error){console.error('updatePerformanceGoal',error);return errorResponse('تعذر تحديث الهدف',500)}
  return success(data);
}

export async function developmentPlans(session: SessionContext, body: Record<string, unknown>) {
  if (!canManage(session)) return errorResponse('ليس لديك صلاحية عرض خطط التطوير',403);
  let q=supabase.from('development_plans').select('*').order('due_date',{ascending:true,nullsFirst:false}).limit(300);
  if(body.employee_id)q=q.eq('employee_id',String(body.employee_id));
  if(body.status)q=q.eq('status',String(body.status));
  const {data,error}=await q;
  if(error){console.error('developmentPlans',error);return errorResponse('تعذر تحميل خطط التطوير',500)}
  return success(data||[]);
}

export async function createDevelopmentPlan(session: SessionContext, body: Record<string, unknown>) {
  if (!canManage(session)) return errorResponse('ليس لديك صلاحية إنشاء خطة تطوير',403);
  const employeeId=String(body.employee_id||'').trim(), title=String(body.title||'').trim(), objective=String(body.objective||'').trim();
  if(!employeeId||!title||!objective)return errorResponse('الموظف وعنوان الخطة والهدف التطويري مطلوبة');
  const progress=num(body.progress); if(progress<0||progress>100)return errorResponse('نسبة الإنجاز يجب أن تكون بين 0 و100%');
  const {data,error}=await supabase.from('development_plans').insert({plan_id:generateId('DVP'),employee_id:employeeId,review_id:body.review_id?String(body.review_id):null,title,current_gap:body.current_gap?String(body.current_gap):null,objective,actions:body.actions?String(body.actions):null,support_needed:body.support_needed?String(body.support_needed):null,due_date:body.due_date?String(body.due_date):null,status:String(body.status||'OPEN'),progress,created_by:session.user.user_id,created_at:nowISO(),updated_at:nowISO()}).select('*').single();
  if(error){console.error('createDevelopmentPlan',error);return errorResponse('تعذر حفظ خطة التطوير',500)}
  return success(data,201);
}

export async function updateDevelopmentPlan(session: SessionContext, body: Record<string, unknown>) {
  if (!canManage(session)) return errorResponse('ليس لديك صلاحية تعديل خطة التطوير',403);
  const planId=String(body.plan_id||'').trim();if(!planId)return errorResponse('رقم الخطة مطلوب');
  const patch:any={updated_at:nowISO()};
  for(const key of ['title','current_gap','objective','actions','support_needed','due_date','status']) if(body[key]!==undefined) patch[key]=body[key]===null?null:String(body[key]);
  if(body.progress!==undefined){const p=num(body.progress);if(p<0||p>100)return errorResponse('نسبة الإنجاز يجب أن تكون بين 0 و100%');patch.progress=p;}
  const {data,error}=await supabase.from('development_plans').update(patch).eq('plan_id',planId).select('*').single();
  if(error){console.error('updateDevelopmentPlan',error);return errorResponse('تعذر تحديث خطة التطوير',500)}
  return success(data);
}
