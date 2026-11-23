package com.sukahideng.app;

import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;

import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Status & pengaturan notifikasi tingkat sistem Android.
 * - check(): apakah notifikasi aplikasi diizinkan, dan apakah Firebase terkonfigurasi
 *   (google-services.json ikut di-build). Tanpa Firebase, registrasi FCM tidak boleh dipanggil.
 * - open(): buka pengaturan notifikasi aplikasi (fallback: detail aplikasi).
 */
@CapacitorPlugin(name = "NotificationSettings")
public class NotificationSettingsPlugin extends Plugin {
    @PluginMethod
    public void check(PluginCall call) {
        JSObject result = new JSObject();
        result.put("enabled", NotificationManagerCompat.from(getContext()).areNotificationsEnabled());
        // Plugin google-services menghasilkan resource string google_app_id.
        int appId = getContext().getResources().getIdentifier("google_app_id", "string", getContext().getPackageName());
        result.put("firebase", appId != 0);
        call.resolve(result);
    }

    @PluginMethod
    public void open(PluginCall call) {
        if (getActivity() == null) {
            call.reject("Layar Android belum siap.");
            return;
        }
        try {
            Intent intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                .putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName())
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            JSObject result = new JSObject();
            result.put("opened", true);
            call.resolve(result);
        } catch (Exception notificationSettingsError) {
            try {
                Intent fallback = new Intent(
                    Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                    Uri.parse("package:" + getContext().getPackageName())
                ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(fallback);
                JSObject result = new JSObject();
                result.put("opened", true);
                call.resolve(result);
            } catch (Exception appSettingsError) {
                call.reject("Gagal membuka pengaturan aplikasi.", appSettingsError);
            }
        }
    }
}
