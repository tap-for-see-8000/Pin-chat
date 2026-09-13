package com.aistudio.pinchat.kpmd

import android.app.AppOpsManager
import android.content.Context
import android.content.Intent
import android.provider.Settings
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "FocusTracker")
class FocusTrackingPlugin : Plugin() {

    @PluginMethod
    fun getStats(call: PluginCall) {
        val ret = JSObject().apply {
            put("instagramCount", FocusAccessibilityService.instagramCount)
            put("instagramTimeMs", FocusAccessibilityService.instagramTimeMs)
            put("youtubeCount", FocusAccessibilityService.youtubeCount)
            put("youtubeTimeMs", FocusAccessibilityService.youtubeTimeMs)
            put("totalTimeMs", FocusAccessibilityService.instagramTimeMs + FocusAccessibilityService.youtubeTimeMs)
            put("isServiceRunning", FocusAccessibilityService.isServiceRunning)
            put("hasUsagePermission", hasUsageStatsPermission())
            put("hasAccessibilityPermission", hasAccessibilityPermission())
            put("hasOverlayPermission", Settings.canDrawOverlays(context))
        }
        call.resolve(ret)
    }

    @PluginMethod
    fun setLimits(call: PluginCall) {
        val limits = call.getObject("limits")
        if (limits != null) {
            FocusAccessibilityService.instagramCountLimit = limits.getInteger("instagramCountLimit", 20) ?: 20
            FocusAccessibilityService.instagramTimeLimitMs = limits.getInteger("instagramTimeLimitMs", 20 * 60 * 1000)?.toLong() ?: (20L * 60 * 1000)
            FocusAccessibilityService.youtubeCountLimit = limits.getInteger("youtubeCountLimit", 20) ?: 20
            FocusAccessibilityService.youtubeTimeLimitMs = limits.getInteger("youtubeTimeLimitMs", 20 * 60 * 1000)?.toLong() ?: (20L * 60 * 1000)
            FocusAccessibilityService.combinedCountLimit = limits.getInteger("combinedCountLimit", 30) ?: 30
            FocusAccessibilityService.combinedTimeLimitMs = limits.getInteger("combinedTimeLimitMs", 30 * 60 * 1000)?.toLong() ?: (30L * 60 * 1000)
            
            val isTrackingEnabled = limits.getBoolean("trackingEnabled", true) ?: true
            FocusAccessibilityService.trackingEnabled = isTrackingEnabled
        }
        call.resolve()
    }

    @PluginMethod
    fun checkPermissions(call: PluginCall) {
        val ret = JSObject().apply {
            put("usage", hasUsageStatsPermission())
            put("accessibility", hasAccessibilityPermission())
            put("overlay", Settings.canDrawOverlays(context))
        }
        call.resolve(ret)
    }

    @PluginMethod
    fun requestUsagePermission(call: PluginCall) {
        val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
        call.resolve()
    }

    @PluginMethod
    fun requestAccessibilityPermission(call: PluginCall) {
        val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
        call.resolve()
    }

    @PluginMethod
    fun requestOverlayPermission(call: PluginCall) {
        val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(intent)
        call.resolve()
    }

    
    @PluginMethod
    fun getSafetyStatus(call: PluginCall) {
        val ret = JSObject().apply {
            put("status", FocusAccessibilityService.safetyStatus)
            put("errorDetail", FocusAccessibilityService.safetyErrorDetail)
        }
        call.resolve(ret)
    }

    @PluginMethod
    fun setSafetyFilterEnabled(call: PluginCall) {
        val enabled = call.getBoolean("enabled", false) ?: false
        if (enabled) {
            if (!hasAccessibilityPermission()) {
                FocusAccessibilityService.safetyStatus = "permission_required"
                FocusAccessibilityService.safetyErrorDetail = "Accessibility Service is required for screen capture analysis."
            } else {
                // Initialize the real detection pipeline which will gracefully fail 
                // due to missing model as instructed.
                FocusAccessibilityService.enableSafetyFilter()
            }
        } else {
            FocusAccessibilityService.disableSafetyFilter()
        }
        
        val ret = JSObject().apply {
            put("status", FocusAccessibilityService.safetyStatus)
            put("errorDetail", FocusAccessibilityService.safetyErrorDetail)
        }
        call.resolve(ret)
    }

    @PluginMethod
    fun requestSafetyPermission(call: PluginCall) {
        // We use accessibility for screenshotting to avoid MediaProjection consent loops
        if (!hasAccessibilityPermission()) {
            val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
        }
        call.resolve()
    }

    private fun hasUsageStatsPermission(): Boolean {
        val appOps = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = appOps.checkOpNoThrow(
            AppOpsManager.OPSTR_GET_USAGE_STATS,
            android.os.Process.myUid(),
            context.packageName
        )
        return mode == AppOpsManager.MODE_ALLOWED
    }

    private fun hasAccessibilityPermission(): Boolean {
        var accessibilityEnabled = 0
        try {
            accessibilityEnabled = Settings.Secure.getInt(
                context.contentResolver,
                Settings.Secure.ACCESSIBILITY_ENABLED
            )
        } catch (e: Settings.SettingNotFoundException) {
            // ignore
        }
        
        if (accessibilityEnabled == 1) {
            val settingValue = Settings.Secure.getString(
                context.contentResolver,
                Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
            )
            if (settingValue != null) {
                return settingValue.contains(context.packageName)
            }
        }
        return false
    }
}
