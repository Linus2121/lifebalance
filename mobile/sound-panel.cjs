module.exports = (esc, name, enabled) => `<section class="card" id="reminderSounds" aria-labelledby="reminderSoundsTitle">
<div class="row between"><h2 id="reminderSoundsTitle">Reminder sounds</h2><span class="badge">Android app 1.0.3</span></div>
<p>Selected tone: <strong>${esc(name)}</strong></p>
<div class="row"><button type="button" class="btn" data-a="customAlertTone">Custom ringtone</button><button type="button" class="btn alt" data-a="deviceAlertTone">Use device tones</button><button type="button" class="btn alt" data-a="chooseAlertTone">Sound settings</button></div>
<p class="small muted">Custom ringtone opens your tablet's audio file picker. Choose a playable clip up to 30 seconds and 5 MB (Android 10+). A copy is saved in Notifications/LifeBalance on this tablet.</p>
<div class="row"><button type="button" class="btn alt" data-a="${enabled?'testPush':'enableReminders'}">${enabled?'Test ringtone in 15 seconds':'Enable reminders to test sound'}</button></div>
<p class="small muted">The selected sound applies to reminders and snoozes on this device. Notification volume, Silent mode and Do Not Disturb still apply.</p></section>`;
