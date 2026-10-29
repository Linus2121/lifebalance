package com.lambtechnologies.lifebalance;

import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.content.ContentValues;
import android.content.Context;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.media.AudioAttributes;
import android.media.MediaMetadataRetriever;
import android.os.Environment;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.annotation.ActivityCallback;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.security.MessageDigest;
import android.app.NotificationManager;
import android.content.Intent;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AlertTone")
public class AlertTonePlugin extends Plugin {
    private static final String CHANNEL = "lifebalance-reminders";

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences("lifebalance_alert_tone", Context.MODE_PRIVATE);
    }
    private String activeChannel() { return prefs().getString("channel", CHANNEL); }

    @PluginMethod
    public void useDeviceTone(PluginCall call) {
        prefs().edit().remove("channel").apply();
        current(call);
    }

    @PluginMethod
    public void importCustom(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            call.reject("Custom audio import needs Android 10 or later. Use device tone settings on this device.");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.setType("audio/*");
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        try { startActivityForResult(call, intent, "audioPicked"); }
        catch (Exception error) { call.reject("Could not open the audio file picker", error); }
    }

    @ActivityCallback
    private void audioPicked(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            JSObject answer = new JSObject(); answer.put("cancelled", true); call.resolve(answer); return;
        }
        Uri source = result.getData().getData();
        getBridge().execute(() -> copyAudio(call, source));
    }

    private void copyAudio(PluginCall call, Uri source) {
        Uri created = null;
        try {
            String mime = getContext().getContentResolver().getType(source);
            if (mime == null || !mime.startsWith("audio/")) throw new Exception("Choose a supported audio file.");
            String title = "Custom alert";
            try (Cursor cursor = getContext().getContentResolver().query(source, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) {
                if (cursor != null && cursor.moveToFirst()) title = cursor.getString(0);
            }
            if (title == null) title = "Custom alert";
            title = title.replaceAll("[^a-zA-Z0-9._ -]", "_");
            if (title.length() > 80) title = title.substring(0, 80);
            byte[] data;
            try (InputStream input = getContext().getContentResolver().openInputStream(source);
                 ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                if (input == null) throw new Exception("Could not read the selected file.");
                byte[] buffer = new byte[8192]; int read; int total = 0;
                while ((read = input.read(buffer)) != -1) {
                    total += read;
                    if (total > 5 * 1024 * 1024) throw new Exception("Choose an audio clip smaller than 5 MB.");
                    output.write(buffer, 0, read);
                }
                data = output.toByteArray();
            }
            if (data.length == 0) throw new Exception("The selected audio file is empty.");
            MediaMetadataRetriever metadata = new MediaMetadataRetriever();
            try {
                metadata.setDataSource(getContext(), source);
                String duration = metadata.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION);
                if (duration == null || Long.parseLong(duration) <= 0 || Long.parseLong(duration) > 30000)
                    throw new Exception("Choose a playable audio clip lasting up to 30 seconds.");
            } finally { metadata.release(); }
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(data);
            StringBuilder hash = new StringBuilder();
            for (int i = 0; i < 12; i++) hash.append(String.format("%02x", digest[i] & 0xff));
            String id = "lifebalance-custom-" + hash;
            NotificationManager manager = getContext().getSystemService(NotificationManager.class);
            NotificationChannel existing = manager.getNotificationChannel(id);
            if (existing != null && existing.getSound() != null) {
                // Reuse a channel only if its media is still readable; do not reset user sound choices.
                try (InputStream check = getContext().getContentResolver().openInputStream(existing.getSound())) {
                    if (check != null) { prefs().edit().putString("channel", id).apply(); current(call); return; }
                } catch (Exception ignored) { }
                id += "-" + System.currentTimeMillis();
            } else if (existing != null) {
                // A user-muted category stays muted when reselected.
                prefs().edit().putString("channel", id).apply(); current(call); return;
            }
            ContentValues values = new ContentValues();
            values.put(MediaStore.Audio.Media.DISPLAY_NAME, "LifeBalance-" + hash + "-" + title);
            values.put(MediaStore.Audio.Media.TITLE, title);
            values.put(MediaStore.Audio.Media.MIME_TYPE, mime);
            values.put(MediaStore.Audio.Media.RELATIVE_PATH, Environment.DIRECTORY_NOTIFICATIONS + "/LifeBalance");
            values.put(MediaStore.Audio.Media.IS_PENDING, 1);
            created = getContext().getContentResolver().insert(MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY), values);
            if (created == null) throw new Exception("Could not save the custom tone.");
            try (OutputStream output = getContext().getContentResolver().openOutputStream(created)) {
                if (output == null) throw new Exception("Could not write the custom tone.");
                output.write(data);
            }
            values.clear(); values.put(MediaStore.Audio.Media.IS_PENDING, 0);
            getContext().getContentResolver().update(created, values, null, null);
            NotificationChannel channel = new NotificationChannel(id, "LifeBalance custom: " + title, NotificationManager.IMPORTANCE_HIGH);
            channel.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
            channel.setSound(created, new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
            manager.createNotificationChannel(channel);
            prefs().edit().putString("channel", id).apply();
            current(call);
        } catch (Exception error) {
            if (created != null) { try { getContext().getContentResolver().delete(created, null, null); } catch (Exception ignored) {} }
            call.reject(error.getMessage() == null ? "Could not import this audio file." : error.getMessage());
        }
    }

    @PluginMethod
    public void current(PluginCall call) {
        JSObject result = new JSObject();
        String name = "Device default";
        boolean silent = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = getContext().getSystemService(NotificationManager.class);
            NotificationChannel channel = manager.getNotificationChannel(activeChannel());
            if (channel != null) {
                Uri sound = channel.getSound();
                silent = sound == null || channel.getImportance() < NotificationManager.IMPORTANCE_DEFAULT;
                if (silent) name = "Silent";
                else {
                    try {
                        android.media.Ringtone ringtone = RingtoneManager.getRingtone(getContext(), sound);
                        name = ringtone == null ? "Selected device tone" : ringtone.getTitle(getContext());
                    } catch (Exception ignored) { name = "Selected device tone"; }
                }
            }
        }
        result.put("name", name);
        result.put("channelId", activeChannel());
        result.put("silent", silent);
        call.resolve(result);
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            getActivity().startActivity(intent);
            call.resolve();
        } catch (Exception error) { call.reject("Could not open app settings", error); }
    }

    @PluginMethod
    public void choose(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                Intent intent;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    intent = new Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS);
                    intent.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
                    intent.putExtra(Settings.EXTRA_CHANNEL_ID, activeChannel());
                } else {
                    intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                    intent.putExtra("app_package", getContext().getPackageName());
                    intent.putExtra("app_uid", getContext().getApplicationInfo().uid);
                }
                getActivity().startActivity(intent);
                call.resolve();
            } catch (Exception error) {
                call.reject("Could not open Android sound settings", error);
            }
        });
    }
}
