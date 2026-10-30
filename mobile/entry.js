import { registerPlugin } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { App } from '@capacitor/app';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import install from './notifications.cjs';
import soundPanel from './sound-panel.cjs';
const LB=window.LB;
const AlertTone=registerPlugin('AlertTone');
install(LB,LocalNotifications,App,AlertTone);
let toneName='Device default';
LB.actions.customAlertTone=async()=>{
 try{const result=await AlertTone.importCustom();if(!result.cancelled){await LB.rem.sync();await refreshTone();LB.toast('Custom ringtone selected. Use the 15-second test to hear it.');}}
 catch(e){LB.toast(e.message||'Could not import this audio clip.');}return false;
};
LB.actions.deviceAlertTone=async()=>{try{await AlertTone.useDeviceTone();await LB.rem.sync();await refreshTone();await AlertTone.choose();}catch(e){LB.toast('Could not open device tone settings.');}return false;};
async function refreshTone(){
 try{toneName=(await AlertTone.current()).name||'Device default';if(LB.ui.view==='settings')LB.render();}catch(e){toneName='Managed in Android settings';}
}
LB.actions.chooseAlertTone=async()=>{
 try{await LocalNotifications.createChannel({id:'lifebalance-reminders',name:'LifeBalance reminders',importance:4,visibility:0});await AlertTone.choose();}
 catch(e){LB.toast('Could not open sound settings. Open Android Settings > Apps > LifeBalance > Notifications.');}
 return false;
};
App.addListener('appStateChange',state=>{if(state.isActive)refreshTone();}).catch(()=>{});
refreshTone();
// Avoid presenting web-server requirements as requirements for native reminders.
const settings=LB.views.settings;
LB.views.settings=()=>{
 let h=settings();const p=LB.D.nativeRem;
 h=h.replace('</h2>','</h2><span class="badge">Android app 1.1.0</span>');
 h=h.replace(/Reminders always appear inside the app while it is open\.[\s\S]*?<\/p>/,'Android schedules reminders on this phone, including when the app is closed. No reminder server is required.</p>');
 h=h.replace(/Limits: closed-app reminders need HTTPS[\s\S]*?<\/details>/,'Limits: the next 45 days (up to 300 alerts) are scheduled. Reopen the app regularly to refresh schedules, especially after time-zone changes. Android battery restrictions, force-stop and notification settings can delay or prevent alerts. Snooze actions open LifeBalance to schedule the next alert. Use Allow precise reminder timing for exact alarms where Android permits; other device restrictions still apply. Real-device delivery has not been verified.</p>');
 h=h.replace(/<p class="err" role="alert">[\s\S]*?<\/p>/g,m=>m.includes('reminder service')?'':m);
 // Settings uses web push state for its controls; replace just this button group.
 const start=h.indexOf('<div class="row">',h.indexOf('aria-labelledby="ntH"'));
 const end=h.indexOf('</div>',start);
 if(start>=0&&end>=0)h=h.slice(0,start)+'<div class="row">'+(p.enabled?'<button class="btn" data-a="testPush">Test native reminder in 15 sec</button><button class="btn alt" data-a="retryPush">Refresh schedule</button><button class="btn danger" data-a="disablePush">Turn off native reminders</button>':'<button class="btn" data-a="enableReminders">Enable native reminders</button>')+'</div>'+h.slice(end+6);
 h=h.replace('Export backup (JSON)' ,'Save or share backup (JSON)');
 h=h.replace('<div class="row"><button type="button" class="btn" data-a="exportData">','<p class="small">Moving from the website? Export a JSON backup in the browser, save it to this phone, then choose Import backup here. Review the record counts before confirming. The browser copy stays unchanged; the app keeps a restore copy before replacement. Backups contain private information.</p><div class="row"><button type="button" class="btn" data-a="exportData">');
 const sounds=soundPanel(LB.esc,toneName,p.enabled,p);
 // Always render the panel, independently of reminder status/help text.
 const headingEnd=h.indexOf('</div>');
 return headingEnd>=0?h.slice(0,headingEnd+6)+sounds+h.slice(headingEnd+6):sounds+h;
};
async function shareFile(name,text){
 const path='exports/'+name.replace(/[^a-zA-Z0-9._-]/g,'_');
 const file=await Filesystem.writeFile({path,data:text,directory:Directory.Cache,encoding:Encoding.UTF8,recursive:true});
 await Share.share({title:'LifeBalance export',files:[file.uri],dialogTitle:'Save or share your LifeBalance file'});
 // Keep the temporary file until the destination has had time to read it.
 // Files live in app-private cache and are not a durable backup.
}
LB.actions.exportData=async()=>{
 try{await shareFile('lifebalance-backup-'+LB.today()+'.json',LB.C.exportData(LB.personal));LB.D.lastExport=Date.now();LB.saveD();LB.toast('Share sheet completed. Check that your backup was saved to your chosen location.');}
 catch(e){LB.toast('Backup was not exported. Your app data is unchanged.');}return false;
};
LB.download=(name,type,text)=>shareFile(name,text).catch(()=>LB.toast('File export was cancelled or failed.'));
