package io.github.willenjs.pulserun;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import io.github.willenjs.pulserun.coach.CoachPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Local plugins must be registered before super.onCreate.
        registerPlugin(CoachPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
