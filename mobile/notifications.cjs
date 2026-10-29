// Injectable native adapter; browser reminder behavior is unchanged.
module.exports = function install(LB, N, app, toneApi) {
  const R=LB.rem,D=LB.D,A=LB.actions;
  let permission='prompt',timer,queue=Promise.resolve();
  D.nativeRem=Object.assign({enabled:false,status:'none',count:0,error:''},D.nativeRem);
  const state=D.nativeRem;
  R.channelId='lifebalance-reminders';
  R.buildSchedule=()=>{const now=Date.now();if(D.receive===false)return [];return LB.C.remindersBetween(LB.personal,now,now+45*864e5,LB.tz).slice(0,300).map(r=>{const t=LB.C.reminderText(r,LB.personal.settings.showDetails,LB.tz);return {key:r.key,at:r.at,title:t.title,body:t.body,ev:r.occ?.evId||'',occKey:r.occ?.key||''};});};
  const refresh=()=>{LB.saveD();if(LB.ui.view==='settings')LB.render();};
  const revision=id=>{const e=LB.personal.events.find(x=>x.id===id);if(!e)return '';let h=0;for(const c of JSON.stringify(e))h=Math.imul(h,31)+c.charCodeAt(0)|0;return String(h);};
  const active=a=>{if(!a.evId)return true;const e=LB.personal.events.find(x=>x.id===a.evId);return !!e&&(!a.rev||a.rev===revision(a.evId))&&!e.cancelled&&!(e.exceptions?.[a.occKey]||{}).cancelled;};
  function make(items){
    const used=new Set();return items.map(x=>{let id=2166136261;for(const c of x.key)id=Math.imul(id^c.charCodeAt(0),16777619);id=(id>>>0)%2147483646+1;while(used.has(id))id=id%2147483646+1;used.add(id);
      return {id,title:x.title,body:x.body,isExactNotification:!!state.exact,isExactMandatory:!!state.exact,channelId:R.channelId,actionTypeId:'LB_REMINDER',smallIcon:'ic_notification',schedule:{at:new Date(x.at),allowWhileIdle:true},extra:{exact:!!state.exact,channelId:R.channelId,lb:true,key:x.key,evId:x.ev||'',occKey:x.occKey||'',rev:revision(x.ev),at:x.at}};
    });
  }
  async function reconcile(){
    try{
      if(toneApi){try{const tone=await toneApi.current();R.channelId=tone.channelId||'lifebalance-reminders';state.silent=!!tone.silent;state.toneWarning='';}catch(e){R.channelId='lifebalance-reminders';state.toneWarning='Custom tone could not be loaded; using the device reminder category.';}}
      state.exact=N.checkExactNotificationSetting?(await N.checkExactNotificationSetting()).exact_alarm==='granted':false;
      permission=(await N.checkPermissions()).display;state.permission=permission;
      const pending=(await N.getPending()).notifications.filter(n=>n.extra?.lb||n.extra?.test);
      const enabled=state.enabled&&permission==='granted'&&D.receive!==false&&!D.demo;
      const delivered=(await N.getDeliveredNotifications()).notifications;
      const remove=delivered.filter(n=>n.extra?.lb&&(!enabled||!active(n.extra)||(!LB.personal.settings.showDetails&&n.body!=='You have a reminder.')));
      if(remove.length)await N.removeDeliveredNotifications({notifications:remove});
      const now=Date.now();let items=[];
      if(enabled){items=R.buildSchedule();for(const [key,s] of Object.entries(D.snoozes)){if(s.until>now&&active(s.alert))items.push({key,at:s.until,ev:s.alert.evId,occKey:s.alert.occKey,title:LB.personal.settings.showDetails?s.alert.title:'LifeBalance',body:LB.personal.settings.showDetails?s.alert.body:'You have a reminder.'});}}
      items.sort((a,b)=>a.at-b.at||a.key.localeCompare(b.key));items=items.slice(0,300);
      const wanted=make(items),byId=new Map(wanted.map(n=>[n.id,n]));
      const same=(a,b)=>a&&b&&a.extra?.key===b.extra?.key&&a.extra?.at===b.extra?.at&&a.extra?.rev===b.extra?.rev&&a.extra?.channelId===b.extra?.channelId&&a.extra?.exact===b.extra?.exact&&a.title===b.title&&a.body===b.body;
      const stale=pending.filter(n=>n.extra?.test?!enabled:!same(n,byId.get(n.id)));
      if(stale.length)await N.cancel({notifications:stale.map(n=>({id:n.id}))});
      const existing=new Map(pending.map(n=>[n.id,n]));const fresh=wanted.filter(n=>!same(n,existing.get(n.id)));
      if(fresh.length)await N.schedule({notifications:fresh});
      const registered=(await N.getPending()).notifications;
      const matching=wanted.filter(n=>registered.some(p=>p.id===n.id&&same(p,n)));
      state.count=matching.length;state.next=matching.slice(0,5).map(n=>({at:n.extra.at,kind:n.extra.key.startsWith('ev|')?'Appointment reminder':'Routine or snoozed reminder'}));
      if(matching.length!==wanted.length)throw new Error('Only '+matching.length+' of '+wanted.length+' reminders were registered. Refresh the schedule and retry.');
      state.status=enabled?'ok':permission==='denied'?'blocked':'off';state.count=wanted.length;state.error='';state.updatedAt=Date.now();
    }catch(e){state.status='failed';state.error=String(e.message||e);state.count=0;state.next=[];}
    refresh();
  }
  R.sync=()=>{queue=queue.then(reconcile,reconcile);return queue;};
  R.syncSoon=()=>{R.prune();clearTimeout(timer);timer=setTimeout(()=>R.sync(),300);};
  R.perm=()=>permission==='granted'?'granted':permission==='denied'?'denied':'default';
  R.nativeOn=()=>false; // OS scheduling owns notifications; avoid duplicate browser notifications.
  R.enableReminders=async()=>{if(D.demo){LB.toast('Exit demo mode first.');return;}permission=(await N.requestPermissions()).display;if(permission!=='granted'){state.enabled=false;LB.toast('Allow notifications in Android app settings to enable reminders.');return R.sync();}state.enabled=true;D.receive=true;await R.sync();};
  R.disablePush=async()=>{state.enabled=false;state.testSentAt=0;await R.sync();await N.removeAllDeliveredNotifications();LB.toast('Native reminders turned off.');};
  R.enableNotifications=R.enableReminders;R.enablePush=R.enableReminders;
  R.checkServer=async()=>({status:'none'});
  R.statuses=()=>({device:{ok:true,text:'Native Android local notifications'},permission:{ok:permission==='granted',text:permission==='granted'?'Allowed':permission==='denied'?'Blocked in Android app settings':'Not allowed yet'},server:{ok:true,text:'Not required: scheduled on this device'},scheduling:{ok:state.status==='ok',text:state.error||(!state.enabled?'Off':D.receive===false?'Off on this device':state.count+' reminders scheduled on this device')},delivery:{ok:null,text:state.testSentAt?'Test scheduled. Confirm that you saw it on the phone; closed-app delivery still needs device testing.':'Not verified on a real device'}});
  R.deliveryNote=()=>state.status==='ok'?'Native reminders: '+state.count+' scheduled on this device. Delivery is subject to Android settings.':'Native reminders are '+(state.error||'off. Enable them in Settings.');
  A.testPush=async()=>{await R.sync();if(!state.enabled){LB.toast('Enable reminders first.');return false;}await N.schedule({notifications:[{id:2147483647,title:'LifeBalance',body:'Your test reminder has arrived.',smallIcon:'ic_notification',isExactNotification:!!state.exact,isExactMandatory:!!state.exact,channelId:R.channelId,schedule:{at:new Date(Date.now()+15000)},extra:{test:true}}]});state.testSentAt=Date.now();refresh();LB.toast('Test scheduled in 15 seconds. Close the app and check your phone.');return false;};
  A.allowExactAlarms=async()=>{try{await N.changeExactNotificationSetting();await R.sync();LB.toast(state.exact?'Precise alarm timing allowed. Schedule refreshed.':'Precise timing is not allowed. Android may delay alerts.');}catch(e){LB.toast('Open Android Settings > Apps > Special app access > Alarms & reminders, then allow LifeBalance.');}return false;};
  A.openReminderDeviceSettings=async()=>{try{await toneApi.openAppSettings();}catch(e){LB.toast('Open Android Settings > Apps > LifeBalance and check notifications and battery restrictions.');}return false;};
  const snooze=A.snooze;A.snooze=el=>{const push=D.push.enabled;D.push.enabled=false;const result=snooze(el);D.push.enabled=push;for(const s of Object.values(D.snoozes)){if(s.alert.evId&&!s.alert.rev)s.alert.rev=revision(s.alert.evId);}LB.saveD();R.syncSoon();LB.toast('Snoozed on this device.');return result;};
  const init=R.init;
  R.init=async()=>{
    let started=false;
    try{
    await N.createChannel({id:'lifebalance-reminders',name:'LifeBalance reminders',importance:4,visibility:0});
    await N.registerActionTypes({types:[{id:'LB_REMINDER',actions:[{id:'snooze10',title:'Snooze 10 min',foreground:true},{id:'snooze60',title:'Snooze 1 hour',foreground:true}]}]});
    await N.addListener('localNotificationActionPerformed',async action=>{
      const n=action.notification,x=n.extra||{};
      if(x.lb&&state.enabled&&D.receive!==false&&!D.demo&&active(x)){
        if(action.actionId==='snooze10'||action.actionId==='snooze60'){
          const key=x.key+'|s'+Date.now();D.snoozes[key]={until:Date.now()+(action.actionId==='snooze60'?60:10)*60000,alert:{id:x.key,evId:x.evId,occKey:x.occKey,rev:x.rev,title:n.title,body:n.body}};LB.saveD();await R.sync();
        }
      }
      await N.removeDeliveredNotifications({notifications:[n]});LB.ui.view='settings';LB.render();
    });
    await app.addListener('appStateChange',async s=>{if(s.isActive){LB.tz=Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';await R.sync();}});
    started=true;await init();await R.sync();
    }catch(e){state.status='failed';state.error='Reminder startup failed: '+String(e.message||e);state.count=0;state.next=[];refresh();if(!started)await init();}
  };
  // The web timer only populates the in-app tray. Pending native alarms fire without JS.
  return {make,reconcile};
};
