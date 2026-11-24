package com.hidroteknik.kobipdf;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(IncomingFilePlugin.class);
        registerPlugin(DefaultPdfPlugin.class);
        super.onCreate(savedInstanceState);
        // A restored activity (process death, or reopened from Recents) gets its original VIEW/SEND intent
        // again, but the read permission for that file is gone: do not open it a second time.
        boolean fromHistory = (getIntent().getFlags() & Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY) != 0;
        if (savedInstanceState == null && !fromHistory && !DefaultPdfPlugin.isCheckIntent(this, getIntent())) IncomingFilePlugin.offer(this, getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        // The little PDF DefaultPdfPlugin.choose() opened came back to us: kobiPDF was picked, nothing to open.
        if (DefaultPdfPlugin.isCheckIntent(this, intent)) {
            DefaultPdfPlugin.chosen();
            return;
        }
        setIntent(intent);
        IncomingFilePlugin.offer(this, intent);
    }
}
