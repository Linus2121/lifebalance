/* Shared Work calculations. No OS APIs; browser and native builds use the same records. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./core'));else root.LBWork=factory(root.LBCore);})(typeof window!=='undefined'?window:globalThis,function(C){
  const end=o=>C.zonedToUtc(o.endDate||o.date,o.endTime||o.startTime,o.endTz||o.tz);
  const occurrences=(S,from,to)=>C.allOccurrences(S,from,to).filter(o=>o.workKind&&!o.cancelled);
  const weekOf=d=>C.addDays(d,-((C.parseDate(d).getUTCDay()+6)%7));
  // Weeks (Monday-Sunday) with a scheduled shift follow the roster; other weeks use the chosen working days.
  function workingDates(S,start,finish){
    if(!C.isDate(start)||!C.isDate(finish)||finish<start||C.diffDays(start,finish)>366)return [];
    const shiftDays=new Set(occurrences(S,weekOf(start),C.addDays(weekOf(finish),6)).filter(o=>o.workKind==='shift').map(o=>o.date));
    const rostered=new Set([...shiftDays].map(weekOf));
    const out=[];
    for(let d=start;d<=finish;d=C.addDays(d,1)){
      if(rostered.has(weekOf(d))?shiftDays.has(d):S.work.workingDays.includes(C.parseDate(d).getUTCDay()))out.push(d);
    }
    return out;
  }
  function allocate(S,start,finish,override){
    if(!C.isDate(start)||!C.isDate(finish)||finish<start||C.diffDays(start,finish)>366)throw Error('Choose a valid range of up to 367 dates.');
    let dates=workingDates(S,start,finish),total=override===''||override==null?dates.length:Number(override);
    if(!Number.isFinite(total)||total<0||total>C.diffDays(start,finish)+1)throw Error('Days to deduct must be between zero and the number of dates in the range.');
    // Working dates are used first; only the remainder falls on other dates in the range, earliest first.
    if(total>dates.length){const used=new Set(dates);for(let d=start;d<=finish;d=C.addDays(d,1))if(!used.has(d))dates.push(d);}
    const allocations=[];let left=total;
    dates.forEach(date=>{if(left>0){const days=Math.min(1,left);allocations.push({date,days});left=Math.round((left-days)*1000)/1000;}});
    return allocations.sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0);
  }
  function balance(S,year,ignore){
    const dates=new Map();S.work.leave.filter(l=>l.id!==ignore).forEach(l=>l.allocations.forEach(a=>{if(+a.date.slice(0,4)===+year)dates.set(a.date,Math.max(dates.get(a.date)||0,a.days));}));
    const total=S.work.allowances.find(a=>a.year===+year)?.days||0,used=[...dates.values()].reduce((a,b)=>a+b,0);
    return {total,used:Math.round(used*1000)/1000,remaining:Math.round((total-used)*1000)/1000};
  }
  function warnings(S,event){
    const from=event.date,to=C.addDays(from,35),candidate=C.occurrences(event,from,to).filter(o=>!o.cancelled);
    const others=occurrences(S,C.addDays(from,-1),C.addDays(to,1)).filter(o=>o.evId!==event.id),out=new Set();
    candidate.forEach(o=>{const a=C.startInstant(o),b=end(o);
      if(event.workKind==='break'&&!others.some(x=>x.workKind==='shift'&&C.startInstant(x)<=a&&end(x)>=b))out.add('A break is outside a scheduled shift.');
      others.forEach(x=>{if((o.workKind==='shift')!==(x.workKind==='shift'))return;if(a<end(x)&&b>C.startInstant(x))out.add('Overlaps '+x.title+' on '+x.date+'.');});
      if(o.workKind==='shift'&&S.work.leave.some(l=>l.allocations.some(d=>d.date===o.date)))out.add('A shift is scheduled on a booked day off.');
    });
    return [...out];
  }
  return {end,occurrences,workingDates,allocate,balance,warnings};
});
