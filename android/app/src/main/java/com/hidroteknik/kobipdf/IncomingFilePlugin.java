package com.hidroteknik.kobipdf;

import android.content.ClipData;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;

import androidx.core.content.IntentCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

/**
 * PDFs handed to kobiPDF by other apps ("Open with" = VIEW, "Share" = SEND).
 *
 * The web side pulls instead of being pushed: MainActivity offers each incoming intent here, the newest
 * one waits in {@link #pending}, and "fileAvailable" only tells the page to look. That way a file that
 * arrives before the page is ready (cold start) is never lost.
 *
 * The page only ever sees a short id, never the content:// URI. {@link #copy} streams the file into the
 * app's cache (no base64 over the bridge, so large PDFs are fine) and checks that it really is a PDF; the
 * page then reads the copy through the local web server and calls {@link #discard}.
 */
@CapacitorPlugin(name = "IncomingFile")
public class IncomingFilePlugin extends Plugin {

    private static final Object LOCK = new Object();
    private static IncomingFilePlugin instance;
    private static String pending;
    private static final Map<String, Entry> entries = new HashMap<>();
    private static int nextId = 1;

    private static final class Entry {
        final Uri uri;
        final String name;
        File copy;

        Entry(Uri uri, String name) {
            this.uri = uri;
            this.name = name;
        }
    }

    /** Called by MainActivity for the launch intent and for every later one (singleTask). */
    static void offer(Context context, Intent intent) {
        Uri uri = extractUri(intent);
        if (uri == null) return;
        String name = displayName(context.getContentResolver(), intent, uri);
        IncomingFilePlugin target;
        synchronized (LOCK) {
            // Only the newest file matters: an older one that was never opened is dropped.
            if (pending != null) entries.remove(pending);
            String id = String.valueOf(nextId++);
            entries.put(id, new Entry(uri, name));
            pending = id;
            target = instance;
        }
        if (target != null) target.notifyListeners("fileAvailable", new JSObject());
    }

    private static Uri extractUri(Intent intent) {
        if (intent == null || intent.getAction() == null) return null;
        if (Intent.ACTION_VIEW.equals(intent.getAction())) return intent.getData();
        if (Intent.ACTION_SEND.equals(intent.getAction())) {
            Uri stream = IntentCompat.getParcelableExtra(intent, Intent.EXTRA_STREAM, Uri.class);
            if (stream != null) return stream;
            ClipData clip = intent.getClipData();
            if (clip != null && clip.getItemCount() > 0) return clip.getItemAt(0).getUri();
        }
        return null;
    }

    /** DISPLAY_NAME, else the share title, else the last URI segment, else a generic name. */
    private static String displayName(ContentResolver resolver, Intent intent, Uri uri) {
        try (Cursor cursor = resolver.query(uri, new String[] { OpenableColumns.DISPLAY_NAME }, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                String name = cursor.getString(0);
                if (name != null && !name.trim().isEmpty()) return name;
            }
        } catch (Exception ignored) {
            // Some providers refuse the query; fall through.
        }
        String title = intent.getStringExtra(Intent.EXTRA_TITLE);
        if (title == null) title = intent.getStringExtra(Intent.EXTRA_SUBJECT);
        if (title != null && !title.trim().isEmpty()) return title;
        String last = uri.getLastPathSegment();
        if (last != null && !last.trim().isEmpty()) return last;
        return "belge.pdf";
    }

    private File incomingDir() {
        return new File(getContext().getCacheDir(), "incoming");
    }

    @Override
    public void load() {
        // Copies left over from an earlier run are of no use.
        File[] old = incomingDir().listFiles();
        if (old != null) for (File f : old) f.delete();
        synchronized (LOCK) {
            instance = this;
        }
    }

    /** The newest waiting file as { id, name }, or {} when there is none. Taking it clears it. */
    @PluginMethod
    public void takePending(PluginCall call) {
        JSObject result = new JSObject();
        synchronized (LOCK) {
            if (pending != null) {
                Entry entry = entries.get(pending);
                if (entry != null) {
                    result.put("id", pending);
                    result.put("name", entry.name);
                }
                pending = null;
            }
        }
        call.resolve(result);
    }

    /** Streams the file into the cache and checks it is a PDF. Resolves { path }. */
    @PluginMethod
    public void copy(PluginCall call) {
        String id = call.getString("id");
        final Entry entry;
        synchronized (LOCK) {
            entry = id == null ? null : entries.get(id);
        }
        if (entry == null) {
            call.reject("unknown file", "ENOENT");
            return;
        }
        new Thread(() -> {
            File dir = incomingDir();
            dir.mkdirs();
            File out = new File(dir, "open-" + id + ".pdf");
            try (InputStream in = getContext().getContentResolver().openInputStream(entry.uri);
                 OutputStream os = new FileOutputStream(out)) {
                if (in == null) throw new IOException("no stream");
                byte[] buffer = new byte[256 * 1024];
                byte[] head = new byte[1024];
                int headLength = 0;
                int read;
                while ((read = in.read(buffer)) != -1) {
                    if (headLength < head.length) {
                        int take = Math.min(read, head.length - headLength);
                        System.arraycopy(buffer, 0, head, headLength, take);
                        headLength += take;
                    }
                    os.write(buffer, 0, read);
                }
                // A PDF starts with "%PDF" (some files have a few junk bytes before it).
                if (!new String(head, 0, headLength, StandardCharsets.ISO_8859_1).contains("%PDF")) {
                    out.delete();
                    call.reject("not a PDF", "CORRUPT");
                    return;
                }
                synchronized (LOCK) {
                    entry.copy = out;
                }
                JSObject result = new JSObject();
                result.put("path", out.getAbsolutePath());
                call.resolve(result);
            } catch (SecurityException e) {
                out.delete();
                call.reject(e.getMessage(), "EACCES");
            } catch (Exception e) {
                out.delete();
                call.reject(e.getMessage(), "UNKNOWN");
            }
        }).start();
    }

    /** Deletes the cached copy and forgets the file. */
    @PluginMethod
    public void discard(PluginCall call) {
        String id = call.getString("id");
        synchronized (LOCK) {
            Entry entry = id == null ? null : entries.remove(id);
            if (entry != null && entry.copy != null) entry.copy.delete();
        }
        call.resolve();
    }
}
