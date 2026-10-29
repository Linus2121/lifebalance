package com.lambtechnologies.lifebalance;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AlertTonePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
