package com.placementalarm

import android.app.AlarmManager
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import com.facebook.react.bridge.*
import org.json.JSONArray

class PlacementAlarmModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        var sharedReactContext: ReactApplicationContext? = null

        fun notifyDrivesUpdated() {
            try {
                sharedReactContext?.let { ctx ->
                    if (ctx.hasActiveReactInstance()) {
                        ctx.getJSModule(com.facebook.react.modules.core.DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                            ?.emit("onDrivesUpdated", null)
                    }
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    init {
        sharedReactContext = reactContext
    }

    override fun getName(): String {
        return "PlacementAlarmModule"
    }

    override fun getConstants(): MutableMap<String, Any> {
        val constants = mutableMapOf<String, Any>()
        try {
            val enabledListeners = NotificationManagerCompat.getEnabledListenerPackages(reactContext)
            val hasNotificationListener = enabledListeners.contains(reactContext.packageName)

            var canScheduleExactAlarm = true
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val alarmManager = reactContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
                canScheduleExactAlarm = alarmManager.canScheduleExactAlarms()
            }

            val notificationManager = NotificationManagerCompat.from(reactContext)
            constants["initialHasNotificationListener"] = hasNotificationListener
            constants["initialCanScheduleExactAlarm"] = canScheduleExactAlarm
            constants["initialHasPostNotification"] = notificationManager.areNotificationsEnabled()

            val drives = DriveStorage.getAllDrives(reactContext)
            val arr = JSONArray()
            drives.forEach { arr.put(it.toJsonObject()) }
            constants["initialDrivesJson"] = arr.toString()
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return constants
    }

    @ReactMethod
    fun addListener(eventName: String) {}

    @ReactMethod
    fun removeListeners(count: Int) {}

    @ReactMethod
    fun checkPermissions(promise: Promise) {
        val map = Arguments.createMap()

        // 1. Notification Listener Permission
        val enabledListeners = NotificationManagerCompat.getEnabledListenerPackages(reactContext)
        val hasNotificationListener = enabledListeners.contains(reactContext.packageName)
        map.putBoolean("hasNotificationListener", hasNotificationListener)

        // 2. Exact Alarm Permission (Android 12+)
        var canScheduleExactAlarm = true
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val alarmManager = reactContext.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            canScheduleExactAlarm = alarmManager.canScheduleExactAlarms()
        }
        map.putBoolean("canScheduleExactAlarm", canScheduleExactAlarm)

        // 3. Post Notifications (Android 13+)
        val notificationManager = NotificationManagerCompat.from(reactContext)
        map.putBoolean("hasPostNotification", notificationManager.areNotificationsEnabled())

        promise.resolve(map)
    }

    @ReactMethod
    fun openNotificationListenerSettings() {
        try {
            val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactContext.startActivity(intent)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    @ReactMethod
    fun openExactAlarmSettings() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val intent = Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
                    data = Uri.parse("package:${reactContext.packageName}")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                reactContext.startActivity(intent)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    @ReactMethod
    fun getSavedDrives(promise: Promise) {
        try {
            val drives = DriveStorage.getAllDrives(reactContext)
            val arr = JSONArray()
            drives.forEach { arr.put(it.toJsonObject()) }
            promise.resolve(arr.toString())
        } catch (e: Exception) {
            promise.reject("STORAGE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun cancelDriveAlarm(driveId: String, promise: Promise) {
        try {
            AlarmScheduler.cancelAlarm(reactContext, driveId)
            DriveStorage.removeDrive(reactContext, driveId)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CANCEL_ERROR", e.message)
        }
    }

    @ReactMethod
    fun dismissDriveStage(driveId: String, stage: Int, promise: Promise) {
        try {
            AlarmScheduler.cancelSpecificAlarm(reactContext, driveId, stage)
            DriveStorage.dismissStageAlarm(reactContext, driveId, stage)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("DISMISS_STAGE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun dismissAllDriveAlarms(driveId: String, promise: Promise) {
        try {
            AlarmScheduler.cancelAlarm(reactContext, driveId)
            DriveStorage.dismissAllAlarms(reactContext, driveId)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("DISMISS_ALL_ERROR", e.message)
        }
    }

    @ReactMethod
    fun getDefaultAlarmSettings(promise: Promise) {
        try {
            val (s1, s2) = DriveStorage.getDefaultAlarmOffsets(reactContext)
            val map = Arguments.createMap().apply {
                putInt("stage1Minutes", s1)
                putInt("stage2Minutes", s2)
            }
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("SETTINGS_ERROR", e.message)
        }
    }

    @ReactMethod
    fun saveDefaultAlarmSettings(stage1Minutes: Int, stage2Minutes: Int, applyToUpcoming: Boolean, promise: Promise) {
        try {
            DriveStorage.saveDefaultAlarmOffsets(reactContext, stage1Minutes, stage2Minutes)
            var updatedCount = 0
            if (applyToUpcoming) {
                updatedCount = DriveStorage.rescheduleUpcomingDrivesWithNewDefaults(reactContext, stage1Minutes, stage2Minutes)
            }
            notifyDrivesUpdated()
            promise.resolve(updatedCount)
        } catch (e: Exception) {
            promise.reject("SETTINGS_SAVE_ERROR", e.message)
        }
    }

    @ReactMethod
    fun simulateNotification(title: String, text: String, promise: Promise) {
        try {
            val (s1, s2) = DriveStorage.getDefaultAlarmOffsets(reactContext)
            val parsed = DeadlineParser.parse(title, text, s1, s2)
            if (parsed == null) {
                promise.resolve(null)
                return
            }

            val now = System.currentTimeMillis()
            val drive = DriveItem(
                id = now.toString(),
                companyName = parsed.companyName,
                title = parsed.title,
                rawText = parsed.rawText,
                deadlineMillis = parsed.deadlineMillis,
                deadlineFormatted = parsed.deadlineFormatted,
                alarmMillis = parsed.alarmMillis,
                alarmFormatted = parsed.alarmFormatted,
                status = if (parsed.deadlineMillis > now) "scheduled" else "active",
                offsetHours = parsed.offsetHours,
                category = parsed.category,
                alarm1Millis = parsed.alarm1Millis,
                alarm1Formatted = parsed.alarm1Formatted,
                alarm1Dismissed = false,
                alarm2Millis = parsed.alarm2Millis,
                alarm2Formatted = parsed.alarm2Formatted,
                alarm2Dismissed = false,
                packageInfo = parsed.packageInfo
            )

            val saved = DriveStorage.mergeOrSaveDrive(reactContext, drive)
            if (saved.deadlineMillis > now) {
                AlarmScheduler.scheduleAlarm(reactContext, saved)
            }

            promise.resolve(saved.toJsonObject().toString())
        } catch (e: Exception) {
            promise.reject("SIMULATION_ERROR", e.message)
        }
    }

    @ReactMethod
    fun testRingAlarmNow(companyName: String) {
        testRingAlarmStage(companyName, 1)
    }

    @ReactMethod
    fun testRingAlarmStage(companyName: String, stage: Int) {
        try {
            val drives = DriveStorage.getAllDrives(reactContext)
            val match = if (companyName.isNotBlank()) {
                drives.find { it.id == companyName || DriveStorage.isCompanyMatch(it.companyName, companyName) }
            } else {
                drives.firstOrNull()
            }

            val driveId = match?.id ?: ("test_" + System.currentTimeMillis())
            val finalName = match?.companyName ?: (if (companyName.isNotBlank()) companyName else "TEST COMPANY")
            val deadlineFormatted = match?.deadlineFormatted ?: "Today at 05:00 PM (Sample Test)"
            val packageInfo = match?.packageInfo ?: "24 LPA"
            val rawText = match?.rawText ?: "This is a live test of the placement alarm ringtone and alert screen."

            val stageTitle = if (match != null && match.deadlineMillis > 0) {
                if (stage == 2) {
                    AlarmScheduler.formatStageTitle(match.deadlineMillis, match.alarm2Millis, "FINAL NOTICE")
                } else {
                    AlarmScheduler.formatStageTitle(match.deadlineMillis, match.alarm1Millis, "FIRST WARNING")
                }
            } else {
                val (s1, s2) = DriveStorage.getDefaultAlarmOffsets(reactContext)
                val mins = if (stage == 2) s2 else s1
                val h = mins / 60
                val m = mins % 60
                if (m == 0) "$h HOURS BEFORE DEADLINE" else "$h HRS $m MINS BEFORE DEADLINE"
            }

            val intent = Intent(reactContext, AlarmActivity::class.java).apply {
                putExtra("DRIVE_ID", driveId)
                putExtra("COMPANY_NAME", finalName)
                putExtra("DEADLINE_FORMATTED", deadlineFormatted)
                putExtra("PACKAGE_INFO", packageInfo)
                putExtra("RAW_TEXT", rawText)
                putExtra("ALARM_STAGE", if (stage == 2) 2 else 1)
                putExtra("STAGE_TITLE", stageTitle)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }
            reactContext.startActivity(intent)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    @ReactMethod
    fun addCustomAlarm(driveId: String, alarmMillis: Double, alarmFormatted: String, label: String, promise: Promise) {
        try {
            val drive = DriveStorage.getAllDrives(reactContext).find { it.id == driveId }
            if (drive == null) {
                promise.reject("NOT_FOUND", "Drive not found")
                return
            }

            val customAlarm = CustomAlarm(
                id = "custom_" + System.currentTimeMillis(),
                label = if (label.isNotBlank()) label else "Custom Alarm",
                timeMillis = alarmMillis.toLong(),
                formattedTime = alarmFormatted,
                isDismissed = false
            )

            DriveStorage.addCustomAlarm(reactContext, driveId, customAlarm)
            AlarmScheduler.scheduleSingleCustomAlarm(reactContext, drive, customAlarm)

            promise.resolve(customAlarm.toJsonObject().toString())
        } catch (e: Exception) {
            promise.reject("ADD_CUSTOM_ALARM_ERROR", e.message)
        }
    }

    @ReactMethod
    fun cancelIndividualAlarm(driveId: String, alarmKey: String, promise: Promise) {
        try {
            AlarmScheduler.cancelIndividualAlarm(reactContext, driveId, alarmKey)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CANCEL_INDIVIDUAL_ALARM_ERROR", e.message)
        }
    }

    @ReactMethod
    fun updateAlarmTime(driveId: String, newAlarmMillis: Double, newAlarmFormatted: String, promise: Promise) {
        addCustomAlarm(driveId, newAlarmMillis, newAlarmFormatted, "Custom Alarm", promise)
    }

    @ReactMethod
    fun copyToClipboard(text: String, promise: Promise) {
        try {
            val clipboard = reactContext.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            val clip = ClipData.newPlainText("PlacementDetails", text)
            clipboard.setPrimaryClip(clip)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("CLIPBOARD_ERROR", e.message)
        }
    }
}
