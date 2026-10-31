// Regression tests for the 30 Oct 2026 code review findings (F01-F06).
const test=require('node:test'),assert=require('node:assert/strict'),C=require('../js/core'),W=require('../js/work'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),install=require('../mobile/notifications.cjs');
const T='2026-11-02';
const shift=(id,date)=>C.cleanEvent({id,workKind:'shift',category:'Work',title:'Shift',date,startTime:'09:00',endTime:'17:00',tz:'Europe/London',reminders:{offsets:[]}});
function state(){const s=C.freshState(T);return s;}

// Browser shell with account sync loaded and the network mocked.
function app(raw,{routes,failKey}={}){
  const store=new Map(),calls=[];if(raw)store.set('lifebalance.v2',JSON.stringify(raw));
  const fetch=async(url,o={})=>{const p=url.replace(/^.*?(\/api\/)/,'/api/'),m=(o.method||'GET')+' '+p;calls.push({m,auth:o.headers&&o.headers.Authorization,body:o.body&&JSON.parse(o.body)});const r=(routes[m]||(()=>[404,{error:'nf'}]))(o.body&&JSON.parse(o.body));return {ok:r[0]<300,status:r[0],json:async()=>r[1]};};
  const ctx={console,Intl,Date,Math,FormData,URL,Blob,JSON,setTimeout,clearTimeout,setInterval:()=>0,fetch,navigator:{onLine:true},addEventListener(){},document:{hidden:false,activeElement:{matches:()=>false},addEventListener(){},getElementById(){return {hidden:true,innerHTML:''}},querySelector(){return null}},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>{if(failKey&&k===failKey)throw Error('quota');store.set(k,v);},removeItem:k=>store.delete(k)},scrollY:0,scrollTo(){}};
  ctx.window=ctx;vm.createContext(ctx);
  for(const f of ['core','merge','meals','state','region','work','views-core','views-events','views-work','sync'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',f+'.js'),'utf8'),ctx,{filename:f});
  const LB=ctx.LB;LB.start();LB.toasts=[];LB.toast=m=>LB.toasts.push(m);LB.rem={syncSoon(){}};LB.sync.serviceState='ready';
  return {LB,calls,store};
}
const form=v=>Object.fromEntries(Object.entries(v).map(([k,x])=>[k,{value:x}]));

test('F01 Work-only records count as local data, so first sign-in asks before replacing them',async()=>{
  const local=state();local.work.leave.push({id:'l1',start:'2026-11-02',end:'2026-11-02',notes:'',allocations:[{date:'2026-11-02',days:1}]});
  const cloud=state();cloud.tasks.push({id:'t',title:'cloud task',done:false,priority:'normal',date:T});
  const {LB}=app(local,{routes:{'POST /api/account/login':()=>[200,{token:'tok',email:'a@b.c'}],'GET /api/sync':()=>[200,{rev:3,data:cloud}],'POST /api/account/logout':()=>[200,{ok:true}]}});
  let asked=0;LB.ask=async()=>{asked++;return null;};
  assert.equal(LB.sync.isEmpty(LB.personal),false);
  const blank=state();assert.equal(LB.sync.isEmpty(blank),true);blank.work.workingDays=[1,2,3,4];assert.equal(LB.sync.isEmpty(blank),false);
  await LB.submits.acctLogin(form({email:'a@b.c',password:'longpassword'}));
  assert.equal(asked,1);assert.equal(LB.personal.work.leave.length,1);assert.equal(LB.D.account,null);
});

test('F01 replacing with the cloud copy requires a saved safety backup',async()=>{
  const local=state();local.work.allowances.push({id:'2026',year:2026,days:25});
  const cloud=state();cloud.tasks.push({id:'t',title:'cloud task',done:false,priority:'normal',date:T});
  const {LB}=app(local,{failKey:'lifebalance.backup.import',routes:{'POST /api/account/login':()=>[200,{token:'tok',email:'a@b.c'}],'GET /api/sync':()=>[200,{rev:3,data:cloud}],'POST /api/account/logout':()=>[200,{ok:true}]}});
  LB.ask=async()=>'cloud';
  await LB.submits.acctLogin(form({email:'a@b.c',password:'longpassword'}));
  assert.equal(LB.personal.work.allowances.length,1);assert.equal(LB.personal.tasks.length,0);assert.equal(LB.D.account,null);
  assert.ok(LB.toasts.some(t=>/safety copy/.test(t)));
});

test('F02 an unrelated past shift does not zero a weekday booking',()=>{
  const s=state();s.events.push(shift('old','2026-01-12'));
  assert.deepEqual(W.allocate(s,'2026-11-02','2026-11-06','').map(a=>a.date),['2026-11-02','2026-11-03','2026-11-04','2026-11-05','2026-11-06']);
  // A week with scheduled shifts follows the roster; the next, unrostered week uses working days.
  s.events.push(shift('sat','2026-11-07'),shift('wed','2026-11-04'));
  assert.deepEqual(W.allocate(s,'2026-11-02','2026-11-10','').map(a=>a.date),['2026-11-04','2026-11-07','2026-11-09','2026-11-10']);
});

test('F03 manual corrections use working dates first, then other dates in order',()=>{
  const s=state();
  assert.deepEqual(W.allocate(s,'2026-10-31','2026-11-02','2'),[{date:'2026-10-31',days:1},{date:'2026-11-02',days:1}]);
  assert.deepEqual(W.allocate(s,'2026-10-31','2026-11-02','1.5'),[{date:'2026-10-31',days:0.5},{date:'2026-11-02',days:1}]);
  // Across New Year the working day keeps priority, so the right leave year is debited.
  const fri=state();fri.work.workingDays=[5];
  assert.deepEqual(W.allocate(fri,'2026-12-30','2027-01-01','1.5'),[{date:'2026-12-30',days:0.5},{date:'2027-01-01',days:1}]);
  const y=W.allocate(s,'2027-01-02','2027-01-04','2');assert.deepEqual(y.map(a=>a.date),['2027-01-02','2027-01-04']);
});

test('F04 registration waits for the emailed code and never syncs with an undefined token',async()=>{
  const {LB,calls}=app(state(),{routes:{'POST /api/account/register':()=>[200,{needsVerification:true,email:'a@b.c'}],'POST /api/account/resend':()=>[200,{ok:true}],'POST /api/account/verify':b=>b.code==='12345678'?[200,{token:'tok',email:'a@b.c'}]:[400,{error:'Wrong code.'}],'GET /api/sync':()=>[200,{rev:0,data:null}],'PUT /api/sync':()=>[200,{rev:1}]}});
  const f=form({email:'a@b.c',password:'longpassword'});
  await LB.actions.acctRegister({closest:()=>f});
  assert.ok(!calls.some(c=>c.m==='GET /api/sync'));assert.equal(LB.D.account,null);
  assert.match(LB.sync.card(),/data-s="acctVerify"/);
  await LB.actions.acctResend();assert.deepEqual(calls.at(-1).body,{email:'a@b.c',password:'longpassword'});
  await LB.submits.acctVerify(form({code:'0000'}));assert.equal(LB.D.account,null);
  await LB.submits.acctVerify(form({code:'1234 5678'}));
  assert.equal(LB.D.account.token,'tok');
  assert.ok(calls.filter(c=>c.m==='GET /api/sync').every(c=>c.auth==='Bearer tok'));
  assert.doesNotMatch(LB.sync.card(),/acctVerify/);
});

test('F04 forgotten password sends a code and resets without touching local data',async()=>{
  const s=state();s.tasks.push({id:'t',title:'mine',done:false,priority:'normal',date:T});
  const {LB,calls}=app(s,{routes:{'POST /api/account/forgot':()=>[200,{ok:true}],'POST /api/account/reset':()=>[200,{ok:true}]}});
  LB.actions.acctForgot({closest:()=>form({email:'a@b.c'})});assert.match(LB.sync.card(),/data-s="acctForgot"/);
  await LB.submits.acctForgot(form({email:'a@b.c'}));assert.match(LB.sync.card(),/data-s="acctReset"/);
  await LB.submits.acctReset(form({code:'12345678',newp:'newpassword1'}));
  assert.deepEqual(calls.at(-1).body,{email:'a@b.c',code:'12345678',newPassword:'newpassword1'});
  assert.match(LB.sync.card(),/data-s="acctLogin"/);assert.equal(LB.personal.tasks.length,1);
});

function native(){
  let pending=[],delivered=[],scheduled=[],removed=[];
  const D={demo:false,push:{enabled:false},snoozes:{},alerts:[]};
  const LB={D,C:{remindersBetween:()=>[],reminderText:()=>({})},personal:{settings:{showDetails:false},events:[{id:'e',exceptions:{}}]},ui:{},saveD(){},render(){},toast(){},actions:{snooze(){return false}},rem:{buildSchedule:()=>[],prune(){},init:async()=>{}}};
  // Mirrors the Android plugin: schedule replaces by id; delivered results expose Android extras as `data`.
  const N={checkPermissions:async()=>({display:'granted'}),requestPermissions:async()=>({display:'granted'}),getPending:async()=>({notifications:pending}),getDeliveredNotifications:async()=>({notifications:delivered}),removeDeliveredNotifications:async({notifications})=>{removed.push(...notifications);delivered=delivered.filter(n=>!notifications.some(x=>x.id===n.id));},removeAllDeliveredNotifications:async()=>{},cancel:async({notifications})=>{pending=pending.filter(n=>!notifications.some(x=>x.id===n.id));},schedule:async({notifications})=>{scheduled.push(...notifications);pending=pending.filter(n=>!notifications.some(x=>x.id===n.id)).concat(notifications);},createChannel:async()=>{},registerActionTypes:async()=>{},addListener:async()=>{}};
  return {LB,N,D,get pending(){return pending},set delivered(v){delivered=v},get delivered(){return delivered},get scheduled(){return scheduled},get removed(){return removed}};
}
const AT=Date.now()+3600000,item=(key='e|1')=>({key,at:AT,title:'LifeBalance',body:'You have a reminder.',ev:'e'});

test('F05 app startup re-registers alarms even when saved plugin records look unchanged',async()=>{
  const b=native();install(b.LB,b.N,{addListener:async()=>{}});b.LB.rem.buildSchedule=()=>[item()];
  await b.LB.rem.enableReminders();assert.equal(b.scheduled.length,1);
  await b.LB.rem.sync();assert.equal(b.scheduled.length,1,'unchanged schedule is not re-sent while running');
  // Process restart: OS alarm may be gone but the plugin's saved record remains.
  const build=b.LB.rem.buildSchedule,LB2={...b.LB,rem:{prune(){},init:async()=>{}}};install(LB2,b.N,{addListener:async()=>{}});LB2.rem.buildSchedule=build;
  assert.equal(b.D.nativeRem.enabled,true);
  await LB2.rem.init();assert.equal(b.scheduled.length,2);assert.equal(b.pending.length,1);assert.equal(b.D.nativeRem.status,'ok');
});

test('F05 regaining precise-alarm access re-registers every alarm',async()=>{
  const b=native();let exact=true;b.N.checkExactNotificationSetting=async()=>({exact_alarm:exact?'granted':'denied'});install(b.LB,b.N,{});b.LB.rem.buildSchedule=()=>[item('a'),item('b')];
  await b.LB.rem.enableReminders();const n=b.scheduled.length;
  exact=false;await b.LB.rem.sync();exact=true;await b.LB.rem.sync();
  assert.equal(b.scheduled.length,n+4);assert.ok(b.pending.every(p=>p.isExactNotification));
});

test('F06 delivered Android notifications are matched by owned id and removed when stale',async()=>{
  const b=native();install(b.LB,b.N,{});b.LB.rem.buildSchedule=()=>[item()];
  await b.LB.rem.enableReminders();const id=b.pending[0].id;
  assert.equal(b.D.nativeRem.owned[id].evId,'e');
  b.delivered=[{id,title:'LifeBalance',body:'You have a reminder.',data:{'android.title':'LifeBalance'}},{id:999,title:'Other',body:'x',data:{}}];
  await b.LB.rem.sync();assert.equal(b.removed.length,0,'current reminder stays visible');
  b.LB.personal.events=[];await b.LB.rem.sync();
  assert.deepEqual(b.removed.map(n=>n.id),[id],'deleted event clears its visible notification; unknown ids are untouched');
  b.LB.personal.events=[{id:'e',exceptions:{}}];b.delivered=[{id,title:'Dentist',body:'Dentist at 9',data:{}}];await b.LB.rem.sync();
  assert.equal(b.removed.at(-1).id,id,'hiding details clears a detailed notification');
});

test('every version label matches package.json',()=>{
  const v=require('../package.json').version,read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
  assert.equal(C.APP_VERSION,v);assert.match(read('index.html'),new RegExp('Version '+v.replace(/\./g,'\\.')+' · Last updated '+C.APP_UPDATED));
  assert.match(read('android/app/build.gradle'),new RegExp('versionName "'+v.replace(/\./g,'\\.')+'"'));
  assert.match(read('mobile/sound-panel.cjs'),new RegExp('Android app '+v.replace(/\./g,'\\.')));
  // Browsers cache scripts by URL, so every ?v= tag must match this release and the service-worker cache.
  const cache=/const CACHE = 'lifebalance-work-(\d+)'/.exec(read('sw.js'))[1],tags=[...read('index.html').matchAll(/\?v=([\w-]+)/g)].map(m=>m[1]);
  assert.ok(tags.length>10);assert.deepEqual([...new Set(tags)],[C.APP_UPDATED.replace(/-/g,'')+'-work-'+cache]);
});

test('Add appointment under the category filters opens the form with the selected category',()=>{
  const {LB}=app(state(),{routes:{}});
  assert.match(LB.views.events(),/data-a="newEvent"[^>]*>➕ Add appointment</);
  for(const c of C.CATS){
    LB.ui.cat='';LB.actions.evCat({dataset:{arg:c}});
    const h=LB.views.events();
    assert.ok(h.indexOf('aria-label="Filter by category"')<h.indexOf('data-a="newEvent"')&&h.indexOf('data-a="newEvent"')<h.indexOf('id="evResults"'));
    assert.ok(h.includes('Add '+c+' appointment'));
    LB.actions.newEvent();assert.equal(LB.ui.form.category,c);LB.ui.view=null;
  }
});
