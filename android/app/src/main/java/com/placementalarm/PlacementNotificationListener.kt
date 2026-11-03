package com.placementalarm

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import java.util.Locale
import java.util.concurrent.ConcurrentHashMap

class PlacementNotificationListener : NotificationListenerService() {

    companion object {
        private const val TAG = "PlacementListener"
        private val DEADLINE_TRIGGERS = listOf(
            "register by", "registration by", "deadline", "last date",
            "submit by", "submission", "due date", "due by", "due on",
            "apply by", "apply before", "valid till", "valid until", "closes on"
        )
        private val PLACEMENT_TRIGGERS = listOf(
            "ctc", "package", "lpa", "stipend", "salary", "recruitment", "hiring",
            "placement", "campus drive", "job profile", "eligibility", "role"
        )
        // In-memory cache to debounce duplicate notifications within 30 seconds
        private val processedHashes = ConcurrentHashMap<String, Long>()
    }

    private fun isLpuTouchApp(pkg: String): Boolean {
        if (pkg.isBlank()) return false
        val lowerPkg = pkg.lowercase(Locale.ENGLISH)

        // 1. Direct package match for LPUTouch (Lovely Professional University)
        if (lowerPkg == "ums.lovely.university" ||
            lowerPkg.contains("lputouch") ||
            lowerPkg.contains("lpu.touch")
        ) {
            return true
        }

        // 2. Application label check via PackageManager
        try {
            val pm = applicationContext.packageManager
            val appInfo = pm.getApplicationInfo(pkg, 0)
            val label = pm.getApplicationLabel(appInfo).toString()
                .lowercase(Locale.ENGLISH)
                .replace(" ", "")
                .replace("-", "")
            if (label.contains("lputouch")) {
                return true
            }
        } catch (e: Exception) {
            // Package info unavailable
        }

        return false
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        if (sbn == null) return

        val pkg = sbn.packageName ?: ""

        // 1. CRITICAL: Never process notifications posted by our own app!
        if (pkg.isEmpty() ||
            pkg.equals(packageName, ignoreCase = true) ||
            pkg.equals(applicationContext.packageName, ignoreCase = true) ||
            pkg.equals("com.placementalarm", ignoreCase = true)
        ) {
            return
        }

        // 2. Only take notifications from LPU Touch app, ignore all other apps
        if (!isLpuTouchApp(pkg)) {
            Log.d(TAG, "Ignoring notification from non-LPU Touch app: $pkg")
            return
        }

        // 3. Ignore ongoing / non-clearable notifications (media controls, system downloads, calls, etc.)
        if (sbn.isOngoing) {
            return
        }

        val extras = sbn.notification.extras ?: return
        val title = extras.getCharSequence("android.title")?.toString() ?: ""
        val text = extras.getCharSequence("android.text")?.toString() ?: ""
        val bigText = extras.getCharSequence("android.bigText")?.toString() ?: ""

        val fullText = if (bigText.isNotEmpty()) bigText else text

        if (title.isBlank() && fullText.isBlank()) return

        // 3. Debounce identical notifications within 30 seconds
        val contentHash = "$pkg|$title|$fullText".hashCode().toString()
        val now = System.currentTimeMillis()
        val lastSeen = processedHashes[contentHash]
        if (lastSeen != null && (now - lastSeen) < 30_000L) {
            Log.d(TAG, "Dropping duplicate notification from $pkg within debounce window.")
            return
        }
        processedHashes[contentHash] = now

        // Evict entries older than 2 minutes to keep memory small
        if (processedHashes.size > 50) {
            val cutoff = now - 120_000L
            processedHashes.entries.removeIf { it.value < cutoff }
        }

        Log.d(TAG, "Notification received: pkg=$pkg, title=$title, text=$fullText")

        val matchesTrigger = DEADLINE_TRIGGERS.any { trigger ->
            fullText.contains(trigger, ignoreCase = true) || title.contains(trigger, ignoreCase = true)
        } || PLACEMENT_TRIGGERS.any { trigger ->
            fullText.contains(trigger, ignoreCase = true) || title.contains(trigger, ignoreCase = true)
        }

        if (matchesTrigger) {
            val (s1, s2) = DriveStorage.getDefaultAlarmOffsets(applicationContext)
            val parsed = DeadlineParser.parse(title, fullText, s1, s2)
            if (parsed != null) {
                // Do not schedule if deadline is in the past, unless there is package info to attach
                if (parsed.deadlineMillis in 1..now && parsed.packageInfo.isBlank()) {
                    Log.d(TAG, "Deadline is in the past for ${parsed.companyName}. Skipping.")
                    return
                }

                val driveItem = DriveItem(
                    id = System.currentTimeMillis().toString(),
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

                // Save or merge into SharedPreferences storage
                val saved = DriveStorage.mergeOrSaveDrive(applicationContext, driveItem)
                PlacementAlarmModule.notifyDrivesUpdated()

                // Schedule the exact alarms if a future deadline exists
                if (saved.deadlineMillis > now) {
                    AlarmScheduler.scheduleAlarm(applicationContext, saved)
                    Log.i(TAG, "Successfully scheduled alarm for [${saved.category}] ${saved.companyName} at ${saved.alarmFormatted}")
                } else {
                    Log.i(TAG, "Saved drive details for [${saved.category}] ${saved.companyName} (Package: ${saved.packageInfo})")
                }
            }
        }
    }
}
