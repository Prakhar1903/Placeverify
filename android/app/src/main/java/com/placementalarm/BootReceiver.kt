package com.placementalarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED || intent.action == "android.intent.action.QUICKBOOT_POWERON") {
            // Reschedule all active future alarms
            val drives = DriveStorage.getAllDrives(context)
            val now = System.currentTimeMillis()
            for (drive in drives) {
                if (drive.status == "scheduled" && drive.deadlineMillis > now) {
                    AlarmScheduler.scheduleAlarm(context, drive)
                }
            }
        }
    }
}
