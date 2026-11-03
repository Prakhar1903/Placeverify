package com.placementalarm

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.PowerManager
import androidx.core.app.NotificationCompat

class AlarmReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        val driveId = intent.getStringExtra("DRIVE_ID") ?: ""
        val companyName = intent.getStringExtra("COMPANY_NAME") ?: "Company Drive"
        val deadlineFormatted = intent.getStringExtra("DEADLINE_FORMATTED") ?: ""
        val packageInfo = intent.getStringExtra("PACKAGE_INFO") ?: ""
        val rawText = intent.getStringExtra("RAW_TEXT") ?: ""

        val stage = intent.getIntExtra("ALARM_STAGE", 1)
        val stageTitle = intent.getStringExtra("STAGE_TITLE") ?: if (stage == 1) "2 HOURS REMAINING" else "FINAL 1 HOUR WARNING"
        val customAlarmId = intent.getStringExtra("CUSTOM_ALARM_ID") ?: ""

        // Wake screen
        val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        val wakeLock = powerManager.newWakeLock(
            PowerManager.FULL_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP or PowerManager.ON_AFTER_RELEASE,
            "PlacementAlarm:WakeLock"
        )
        wakeLock.acquire(30000L) // 30 seconds

        // Intent to launch full-screen AlarmActivity
        val alarmIntent = Intent(context, AlarmActivity::class.java).apply {
            putExtra("DRIVE_ID", driveId)
            putExtra("COMPANY_NAME", companyName)
            putExtra("DEADLINE_FORMATTED", deadlineFormatted)
            putExtra("PACKAGE_INFO", packageInfo)
            putExtra("RAW_TEXT", rawText)
            putExtra("ALARM_STAGE", stage)
            putExtra("STAGE_TITLE", stageTitle)
            putExtra("CUSTOM_ALARM_ID", customAlarmId)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        }

        val fullScreenPendingIntent = PendingIntent.getActivity(
            context,
            driveId.hashCode() + stage * 10,
            alarmIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Show Heads-Up Notification that triggers full screen
        AlarmScheduler.initNotificationChannels(context)
        val notificationManager =
            context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val notificationTitle = if (stage == 1) "⚠️ 2 HOURS LEFT: $companyName" else "🚨 FINAL 1 HOUR WARNING: $companyName"

        val notification = NotificationCompat.Builder(context, AlarmScheduler.CHANNEL_ID_ALARM)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle(notificationTitle)
            .setContentText("Deadline is $deadlineFormatted")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .setAutoCancel(false)
            .setOngoing(true)
            .build()

        notificationManager.notify(driveId.hashCode() + 100, notification)

        // Directly launch AlarmActivity
        try {
            context.startActivity(alarmIntent)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}
