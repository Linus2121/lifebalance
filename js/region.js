/* Regional display preferences. Stored per device; records remain in kg/km and ISO dates. */
(function(root){
  const api={
    toDisplay:(v,kind,imperial)=>v==null?null:Number(v)*(imperial?(kind==='distance'?1/1.609344:2.20462262185):1),
    toMetric:(v,kind,imperial)=>v==null?null:Number(v)/(imperial?(kind==='distance'?1/1.609344:2.20462262185):1)
  };
  if(typeof module!=='undefined'&&module.exports){module.exports=api;return;}
  const LB=root.LB,esc=LB.esc;
  LB.region=Object.assign({locale:'auto',clock:'auto',units:'metric'},LB.D.region||{});
  LB.imperial=()=>LB.region.units==='imperial';
  LB.unit=k=>k==='distance'?(LB.imperial()?'mi':'km'):(LB.imperial()?'lb':'kg');
  LB.displayValue=(v,k)=>api.toDisplay(v,k,LB.imperial());
  LB.metricValue=(v,k)=>api.toMetric(v,k,LB.imperial());
  LB.measure=(v,k)=>LB.num(LB.displayValue(v,k))+' '+LB.unit(k);
  const locale=()=>LB.region.locale==='auto'?undefined:LB.region.locale;
  const clock=()=>LB.region.clock==='auto'?{}:{hour12:LB.region.clock==='12'};
  LB.fmtDate=(k,long)=>LB.C.parseDate(k).toLocaleDateString(locale(),{timeZone:'UTC',weekday:'short',day:'numeric',month:'short',...(long?{year:'numeric'}:{})});
  LB.fmtInstant=(ms,tz)=>new Date(ms).toLocaleString(locale(),{timeZone:tz||LB.tz,weekday:'short',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZoneName:'short',...clock()});
  LB.regionCard=()=>{
    const options=(list,val)=>list.map(([k,n])=>`<option value="${k}" ${k===val?'selected':''}>${n}</option>`).join('');
    return `<section class="card"><h2>Region &amp; units</h2><p class="muted small">Choose the formats that feel familiar. The interface is currently in English.</p><form data-s="saveRegion" class="grid2"><div><label for="region-format">Date region</label><select id="region-format" name="locale">${options([['auto','Use device region'],['en-IE','Ireland'],['en-GB','United Kingdom'],['en-US','United States'],['en-CA','Canada'],['en-AU','Australia'],['en-NG','Nigeria'],['en-ZA','South Africa'],['en-IN','India'],['es-ES','Spain'],['fr-FR','France'],['pt-BR','Brazil'],['zh-CN','China']],LB.region.locale)}</select></div><div><label for="region-clock">Clock format</label><select id="region-clock" name="clock">${options([['auto','Use device preference'],['12','12-hour'],['24','24-hour']],LB.region.clock)}</select></div><div><label for="region-units">Fitness units</label><select id="region-units" name="units">${options([['metric','Metric (km, kg)'],['imperial','Imperial (miles, pounds)']],LB.region.units)}</select></div><p class="muted small full">Current time zone: ${esc(LB.tz)} (from your device). Choose a different time zone on individual appointments when travelling. Changing display settings never changes stored measurements or reminder times. Recipe quantities retain their labelled units.</p><div><button class="btn">Save preferences</button></div></form></section>`;
  };
  LB.submits.saveRegion=f=>{const d=new FormData(f),locale=d.get('locale'),clock=d.get('clock'),units=d.get('units');if(!['auto','12','24'].includes(clock)||!['metric','imperial'].includes(units))return false;try{if(locale!=='auto')new Intl.DateTimeFormat(locale);}catch(e){LB.toast('Choose a valid region.');return false;}LB.region={locale,clock,units};LB.D.region=LB.region;LB.saveD();LB.toast('Regional preferences saved on this device.');};
})(typeof window!=='undefined'?window:globalThis);
