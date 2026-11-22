function reply(data,status=200){return Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}})}
export default {async fetch(req,env){
 const url=new URL(req.url),path=url.pathname;
 if(path.startsWith('/auth/google'))return googleRoute(req,url);
 if(path==='/api/import-chatgpt'){
  if(req.method!=='POST'||req.headers.get('origin')!==url.origin)return reply({},403);
  const g=await googleIdentity(req),oldId=req.headers.get('oai-authenticated-user-id');
  if(!g||g.expired||!oldId||req.headers.get('x-expected-account')!=='google:'+g.id)return reply({},403);
  const old=await env.DB.prepare('SELECT payload FROM study_accounts WHERE user_id=?').bind(oldId).first();
  if(!old)return reply({},404);
  const payload=JSON.parse(old.payload);
  if(!validState(payload))return reply({},422);
  return googleAccount(new Request(url.origin+'/api/account',{method:'PUT',headers:{origin:url.origin,'content-type':'application/json','x-expected-account':'google:'+g.id},body:JSON.stringify({state:payload,revision:0})}),g);
 }
 if(path!=='/api/account'){
  const file=path==='/'?'/index.html':path;
  if(req.method!=='GET'||!Object.hasOwn(assets,file))return new Response('Not found',{status:404});
  const types={js:'text/javascript',css:'text/css',html:'text/html',svg:'image/svg+xml'};
  return new Response(assets[file],{headers:{'Content-Type':types[file.split('.').pop()]+'; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}});
 }
 const google=await googleIdentity(req);if(google)return googleAccount(req,google);
 const user=req.headers.get('oai-authenticated-user-id');
 if(!user)return reply({error:'signin'},401);
 if(req.method==='GET'){
  const row=await env.DB.prepare('SELECT revision,payload FROM study_accounts WHERE user_id=?').bind(user).first();
  return reply({user,label:req.headers.get('oai-authenticated-user-email')||'حسابي',revision:row?.revision||0,state:row?JSON.parse(row.payload):null});
 }
 if(req.method!=='PUT')return reply({},405);
 if(req.headers.get('origin')!==url.origin||!req.headers.get('content-type')?.startsWith('application/json'))return reply({},403);
 if(req.headers.get('x-expected-account')!==user)return reply({},403);
 const raw=await req.text();if(raw.length>1500000)return reply({},413);
 let d;try{d=JSON.parse(raw)}catch{return reply({},400)}
 if(!Number.isSafeInteger(d?.revision)||d.revision<0||!validState(d.state))return reply({},422);
 const sql=d.revision===0?'INSERT OR IGNORE INTO study_accounts(payload,user_id,revision) VALUES(?,?,1)':'UPDATE study_accounts SET payload=?,revision=revision+1 WHERE user_id=? AND revision=?';
 const args=[JSON.stringify(d.state),user];if(d.revision)args.push(d.revision);
 const res=await env.DB.prepare(sql).bind(...args).run();
 return res.meta.changes===1?reply({revision:d.revision+1}):reply({error:'conflict'},409);
}};
