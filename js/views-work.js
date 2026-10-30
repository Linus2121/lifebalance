/* Work: shared UI for all browsers and the packaged Android application. */
(function(){
 const LB=window.LB,C=LB.C,W=window.LBWork,esc=LB.esc,A=LB.actions,ui=LB.ui;
 const types={shift:'Shift',break:'Break',meeting:'Staff meeting'},tabs=['Overview','Schedule','Days off','Breaks','Meetings'];
 const field=(name,label,value='',type='text',extra='')=>`<div class="field"><label for="wk-${name}">${label}</label><input id="wk-${name}" name="${name}" type="${type}" value="${esc(value)}" ${extra}></div>`;
 const empty=text=>'<p class="muted">'+esc(text)+'</p>';
 const card=(title,body)=>'<section class="card"><h3>'+title+'</h3>'+body+'</section>';
 const link=o=>{try{const u=new URL(o.location);return ['https:','http:'].includes(u.protocol)?'<p><a class="btn alt sm" href="'+esc(u.href)+'" target="_blank" rel="noopener noreferrer">Open meeting link</a></p>':'';}catch(e){return '';}};
 const rows=a=>a.length?a.map(o=>LB.occRow(o)+ (o.workKind==='meeting'?link(o):'')).join(''):empty('No work commitments in this period.');
 const stats=b=>`<div class="stats"><div class="stat"><span>Total days</span><b>${b.total}</b></div><div class="stat"><span>Days used/booked</span><b>${b.used}</b></div><div class="stat"><span>Days remaining</span><b>${b.remaining}</b></div></div>`;
 const leaves=(S,year)=>S.work.leave.filter(l=>l.allocations.some(a=>+a.date.slice(0,4)===year)||+l.start.slice(0,4)===year);
 function leavePanel(){
  const S=LB.S,year=ui.workYear||+LB.today().slice(0,4),b=W.balance(S,year),l=S.work.leave.find(x=>x.id===ui.workLeaveId);
  return card('Annual leave',`<p class="small muted">Personal records only. Booking here does not submit a request to your employer. Future bookings are included in days used/booked.</p><form data-s="workAllowance" class="row">${field('year','Leave year',year,'number','min="2000" max="2200" required data-c="workYear"')}${field('allowance','Total annual leave days',b.total,'number','min="0" max="366" step="0.5" required')}<button class="btn">Save allowance</button></form>${stats(b)}${b.remaining<0?'<p class="note">Bookings exceed this year\'s allowance.</p>':''}`)+
   card(l?'Edit day off':'Book days off',`<form data-s="workLeave"><input type="hidden" name="id" value="${esc(l?.id||'')}"><div class="grid2">${field('start','First day off',l?.start||LB.today(),'date','required')}${field('end','Last day off',l?.end||LB.today(),'date','required')}</div>${field('deduct','Days to deduct (blank = calculate)',l?l.allocations.reduce((n,a)=>n+a.days,0):'','number','min="0" max="367" step="0.5"')}<p class="small muted">When shifts are scheduled, their start dates count as working days. Otherwise, use the working days below. A manual adjustment deducts from the earliest eligible dates; any extra days use the other dates in the range. Overlapping dates count once.</p>${field('leaveNotes','Optional note',l?.notes||'','text','maxlength="500"')}<div class="row"><button class="btn">Review days off</button>${l?'<button type="button" class="btn alt" data-a="workLeaveCancel">Cancel edit</button>':''}</div></form>`)+
   card('Working days for leave calculations',`<form data-s="workDays"><fieldset><legend>Used when you have no shift records</legend>${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d,i)=>`<label class="check inline"><input name="days" type="checkbox" value="${i}" ${S.work.workingDays.includes(i)?'checked':''}>${d}</label>`).join('')}</fieldset><button class="btn alt">Save working days</button></form><p class="small muted">Changing this affects new bookings. Existing deductions stay as recorded.</p>`)+
   card('Booked days off',leaves(S,year).map(l=>`<div class="task"><div class="grow"><b>${esc(LB.fmtDate(l.start,true))} – ${esc(LB.fmtDate(l.end,true))}</b><div>${l.allocations.reduce((n,a)=>n+a.days,0)} days recorded${l.notes?' · '+esc(l.notes):''}</div></div><button class="btn alt sm" data-a="workLeaveEdit" data-id="${esc(l.id)}">Edit</button><button class="btn danger sm" data-a="workLeaveDelete" data-id="${esc(l.id)}">Delete</button></div>`).join('')||empty('No days off booked for this year.'));
 }
 function calendar(S){
  const month=ui.workMonth||LB.today().slice(0,8)+'01',last=C.addDays(C.addMonths(month,1,1),-1),first=C.addDays(month,-((C.parseDate(month).getUTCDay()+6)%7)),end=C.addDays(last,(7-C.parseDate(last).getUTCDay())%7),selected=ui.workSelected||LB.today(),occ=W.occurrences(S,first,end);
  let h=`<div class="row between"><button class="btn alt" data-a="workMonth" data-arg="-1" aria-label="Previous month">←</button><b>${esc(C.parseDate(month).toLocaleDateString(undefined,{timeZone:'UTC',month:'long',year:'numeric'}))}</b><button class="btn alt" data-a="workMonth" data-arg="1" aria-label="Next month">→</button></div><div class="cal work-cal">`;
  h+=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(x=>'<div class="dh">'+x+'</div>').join('');
  for(let d=first;d<=end;d=C.addDays(d,1)){const n=occ.filter(o=>o.date<=d&&o.endDate>=d).length,off=S.work.leave.some(l=>l.allocations.some(a=>a.date===d));h+=`<button type="button" data-a="workDate" data-arg="${d}" aria-pressed="${d===selected}" class="${d.slice(0,7)!==month.slice(0,7)?'out':''}" aria-label="${esc(LB.fmtDate(d,true))}, ${n} work commitments${off?', day off':''}">${+d.slice(8)}<small>${n?n+' work':''}${off?' · Off':''}</small></button>`;}
  h+='</div><h3 style="margin-top:16px">'+esc(LB.fmtDate(selected,true))+'</h3>';
  if(S.work.leave.some(l=>l.allocations.some(a=>a.date===selected)))h+='<p class="badge">Day off booked</p>';
  return h+rows(occ.filter(o=>o.date<=selected&&o.endDate>=selected));
 }
 LB.views.work=()=>{
  const S=LB.S,t=LB.today(),section=ui.workSection||'Overview',from=ui.workFrom||t,to=C.addDays(from,35),occ=W.occurrences(S,from,to);
  let h='<div class="row between"><h2>Work</h2><span class="badge">Plan your working day</span></div><div class="seg" role="group" aria-label="Work sections">'+tabs.map(x=>`<button data-a="workSection" data-arg="${x}" aria-pressed="${section===x}">${x}</button>`).join('')+'</div>';
  h+='<div class="row work-add">'+Object.entries(types).map(([k,v])=>`<button class="btn ${k==='shift'?'':'alt'}" data-a="workNew" data-arg="${k}">Add ${v.toLowerCase()}</button>`).join('')+'</div>';
  if(section==='Days off')return h+leavePanel();
  if(section==='Overview'){
   h+=card('Today at work',rows(W.occurrences(S,t,t)));
   h+=card('Annual leave · '+t.slice(0,4),stats(W.balance(S,+t.slice(0,4)))+'<p><button class="btn alt" data-a="workSection" data-arg="Days off">Book days off</button></p>');
   const checks=occ.slice(0,80).flatMap(o=>{const e=S.events.find(e=>e.id===o.evId);return W.warnings(S,e);});
   if(checks.length)h+=card('Schedule checks',[...new Set(checks)].slice(0,8).map(x=>'<p class="note">'+esc(x)+'</p>').join('')+'<p class="small muted">Checks cover the next 35 days; review changes beyond that period separately.</p>');
   return h+card('Coming up',rows(occ.slice(0,12)));
  }
  if(section==='Schedule'){
   h+='<div class="seg"><button data-a="workView" data-arg="agenda" aria-pressed="'+(ui.workView!=='calendar')+'">Agenda</button><button data-a="workView" data-arg="calendar" aria-pressed="'+(ui.workView==='calendar')+'">Calendar</button></div>';
   if(ui.workView==='calendar')return h+card('Work calendar',calendar(S));
   h+=`<form data-s="workRange" class="row">${field('from','Show from',from,'date','required')}<button class="btn alt">Show 35 days</button></form>`;
  }
  return h+card(section==='Schedule'?'Work agenda':section,rows(occ.filter(o=>section==='Breaks'?o.workKind==='break':section==='Meetings'?o.workKind==='meeting':true)));
 };
 A.workSection=el=>{ui.workSection=el.dataset.arg;ui.workLeaveId='';};A.workView=el=>{ui.workView=el.dataset.arg;};
 A.workMonth=el=>{ui.workMonth=C.addMonths(ui.workMonth||LB.today().slice(0,8)+'01',+el.dataset.arg,1);};A.workDate=el=>{ui.workSelected=el.dataset.arg;};
 LB.changes.workYear=el=>{const y=+el.value;if(Number.isInteger(y)&&y>=2000&&y<=2200)ui.workYear=y;else return 'none';};
 LB.submits.workRange=f=>{ui.workFrom=f.elements.from.value;};
 A.workNew=el=>{ui.workKind=el.dataset.arg;ui.view='workForm';};
 A.workClose=()=>{ui.view=null;};
 LB.views.workForm=()=>{
  const kind=ui.workKind||'shift',t=LB.today();
  return `<h2>Add ${types[kind].toLowerCase()}</h2><form class="card" data-s="workEvent" id="workEventForm"><input type="hidden" name="kind" value="${kind}">${field('title',kind==='meeting'?'Meeting title':kind==='break'?'Break name':'Shift name',kind==='shift'?'Work shift':kind==='break'?'Lunch break':'','text','maxlength="120" required')}<div class="grid2">${field('date','Date',t,'date','required')}${field('startTime','Start time',kind==='break'?'13:00':'09:00','time','required')}${field('endTime','End time',kind==='break'?'13:30':kind==='meeting'?'10:00':'17:00','time','required')}${field('tz','Time zone',LB.tz,'text','required list="workTimeZones"')}</div><datalist id="workTimeZones">${['UTC','Europe/Dublin','Europe/London','America/New_York','Africa/Lagos','Asia/Kolkata','Australia/Sydney'].map(x=>'<option value="'+x+'">').join('')}</datalist><p class="small muted">An end time before the start time ends the following day. Equal start and end times are not allowed.</p>${field('location',kind==='meeting'?'Location or meeting link':'Workplace','', 'text','maxlength="200"')}${kind==='meeting'?field('participants','Participant names (optional)','','text','maxlength="100"'):''}<div class="field"><label for="wk-notes">${kind==='meeting'?'Agenda and preparation notes':'Notes'}</label><textarea id="wk-notes" name="notes" maxlength="2000"></textarea></div><div class="grid2"><div class="field"><label for="wk-repeat">Repeat</label><select name="freq" id="wk-repeat"><option value="none">Does not repeat</option><option value="daily">Daily</option><option value="weekly">Weekly on this weekday</option><option value="fortnightly">Every two weeks</option><option value="monthly">Monthly</option></select></div>${field('until','Repeat until (optional)','','date')}</div><p class="small muted">For different shifts on different weekdays, add each weekday's shift and select weekly. Individual dates can then be edited or cancelled.</p><fieldset><legend>Start reminders</legend>${C.PRESET_OFFSETS.map(o=>`<label class="check inline"><input type="checkbox" name="offset" value="${o.min}" ${o.min===0?'checked':''}>${esc(o.label)}</label>`).join('')}</fieldset>${kind==='break'?'<label class="check"><input type="checkbox" name="endReminder">Also remind me when the break ends</label>':''}<p class="small muted">At event time is selected initially. Review exact alert times before confirming. Notification permission and platform delivery limits still apply.</p><div class="row"><button class="btn">Review and save</button><button type="button" class="btn alt" data-a="workClose">Cancel</button></div></form>`;
 };
 LB.submits.workEvent=async f=>{
  const v=n=>f.elements[n]?.value||'',kind=v('kind'),date=v('date'),start=v('startTime'),end=v('endTime'),tz=v('tz');
  if(!types[kind]||!v('title').trim()||!C.isDate(date)||!C.isTime(start)||!C.isTime(end)||start===end||!C.isTz(tz)){LB.toast('Check the title, date, distinct start/end times and time zone.');return false;}
  if(v('until')&&(!C.isDate(v('until'))||v('until')<date)){LB.toast('Repeat until must be on or after the start date.');return false;}
  const offsets=[...f.querySelectorAll('[name=offset]:checked')].map(x=>+x.value),freq=v('freq');
  const e=C.cleanEvent({id:C.uid(),workKind:kind,endReminder:!!f.elements.endReminder?.checked,title:v('title'),category:'Work',date,startTime:start,endTime:end,endDate:end<start?C.addDays(date,1):'',tz,endTz:tz,location:v('location'),notes:v('notes'),contact:{name:v('participants')},recurrence:{freq:freq==='fortnightly'?'weekly':freq,interval:freq==='fortnightly'?2:1,until:v('until')},reminders:{offsets}});
  const conflicts=W.warnings(LB.S,e),preview=C.reminderPreview(e,Date.now()),alerts=preview?.items||[];
  const body='<p><b>'+esc(e.title)+'</b> · '+esc(date+' '+start+' → '+(end<start?C.addDays(date,1)+' ':'')+end)+' ('+esc(tz)+')</p>'+conflicts.map(x=>'<p class="note">'+esc(x)+'</p>').join('')+'<h3>Next alert times</h3>'+(alerts.length?'<ul>'+alerts.map(r=>'<li>'+esc(LB.fmtInstant(r.at,tz))+' · '+esc(r.label)+(r.past?' (already past; skipped)':'')+'</li>').join('')+'</ul>':'<p>No future reminders for this selection. Already-past alert times are skipped.</p>')+'<p class="small muted">'+esc(LB.rem.deliveryNote())+'</p>';
  if(!await LB.confirm('Review work commitment',body,'Save commitment'))return false;
  LB.S.events.push(e);LB.save();ui.view=null;LB.toast('Work commitment saved.');
 };
 LB.submits.workAllowance=f=>{const year=+f.elements.year.value,days=+f.elements.allowance.value;if(!Number.isInteger(year)||year<2000||year>2200||!Number.isFinite(days)||days<0||days>366){LB.toast('Enter a valid year and allowance.');return false;}const a=LB.S.work.allowances;const i=a.findIndex(x=>x.year===year);const entry={id:String(year),year,days};if(i<0)a.push(entry);else a[i]=entry;ui.workYear=year;LB.save();};
 LB.submits.workDays=f=>{LB.S.work.workingDays=[...f.querySelectorAll('[name=days]:checked')].map(x=>+x.value);LB.save();};
 A.workLeaveEdit=el=>{ui.workLeaveId=el.dataset.id;};A.workLeaveCancel=()=>{ui.workLeaveId='';};
 A.workLeaveDelete=async el=>{if(await LB.confirm('Delete this day-off booking?','<p>The annual leave balance will be recalculated.</p>','Delete booking',true))LB.remove(()=>LB.S.work.leave,el.dataset.id,'Day off');};
 LB.submits.workLeave=async f=>{
  const v=n=>f.elements[n].value,id=v('id')||C.uid();let allocations;
  try{allocations=W.allocate(LB.S,v('start'),v('end'),v('deduct'));}catch(e){LB.toast(e.message);return false;}
  const entry={id,start:v('start'),end:v('end'),notes:v('leaveNotes').trim().slice(0,500),allocations},candidate={...LB.S,work:{...LB.S.work,leave:LB.S.work.leave.filter(l=>l.id!==id).concat(entry)}};
  const years=[...new Set([+entry.start.slice(0,4),+entry.end.slice(0,4)])],negative=years.some(y=>W.balance(candidate,y).remaining<0);
  const body='<p>'+allocations.reduce((n,a)=>n+a.days,0)+' day(s) allocated. Overlapping dates will be deducted only once.</p><ul>'+allocations.map(a=>'<li>'+esc(LB.fmtDate(a.date,true))+' · '+a.days+' day</li>').join('')+'</ul>'+years.map(y=>'<h3>'+y+'</h3>'+stats(W.balance(candidate,y))).join('')+(negative?'<p class="note">This exceeds the allowance entered. You can correct the allowance or continue.</p>':'')+'<p class="small muted">Personal record only; no request will be sent to your employer.</p>';
  if(!await LB.confirm('Review leave deduction',body,'Book days off'))return false;
  LB.S.work.leave=candidate.work.leave;ui.workLeaveId='';ui.workYear=+entry.start.slice(0,4);LB.save();LB.toast('Days off booked. Balance updated.');
 };
 LB.workToday=()=>{const t=LB.today(),a=W.occurrences(LB.S,t,t),off=LB.S.work.leave.some(l=>l.allocations.some(x=>x.date===t));return a.length||off?card('Work today',(off?'<p class="badge">Day off booked</p>':'')+rows(a)+'<button class="btn alt" data-a="go" data-arg="work">Open Work</button>'):'';};
})();
