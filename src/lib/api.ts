export type ApiResponse<T=unknown> = {ok:boolean; data?:T; error?:string};

export async function api<T=unknown>(
  action:string,
  payload:Record<string,unknown> = {}
):Promise<T>{
  // Login is independent from any stale token left by an older deployment.
  const token =
    typeof window !== 'undefined' && action !== 'login'
      ? localStorage.getItem('hr_token')
      : null;

  const res = await fetch('/api/hr', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({
      action,
      ...(token ? {token} : {}),
      ...payload
    })
  });

  let json:ApiResponse<T>;
  try {
    json = await res.json();
  } catch {
    throw new Error(`Server error (${res.status})`);
  }

  if(!json.ok){
    // Never keep a dead session in localStorage.
    if(
      res.status === 401 &&
      typeof window !== 'undefined' &&
      action !== 'login'
    ){
      localStorage.removeItem('hr_token');
    }

    throw new Error(
      json.error ||
      (res.status === 401 ? 'Session expired' : 'Request failed')
    );
  }

  return json.data as T;
}
