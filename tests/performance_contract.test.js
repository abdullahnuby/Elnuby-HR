const fs=require('fs');const path=require('path');
const root=path.resolve(__dirname,'..');
function must(p,needle){const s=fs.readFileSync(path.join(root,p),'utf8');if(!s.includes(needle))throw new Error(`${p}: missing ${needle}`)}
must('supabase-migration-20260831_performance_management.sql','performance_reviews');
must('supabase-migration-20260831_performance_management.sql','performance_review_scores');
must('src/server/hr/performance.ts','createPerformanceTemplate');
must('src/server/hr/performance.ts','savePerformanceScores');
must('src/server/hr/performance.ts','decidePerformanceReview');
must('src/server/hr/router.ts','performance_list');
must('src/components/hr/Performance.tsx','تقييم الأداء والمهارات');
must('src/components/hr/constants.ts',"id: 'performance'");
console.log('Performance contract: PASS');
