package com.placementalarm

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat

object AlarmScheduler {

    const val CHANNEL_ID_ALARM = "placement_alarm_channel"
    const val CHANNEL_ID_INFO = "placement_info_channel"

    fun initNotificationChannels(context: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager =
                context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            // Channel for the loud ringing alarms
            val alarmChannel = NotificationChannel(
                CHANNEL_ID_ALARM,
                "Deadline Alarms",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Loud alarm notifications before deadlines"
                enableVibration(true)
                vibrationPattern = longArrayOf(0, 500, 200, 500, 200, 500)
                setBypassDnd(true)
            }

            // Channel for informational status notifications
            val infoChannel = NotificationChannel(
                CHANNEL_ID_INFO,
                "Deadline Updates",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Status updates when new deadlines are detected"
            }

            notificationManager.createNotificationChannel(alarmChannel)
            notificationManager.createNotificationChannel(infoChannel)
        }
    }

    fun formatStageTitle(deadlineMillis: Long, alarmMillis: Long, defaultFallback: String): String {
        if (deadlineMillis <= 0 || alarmMillis <= 0) return defaultFallback
        val diffMinutes = ((deadlineMillis - alarmMillis) / (60 * 1000L)).toInt()
        return when {
            diffMinutes <= 0 -> "DEADLINE EXPIRING"
            diffMinutes % 60 == 0 -> {
                val hours = diffMinutes / 60
                if (hours == 1) "1 HOUR BEFORE DEADLINE" else "$hours HOURS BEFORE DEADLINE"
            }
            diffMinutes > 60 -> {
                val hours = diffMinutes / 60
                val mins = diffMinutes % 60
                "$hours HRS $mins MINS BEFORE DEADLINE"
            }
            else -> "$diffMinutes MINS BEFORE DEADLINE"
        }
    }

    fun scheduleAlarm(context: Context, drive: DriveItem) {
        initNotificationChannels(context)

        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val now = System.currentTimeMillis()

        // Do not schedule if deadline has already completely expired
        if (drive.deadlineMillis <= now) return

        // 1. Schedule Alarm 1 (Stage 1: 2 hours before)
        if (!drive.alarm1Dismissed && drive.alarm1Millis > 0) {
            val targetTime1 = if (drive.alarm1Millis < now) {
                // If 2h mark is in the past, trigger shortly (10s) only if 1h alarm hasn't fired
                if (drive.alarm2Millis > now) now + 10_000L else null
            } else {
                drive.alarm1Millis
            }

            if (targetTime1 != null) {
                val stage1Title = formatStageTitle(drive.deadlineMillis, drive.alarm1Millis, "FIRST WARNING")
                val intent1 = Intent(context, AlarmReceiver::class.java).apply {
                    putExtra("DRIVE_ID", drive.id)
                    putExtra("COMPANY_NAME", drive.companyName)
                    putExtra("DEADLINE_FORMATTED", drive.deadlineFormatted)
                    putExtra("PACKAGE_INFO", drive.packageInfo)
                    putExtra("RAW_TEXT", drive.rawText)
                    putExtra("ALARM_STAGE", 1)
                    putExtra("STAGE_TITLE", stage1Title)
                }
                val pi1 = PendingIntent.getBroadcast(
                    context,
                    drive.id.hashCode() * 10 + 1,
                    intent1,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                trySchedule(alarmManager, targetTime1, pi1)
            }
        }

        // 2. Schedule Alarm 2 (Stage 2: Final Notice)
        if (!drive.alarm2Dismissed && drive.alarm2Millis > 0) {
            val targetTime2 = if (drive.alarm2Millis < now) {
                now + 10_000L // 10s from now if within last hour
            } else {
                drive.alarm2Millis
            }

            val stage2Title = formatStageTitle(drive.deadlineMillis, drive.alarm2Millis, "FINAL NOTICE")
            val intent2 = Intent(context, AlarmReceiver::class.java).apply {
                putExtra("DRIVE_ID", drive.id)
                putExtra("COMPANY_NAME", drive.companyName)
                putExtra("DEADLINE_FORMATTED", drive.deadlineFormatted)
                putExtra("PACKAGE_INFO", drive.packageInfo)
                putExtra("RAW_TEXT", drive.rawText)
                putExtra("ALARM_STAGE", 2)
                putExtra("STAGE_TITLE", stage2Title)
            }
            val pi2 = PendingIntent.getBroadcast(
                context,
                drive.id.hashCode() * 10 + 2,
                intent2,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            trySchedule(alarmManager, targetTime2, pi2)
        }

        // 3. Schedule any Custom Alarms added by the user
        for (custom in drive.customAlarms) {
            if (!custom.isDismissed && custom.timeMillis > now) {
                val customIntent = Intent(context, AlarmReceiver::class.java).apply {
                    putExtra("DRIVE_ID", drive.id)
                    putExtra("COMPANY_NAME", drive.companyName)
                    putExtra("DEADLINE_FORMATTED", drive.deadlineFormatted)
                    putExtra("PACKAGE_INFO", drive.packageInfo)
                    putExtra("RAW_TEXT", drive.rawText)
                    putExtra("ALARM_STAGE", 3)
                    putExtra("STAGE_TITLE", custom.label)
                    putExtra("CUSTOM_ALARM_ID", custom.id)
                }
                val piCustom = PendingIntent.getBroadcast(
                    context,
                    (drive.id + "_" + custom.id).hashCode(),
                    customIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                trySchedule(alarmManager, custom.timeMillis, piCustom)
            }
        }

        notifyDriveCaptured(context, drive)
    }

    fun scheduleSingleCustomAlarm(context: Context, drive: DriveItem, custom: CustomAlarm) {
        initNotificationChannels(context)
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val now = System.currentTimeMillis()
        if (custom.timeMillis <= now) return

        val customIntent = Intent(context, AlarmReceiver::class.java).apply {
            putExtra("DRIVE_ID", drive.id)
            putExtra("COMPANY_NAME", drive.companyName)
            putExtra("DEADLINE_FORMATTED", drive.deadlineFormatted)
            putExtra("PACKAGE_INFO", drive.packageInfo)
            putExtra("RAW_TEXT", drive.rawText)
            putExtra("ALARM_STAGE", 3)
            putExtra("STAGE_TITLE", custom.label)
            putExtra("CUSTOM_ALARM_ID", custom.id)
        }
        val piCustom = PendingIntent.getBroadcast(
            context,
            (drive.id + "_" + custom.id).hashCode(),
            customIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        trySchedule(alarmManager, custom.timeMillis, piCustom)
    }

    private fun trySchedule(alarmManager: AlarmManager, triggerAtMillis: Long, pendingIntent: PendingIntent) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(
                    AlarmManager.RTC_WAKEUP,
                    triggerAtMillis,
                    pendingIntent
                )
            } else {
                alarmManager.setExact(
                    AlarmManager.RTC_WAKEUP,
                    triggerAtMillis,
                    pendingIntent
                )
            }
        } catch (e: SecurityException) {
            e.printStackTrace()
        }
    }

    fun rescheduleAlarm(context: Context, driveId: String, newAlarmMillis: Long, newAlarmFormatted: String) {
        val drive = DriveStorage.getAllDrives(context).find { it.id == driveId } ?: return
        cancelAlarm(context, driveId)
        drive.alarmMillis = newAlarmMillis
        drive.alarmFormatted = newAlarmFormatted
        drive.alarm1Millis = newAlarmMillis
        drive.alarm1Formatted = newAlarmFormatted
        drive.alarm1Dismissed = false
        DriveStorage.updateDriveAlarmTime(context, driveId, newAlarmMillis, newAlarmFormatted)
        scheduleAlarm(context, drive)
    }

    fun cancelAlarm(context: Context, driveId: String) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager

        // Cancel legacy, stage 1, and stage 2 pending intents
        val requestCodes = mutableListOf(
            driveId.hashCode(),
            driveId.hashCode() * 10 + 1,
            driveId.hashCode() * 10 + 2
        )

        val drive = DriveStorage.getAllDrives(context).find { it.id == driveId }
        drive?.customAlarms?.forEach {
            requestCodes.add((driveId + "_" + it.id).hashCode())
        }

        for (rc in requestCodes) {
            val intent = Intent(context, AlarmReceiver::class.java)
            val pendingIntent = PendingIntent.getBroadcast(
                context,
                rc,
                intent,
                PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
            )
            if (pendingIntent != null) {
                alarmManager.cancel(pendingIntent)
                pendingIntent.cancel()
            }
        }
    }

    fun cancelSpecificAlarm(context: Context, driveId: String, stage: Int) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val rc = driveId.hashCode() * 10 + stage
        val intent = Intent(context, AlarmReceiver::class.java)
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            rc,
            intent,
            PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
        )
        if (pendingIntent != null) {
            alarmManager.cancel(pendingIntent)
            pendingIntent.cancel()
        }
    }

    fun cancelIndividualAlarm(context: Context, driveId: String, alarmKey: String) {
        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val rc = when (alarmKey) {
            "stage_1" -> driveId.hashCode() * 10 + 1
            "stage_2" -> driveId.hashCode() * 10 + 2
            else -> (driveId + "_" + alarmKey).hashCode()
        }
        val intent = Intent(context, AlarmReceiver::class.java)
        val pendingIntent = PendingIntent.getBroadcast(
            context,
            rc,
            intent,
            PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
        )
        if (pendingIntent != null) {
            alarmManager.cancel(pendingIntent)
            pendingIntent.cancel()
        }
        DriveStorage.cancelIndividualAlarm(context, driveId, alarmKey)
    }

    private fun notifyDriveCaptured(context: Context, drive: DriveItem) {
        val notificationManager =
            context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val notification = NotificationCompat.Builder(context, CHANNEL_ID_INFO)
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle("⏰ 2 Alarms Scheduled: ${drive.companyName}")
            .setContentText("2h & 1h warnings set for deadline (${drive.deadlineFormatted})")
            .setStyle(
                NotificationCompat.BigTextStyle()
                    .bigText("[${drive.category}] ${drive.companyName}\nDeadline: ${drive.deadlineFormatted}\n• 1st Alarm (2h before): ${drive.alarm1Formatted}\n• 2nd Alarm (1h before): ${drive.alarm2Formatted}")
            )
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .build()

        notificationManager.notify(drive.id.hashCode() + 1, notification)
    }
}
