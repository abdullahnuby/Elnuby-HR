export type ApiResponse<T=unknown> = {ok:boolean; data?:T; error?:string};

export async function api<T=unknown>(action:string, payload:Record<string,unknown> = {}):Promise<T>{
  const token = typeof window !== 'undefined' ? localStorage.getItem('hr_token') : null;
  const res = await fetch('/api/hr', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action,token,...payload})});
  const json:ApiResponse<T> = await res.json();
  if(!json.ok) throw new Error(json.error || 'Request failed');
  return json.data as T;
}
