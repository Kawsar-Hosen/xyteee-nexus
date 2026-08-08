package com.xyteee.nexus

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * JS bridge to [ForegroundCallService]. Accessible from JS as
 * `NativeModules.CallForegroundService`. Works on the New Architecture
 * through the legacy-module interop layer.
 */
class CallForegroundModule(
    reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "CallForegroundService"

    @ReactMethod
    fun start(media: String, title: String, subtitle: String) {
        ForegroundCallService.start(reactApplicationContext, media, title, subtitle)
    }

    @ReactMethod
    fun stop() {
        ForegroundCallService.stop(reactApplicationContext)
    }
}
