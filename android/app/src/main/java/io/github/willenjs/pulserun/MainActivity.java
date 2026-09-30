package io.github.willenjs.pulserun;

import android.os.Bundle;
import android.os.SystemClock;
import android.webkit.WebView;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;
import io.github.willenjs.pulserun.coach.CoachPlugin;

public class MainActivity extends BridgeActivity {
    // Never hold the system splash longer than this, even if the page fails to load.
    private static final long SPLASH_MAX_MS = 3000;
    private static final long SPLASH_EXIT_HOLD_MS = 150;

    private volatile boolean pageLoaded = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // The system splash stays up until the page (and its inline web splash,
        // drawn at the same spot) has loaded, so the WebView never shows blank.
        SplashScreen splash = SplashScreen.installSplashScreen(this);
        long splashDeadline = SystemClock.uptimeMillis() + SPLASH_MAX_MS;
        splash.setKeepOnScreenCondition(() -> !pageLoaded && SystemClock.uptimeMillis() < splashDeadline);
        // No exit animation: the system splash stays on top a moment longer so the
        // WebView's first frame is on screen before it goes, then it is removed at once.
        splash.setOnExitAnimationListener(provider -> provider.getView().postDelayed(provider::remove, SPLASH_EXIT_HOLD_MS));

        // Local plugins must be registered before super.onCreate.
        registerPlugin(CoachPlugin.class);
        super.onCreate(savedInstanceState);

        if (bridge == null) {
            pageLoaded = true;
            return;
        }
        bridge.addWebViewListener(new WebViewListener() {
            @Override
            public void onPageLoaded(WebView webView) {
                // "Loaded" can come before the page is drawn: wait until it is, or
                // the plain background shows for a few frames between the splashes.
                webView.postVisualStateCallback(0, new WebView.VisualStateCallback() {
                    @Override
                    public void onComplete(long requestId) {
                        pageLoaded = true;
                    }
                });
            }
        });
    }
}
