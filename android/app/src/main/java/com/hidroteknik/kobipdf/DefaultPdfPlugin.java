package com.hidroteknik.kobipdf;

import android.content.Context;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.List;

/**
 * Helps the user make kobiPDF the app that opens PDFs. Android never lets an app pick itself, so:
 * - status() tells whether PDFs open in kobiPDF ("default"), in another app chosen with "Always" ("other",
 *   with its name), or whether the system asks every time ("none");
 * - choose() opens a tiny bundled PDF with no chooser of our own, so the system's "Open with" sheet appears
 *   and the user can pick kobiPDF + "Always". When kobiPDF is picked, MainActivity hands that intent here
 *   instead of opening the file, and the page gets "chosen";
 * - openSettings() opens the other app's settings page, where its "Open by default" can be cleared.
 */
@CapacitorPlugin(name = "DefaultPdf")
public class DefaultPdfPlugin extends Plugin {

    private static final String CHECK_DIR = "default-check";
    private static final String CHECK_NAME = "kobipdf-default.pdf";
    private static DefaultPdfPlugin instance;

    @Override
    public void load() {
        instance = this;
    }

    private static String authority(Context context) {
        return context.getPackageName() + ".fileprovider";
    }

    /** True for the intent choose() started, when the user picked kobiPDF. */
    static boolean isCheckIntent(Context context, Intent intent) {
        if (intent == null || !Intent.ACTION_VIEW.equals(intent.getAction())) return false;
        Uri uri = intent.getData();
        return uri != null && authority(context).equals(uri.getAuthority())
            && CHECK_NAME.equals(uri.getLastPathSegment());
    }

    static void chosen() {
        DefaultPdfPlugin target = instance;
        if (target != null) target.notifyListeners("chosen", new JSObject());
    }

    private Intent probe() {
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(Uri.parse("content://" + authority(getContext()) + "/probe.pdf"), "application/pdf");
        return intent;
    }

    /** Resolves { state: "default" | "other" | "none", label?, packageName? }. */
    @PluginMethod
    public void status(PluginCall call) {
        PackageManager pm = getContext().getPackageManager();
        Intent intent = probe();
        JSObject result = new JSObject();
        ResolveInfo resolved = pm.resolveActivity(intent, PackageManager.MATCH_DEFAULT_ONLY);
        if (resolved == null || resolved.activityInfo == null) {
            result.put("state", "none");
            call.resolve(result);
            return;
        }
        ActivityInfo target = resolved.activityInfo;
        if (getContext().getPackageName().equals(target.packageName)) {
            result.put("state", "default");
            call.resolve(result);
            return;
        }
        // When nothing is chosen the system returns its chooser, whose package differs between Android
        // versions and phone makers. It is never one of the apps that can open PDFs, which is what we test.
        boolean isCandidate = false;
        List<ResolveInfo> candidates = pm.queryIntentActivities(intent, PackageManager.MATCH_DEFAULT_ONLY);
        for (ResolveInfo info : candidates) {
            if (info.activityInfo != null && target.packageName.equals(info.activityInfo.packageName)
                && target.name.equals(info.activityInfo.name)) {
                isCandidate = true;
                break;
            }
        }
        if (!isCandidate) {
            result.put("state", "none");
            call.resolve(result);
            return;
        }
        String label = target.packageName;
        try {
            label = pm.getApplicationLabel(pm.getApplicationInfo(target.packageName, 0)).toString();
        } catch (Exception ignored) {
            // The package name is shown instead.
        }
        result.put("state", "other");
        result.put("label", label);
        result.put("packageName", target.packageName);
        call.resolve(result);
    }

    /** Opens the bundled one-page PDF so the system shows its "Open with" sheet. */
    @PluginMethod
    public void choose(PluginCall call) {
        try {
            File dir = new File(getContext().getCacheDir(), CHECK_DIR);
            dir.mkdirs();
            File file = new File(dir, CHECK_NAME);
            if (!file.exists()) {
                try (InputStream in = getContext().getResources().openRawResource(R.raw.default_check);
                     OutputStream out = new FileOutputStream(file)) {
                    byte[] buffer = new byte[8192];
                    int read;
                    while ((read = in.read(buffer)) != -1) out.write(buffer, 0, read);
                }
            }
            Uri uri = FileProvider.getUriForFile(getContext(), authority(getContext()), file);
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, "application/pdf");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage(), "UNKNOWN");
        }
    }

    /** Opens the system settings page of the app that currently opens PDFs. */
    @PluginMethod
    public void openSettings(PluginCall call) {
        String packageName = call.getString("packageName");
        try {
            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
            intent.setData(Uri.fromParts("package", packageName == null ? getContext().getPackageName() : packageName, null));
            getActivity().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject(e.getMessage(), "UNKNOWN");
        }
    }
}
