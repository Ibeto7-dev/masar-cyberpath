const SB='https://xcmwtkystwtjdeeehttl.supabase.co';
const PUB='sb_publishable_iXulJ9jQa_3MiG3LhmIYQw_C_acPfK6';
const cookies=(req)=>Object.fromEntries((req.headers.get('cookie')||'').split('; ').map(s=>[s.split('=')[0],s.slice(s.indexOf('=')+1)]));
const cookie=(k,v,age)=>'__Host-masar-'+k+'='+v+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age='+age;
const b64url=a=>btoa(String.fromCharCode(...new Uint8Array(a))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
function redirect(to,cc=[]){let h=new Headers({location:to,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});for(let c of cc)h.append('Set-Cookie',c);return new Response(null,{status:303,headers:h})}
async function sb(path,opts={}){return fetch(SB+path,{...opts,headers:{apikey:PUB,...opts.headers}})}
async function exchange(type,data){return sb('/auth/v1/token?grant_type='+type,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})}
const sessionCookies=s=>[cookie('access',s.access_token,s.expires_in),cookie('refresh',s.refresh_token,60*60*24*30)];
async function googleRoute(req,url){
 const c=cookies(req);
 if(url.pathname==='/auth/google'){
  const cfg=await sb('/auth/v1/settings');
  if(!cfg.ok||!(await cfg.json()).external?.google)return redirect('/?login=google_pending');
  const verifier=b64url(crypto.getRandomValues(new Uint8Array(48)));
  const challenge=b64url(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)));
  let target=new URL('/auth/v1/authorize',SB);
  target.search=new URLSearchParams({provider:'google',redirect_to:url.origin+'/auth/google/callback',code_challenge:challenge,code_challenge_method:'s256'}).toString();
  return redirect(target.href,[cookie('verifier',verifier,600)]);
 }
 if(url.pathname==='/auth/google/callback'){
  const code=url.searchParams.get('code'),verifier=c['__Host-masar-verifier'];let clear=cookie('verifier','',0);
  if(!code||!verifier)return redirect('/?login=google_failed',[clear]);
  const r=await exchange('pkce',{auth_code:code,code_verifier:verifier});
  if(!r.ok)return redirect('/?login=google_failed',[clear]);
  return redirect('/',[clear,...sessionCookies(await r.json())]);
 }
 if(url.pathname==='/auth/google/logout') {
  const cc=[cookie('access','',0),cookie('refresh','',0)];
  if(c['__Host-masar-access'])await sb('/auth/v1/logout?scope=local',{method:'POST',headers:{Authorization:'Bearer '+c['__Host-masar-access']}}).catch(()=>{});
  return redirect('/',cc);
 }
 return new Response(null,{status:404});
}
async function googleIdentity(req){
 const c=cookies(req),refresh=c['__Host-masar-refresh'];let access=c['__Host-masar-access'],cc=[];
 if(!refresh&&!access)return null;
 if(access){const r=await sb('/auth/v1/user',{headers:{Authorization:'Bearer '+access}});if(r.ok){const u=await r.json();return {id:u.id,email:u.email,access,cc}}if(r.status>=500)throw Error('auth unavailable')}
 if(refresh){const r=await exchange('refresh_token',{refresh_token:refresh});if(r.ok){const s=await r.json();return {id:s.user.id,email:s.user.email,access:s.access_token,cc:sessionCookies(s)}}if(r.status>=500)throw Error('auth unavailable')}
 return {expired:true,cc:[cookie('refresh','',0),cookie('access','',0)]};
}
async function googleAccount(req,g){
 const owner='google:'+g.id,headers={Authorization:'Bearer '+g.access,'Content-Type':'application/json',Prefer:'return=representation'};
 let result;
 if(g.expired)result=reply({error:'signin'},401);
 else if(req.method==='GET'){
  const r=await sb('/rest/v1/masar_accounts?select=revision,payload&owner_key=eq.'+encodeURIComponent(g.id),{headers});
  if(!r.ok)result=reply({error:'storage'},503);else{const [row]=await r.json();result=reply({user:owner,label:g.email,revision:row?.revision||0,state:row?.payload||null,provider:'google'})}
 }else if(req.method==='PUT'){
  if(req.headers.get('origin')!==new URL(req.url).origin||req.headers.get('x-expected-account')!==owner||!req.headers.get('content-type')?.startsWith('application/json'))return reply({},403);
  const raw=await req.text();if(raw.length>1500000)return reply({},413);
  let d;try{d=JSON.parse(raw)}catch{return reply({},400)}
  if(!Number.isSafeInteger(d?.revision)||d.revision<0||!validState(d.state))return reply({},422);
  const create=d.revision===0;
  const r=await sb('/rest/v1/masar_accounts?select=revision'+(create?'':'&owner_key=eq.'+encodeURIComponent(g.id)+'&revision=eq.'+d.revision),{method:create?'POST':'PATCH',headers,body:JSON.stringify({owner_key:g.id,revision:d.revision+1,payload:d.state})});
  if(r.status===409)result=reply({error:'conflict'},409);else if(!r.ok)result=reply({error:'storage'},503);else {const [row]=await r.json();result=row?reply(row):reply({error:'conflict'},409)}
 }else result=reply({},405);
 for(const c of g.cc)result.headers.append('Set-Cookie',c);return result;
}
