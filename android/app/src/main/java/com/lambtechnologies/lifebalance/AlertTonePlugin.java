package com.lambtechnologies.lifebalance;

import android.app.NotificationChannel;
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

    @PluginMethod
    public void current(PluginCall call) {
        JSObject result = new JSObject();
        String name = "Device default";
        boolean silent = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = getContext().getSystemService(NotificationManager.class);
            NotificationChannel channel = manager.getNotificationChannel(CHANNEL);
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
        result.put("silent", silent);
        call.resolve(result);
    }

    @PluginMethod
    public void choose(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                Intent intent;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    intent = new Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS);
                    intent.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
                    intent.putExtra(Settings.EXTRA_CHANNEL_ID, CHANNEL);
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
