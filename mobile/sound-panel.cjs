module.exports = (esc, name, enabled, timing = {}) => `<section class="card" id="reminderSounds" aria-labelledby="reminderSoundsTitle">
<div class="row between"><h2 id="reminderSoundsTitle">Reminder sounds</h2><span class="badge">Android app 1.1.1</span></div>
<p>Selected tone: <strong>${esc(name)}</strong></p>
<div class="row"><button type="button" class="btn" data-a="customAlertTone">Custom ringtone</button><button type="button" class="btn alt" data-a="deviceAlertTone">Use device tones</button><button type="button" class="btn alt" data-a="chooseAlertTone">Sound settings</button></div>
<p class="small muted">Custom ringtone opens your tablet's audio file picker. Choose a playable clip up to 30 seconds and 5 MB (Android 10+). A copy is saved in Notifications/LifeBalance on this tablet.</p>
<div class="row"><button type="button" class="btn alt" data-a="${enabled?'testPush':'enableReminders'}">${enabled?'Test ringtone in 15 seconds':'Enable reminders to test sound'}</button></div>
<p class="small muted">The selected sound applies to reminders and snoozes on this device. Notification volume, Silent mode and Do Not Disturb still apply.</p><h3>Reminder timing</h3>
<p class="small">${timing.exact?'Precise alarm access: allowed.':'Precise alarm access: not allowed or not checked. Android may delay these alerts.'}</p>
<div class="row"><button type="button" class="btn alt" data-a="allowExactAlarms">Allow precise reminder timing</button><button type="button" class="btn alt" data-a="retryPush">Refresh schedule</button><button type="button" class="btn alt" data-a="openReminderDeviceSettings">Device notification &amp; battery settings</button></div>
<p class="small">Last schedule check: ${timing.updatedAt?esc(new Date(timing.updatedAt).toLocaleString()):'not checked'} · Registered future reminders: ${Number(timing.count)||0}</p>
${timing.error?'<p class="err">'+esc(timing.error)+'</p>':''}
${timing.toneWarning?'<p class="note">'+esc(timing.toneWarning)+'</p>':''}
${timing.silent?'<p class="note">The selected notification category is Silent. Open Sound settings to enable an audible tone.</p>':''}
<h3>Next registered alert times</h3>
${timing.next?.length?'<ul>'+timing.next.map(n=>'<li>'+esc(n.kind)+' — '+esc(new Date(n.at).toLocaleString(undefined,{timeZoneName:'short'}))+'</li>').join('')+'</ul>':'<p class="small">No future alert is shown. Enable reminders and check the appointment date, time zone and selected reminder offsets.</p>'}
<p class="small muted">To alert at the appointment time, select At event time in that appointment. Earlier offsets alone do not create a due-time alert. Exact access cannot override force-stop, Do Not Disturb or blocked notifications. A registered alarm is not proof of delivery.</p>
</section>`;
