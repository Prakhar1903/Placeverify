package com.placementalarm

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

data class CustomAlarm(
    val id: String,
    val label: String,
    val timeMillis: Long,
    val formattedTime: String,
    var isDismissed: Boolean = false
) {
    fun toJsonObject(): JSONObject {
        val json = JSONObject()
        json.put("id", id)
        json.put("label", label)
        json.put("timeMillis", timeMillis)
        json.put("formattedTime", formattedTime)
        json.put("isDismissed", isDismissed)
        return json
    }

    companion object {
        fun fromJsonObject(json: JSONObject): CustomAlarm {
            return CustomAlarm(
                id = json.optString("id", System.currentTimeMillis().toString()),
                label = json.optString("label", "Custom Alarm"),
                timeMillis = json.optLong("timeMillis", 0),
                formattedTime = json.optString("formattedTime", ""),
                isDismissed = json.optBoolean("isDismissed", false)
            )
        }
    }
}

data class DriveMessage(
    val id: String = System.currentTimeMillis().toString(),
    val text: String,
    val timestamp: Long = System.currentTimeMillis()
) {
    fun toJsonObject(): JSONObject {
        val json = JSONObject()
        json.put("id", id)
        json.put("text", text)
        json.put("timestamp", timestamp)
        return json
    }

    companion object {
        fun fromJsonObject(json: JSONObject): DriveMessage {
            return DriveMessage(
                id = json.optString("id", System.currentTimeMillis().toString()),
                text = json.optString("text", ""),
                timestamp = json.optLong("timestamp", System.currentTimeMillis())
            )
        }
    }
}

data class DriveItem(
    val id: String,
    var companyName: String,
    val title: String,
    var rawText: String,
    var deadlineMillis: Long,
    var deadlineFormatted: String,
    var alarmMillis: Long,
    var alarmFormatted: String,
    var status: String, // "scheduled", "alarmed", "dismissed"
    var offsetHours: Int,
    var category: String = "General", // "Placement", "Assignment", "Exam", "Fee / Payment", "General"
    var alarm1Millis: Long = 0,
    var alarm1Formatted: String = "",
    var alarm1Dismissed: Boolean = false,
    var alarm2Millis: Long = 0,
    var alarm2Formatted: String = "",
    var alarm2Dismissed: Boolean = false,
    var customAlarms: MutableList<CustomAlarm> = mutableListOf(),
    var packageInfo: String = "",
    var messages: MutableList<DriveMessage> = mutableListOf(),
    val createdAt: Long = System.currentTimeMillis(),
    var updatedAt: Long = System.currentTimeMillis()
) {
    fun toJsonObject(): JSONObject {
        val json = JSONObject()
        json.put("id", id)
        json.put("companyName", companyName)
        json.put("title", title)
        json.put("rawText", rawText)
        json.put("deadlineMillis", deadlineMillis)
        json.put("deadlineFormatted", deadlineFormatted)
        json.put("alarmMillis", alarmMillis)
        json.put("alarmFormatted", alarmFormatted)
        json.put("status", status)
        json.put("offsetHours", offsetHours)
        json.put("category", category)
        json.put("alarm1Millis", alarm1Millis)
        json.put("alarm1Formatted", alarm1Formatted)
        json.put("alarm1Dismissed", alarm1Dismissed)
        json.put("alarm2Millis", alarm2Millis)
        json.put("alarm2Formatted", alarm2Formatted)
        json.put("alarm2Dismissed", alarm2Dismissed)
        json.put("packageInfo", packageInfo)
        json.put("createdAt", createdAt)
        json.put("updatedAt", updatedAt)

        val customArr = JSONArray()
        customAlarms.forEach { customArr.put(it.toJsonObject()) }
        json.put("customAlarms", customArr)

        val msgArr = JSONArray()
        messages.forEach { msgArr.put(it.toJsonObject()) }
        json.put("messages", msgArr)

        return json
    }

    companion object {
        fun fromJsonObject(json: JSONObject): DriveItem {
            val deadline = json.optLong("deadlineMillis", 0)
            val a1Millis = json.optLong("alarm1Millis", if (deadline > 0) deadline - 2 * 3600 * 1000L else json.optLong("alarmMillis", 0))
            val a2Millis = json.optLong("alarm2Millis", if (deadline > 0) deadline - 1 * 3600 * 1000L else 0)

            val customList = mutableListOf<CustomAlarm>()
            val customArr = json.optJSONArray("customAlarms")
            if (customArr != null) {
                for (i in 0 until customArr.length()) {
                    val cObj = customArr.optJSONObject(i)
                    if (cObj != null) {
                        customList.add(CustomAlarm.fromJsonObject(cObj))
                    }
                }
            }

            val msgList = mutableListOf<DriveMessage>()
            val msgArr = json.optJSONArray("messages")
            if (msgArr != null) {
                for (i in 0 until msgArr.length()) {
                    val mObj = msgArr.optJSONObject(i)
                    if (mObj != null) {
                        msgList.add(DriveMessage.fromJsonObject(mObj))
                    }
                }
            }
            val raw = json.optString("rawText", "")
            if (msgList.isEmpty() && raw.isNotBlank()) {
                msgList.add(DriveMessage(id = "init", text = raw, timestamp = json.optLong("createdAt", System.currentTimeMillis())))
            }

            return DriveItem(
                id = json.optString("id", System.currentTimeMillis().toString()),
                companyName = json.optString("companyName", "Item"),
                title = json.optString("title", ""),
                rawText = raw,
                deadlineMillis = deadline,
                deadlineFormatted = json.optString("deadlineFormatted", ""),
                alarmMillis = json.optLong("alarmMillis", a1Millis),
                alarmFormatted = json.optString("alarmFormatted", ""),
                status = json.optString("status", "scheduled"),
                offsetHours = json.optInt("offsetHours", 2),
                category = json.optString("category", "General"),
                alarm1Millis = a1Millis,
                alarm1Formatted = json.optString("alarm1Formatted", json.optString("alarmFormatted", "")),
                alarm1Dismissed = json.optBoolean("alarm1Dismissed", false),
                alarm2Millis = a2Millis,
                alarm2Formatted = json.optString("alarm2Formatted", ""),
                alarm2Dismissed = json.optBoolean("alarm2Dismissed", false),
                customAlarms = customList,
                packageInfo = json.optString("packageInfo", ""),
                messages = msgList,
                createdAt = json.optLong("createdAt", System.currentTimeMillis()),
                updatedAt = json.optLong("updatedAt", System.currentTimeMillis())
            )
        }
    }
}

object DriveStorage {
    private const val PREFS_NAME = "placement_alarm_drives_prefs"
    private const val KEY_DRIVES = "drives_list"
    private const val KEY_DEFAULT_STAGE1_MINUTES = "default_stage1_minutes"
    private const val KEY_DEFAULT_STAGE2_MINUTES = "default_stage2_minutes"

    fun getDefaultAlarmOffsets(context: Context): Pair<Int, Int> {
        val prefs = getPrefs(context)
        val s1 = prefs.getInt(KEY_DEFAULT_STAGE1_MINUTES, 120) // default 2 hours = 120 mins
        val s2 = prefs.getInt(KEY_DEFAULT_STAGE2_MINUTES, 60)  // default 1 hour = 60 mins
        return Pair(s1, s2)
    }

    fun saveDefaultAlarmOffsets(context: Context, stage1Minutes: Int, stage2Minutes: Int) {
        getPrefs(context).edit()
            .putInt(KEY_DEFAULT_STAGE1_MINUTES, stage1Minutes)
            .putInt(KEY_DEFAULT_STAGE2_MINUTES, stage2Minutes)
            .apply()
    }

    private fun getPrefs(context: Context): SharedPreferences {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    fun normalizeCompanyName(name: String): String {
        return name.lowercase(Locale.ENGLISH)
            .replace(Regex("""\b(pvt|ltd|limited|inc|corp|technologies|solutions|services|drive|recruitment|hiring|update|internship|placement|cell|dept|department)\b"""), "")
            .replace(Regex("""[^a-z0-9]"""), "")
            .trim()
    }

    fun isCompanyMatch(c1: String, c2: String): Boolean {
        val n1 = normalizeCompanyName(c1)
        val n2 = normalizeCompanyName(c2)
        if (n1.isEmpty() || n2.isEmpty()) return false
        if (n1 == n2) return true
        if ((n1.length >= 4 && n2.length >= 4) && (n1.contains(n2) || n2.contains(n1))) return true
        return false
    }

    @Synchronized
    fun getAllDrives(context: Context): List<DriveItem> {
        val prefs = getPrefs(context)
        val jsonStr = prefs.getString(KEY_DRIVES, "[]") ?: "[]"
        val list = mutableListOf<DriveItem>()
        try {
            val arr = JSONArray(jsonStr)
            for (i in 0 until arr.length()) {
                val obj = arr.getJSONObject(i)
                list.add(DriveItem.fromJsonObject(obj))
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return list.sortedByDescending {
            val latestMsgTime = it.messages.maxOfOrNull { m -> m.timestamp } ?: 0L
            maxOf(it.updatedAt, it.createdAt, latestMsgTime)
        }
    }

    @Synchronized
    fun mergeOrSaveDrive(context: Context, drive: DriveItem): DriveItem {
        val existingList = getAllDrives(context).toMutableList()

        // 1. Try to find match by id OR by company name
        val match = existingList.find {
            it.id == drive.id || isCompanyMatch(it.companyName, drive.companyName)
        }

        if (match != null) {
            // Update package info if incoming has one
            if (drive.packageInfo.isNotBlank()) {
                match.packageInfo = drive.packageInfo
            }

            // Update deadline info if incoming has a valid deadline
            if (drive.deadlineMillis > 0) {
                match.deadlineMillis = drive.deadlineMillis
                match.deadlineFormatted = drive.deadlineFormatted
                match.alarmMillis = drive.alarmMillis
                match.alarmFormatted = drive.alarmFormatted
                match.alarm1Millis = drive.alarm1Millis
                match.alarm1Formatted = drive.alarm1Formatted
                match.alarm1Dismissed = false
                match.alarm2Millis = drive.alarm2Millis
                match.alarm2Formatted = drive.alarm2Formatted
                match.alarm2Dismissed = false
                match.status = "scheduled"
            }

            // If company name was generic in existing (e.g. Placement Deadline), update with better name
            if (match.companyName.contains("Deadline", ignoreCase = true) && !drive.companyName.contains("Deadline", ignoreCase = true)) {
                match.companyName = drive.companyName
            }

            // Append message if not duplicate
            if (drive.rawText.isNotBlank()) {
                val alreadyHas = match.messages.any { it.text.trim().equals(drive.rawText.trim(), ignoreCase = true) }
                if (!alreadyHas) {
                    match.messages.add(
                        DriveMessage(
                            id = System.currentTimeMillis().toString(),
                            text = drive.rawText,
                            timestamp = System.currentTimeMillis()
                        )
                    )
                }
                match.rawText = drive.rawText
            }

            match.updatedAt = System.currentTimeMillis()
            saveList(context, existingList)
            return match
        } else {
            // New drive
            if (drive.messages.isEmpty() && drive.rawText.isNotBlank()) {
                drive.messages.add(
                    DriveMessage(
                        id = System.currentTimeMillis().toString(),
                        text = drive.rawText,
                        timestamp = drive.createdAt
                    )
                )
            }
            existingList.add(0, drive)
            saveList(context, existingList)
            return drive
        }
    }

    @Synchronized
    fun saveDrive(context: Context, drive: DriveItem) {
        mergeOrSaveDrive(context, drive)
    }

    @Synchronized
    fun removeDrive(context: Context, id: String) {
        val existing = getAllDrives(context).toMutableList()
        existing.removeAll { it.id == id }
        saveList(context, existing)
    }

    @Synchronized
    fun updateDriveStatus(context: Context, id: String, status: String) {
        val existing = getAllDrives(context).toMutableList()
        val item = existing.find { it.id == id }
        if (item != null) {
            item.status = status
            saveList(context, existing)
        }
    }

    @Synchronized
    fun dismissStageAlarm(context: Context, id: String, stage: Int) {
        val existing = getAllDrives(context).toMutableList()
        val item = existing.find { it.id == id }
        if (item != null) {
            if (stage == 1) {
                item.alarm1Dismissed = true
            } else if (stage == 2) {
                item.alarm2Dismissed = true
                item.status = "dismissed"
            }
            saveList(context, existing)
        }
    }

    @Synchronized
    fun cancelIndividualAlarm(context: Context, id: String, alarmKey: String) {
        val existing = getAllDrives(context).toMutableList()
        val item = existing.find { it.id == id } ?: return
        when (alarmKey) {
            "stage_1" -> item.alarm1Dismissed = true
            "stage_2" -> item.alarm2Dismissed = true
            else -> {
                val custom = item.customAlarms.find { it.id == alarmKey }
                if (custom != null) {
                    custom.isDismissed = true
                }
            }
        }
        saveList(context, existing)
    }

    @Synchronized
    fun addCustomAlarm(context: Context, driveId: String, customAlarm: CustomAlarm) {
        val existing = getAllDrives(context).toMutableList()
        val item = existing.find { it.id == driveId } ?: return
        item.customAlarms.add(customAlarm)
        saveList(context, existing)
    }

    @Synchronized
    fun dismissAllAlarms(context: Context, id: String) {
        val existing = getAllDrives(context).toMutableList()
        val item = existing.find { it.id == id }
        if (item != null) {
            item.alarm1Dismissed = true
            item.alarm2Dismissed = true
            item.customAlarms.forEach { it.isDismissed = true }
            item.status = "dismissed"
            saveList(context, existing)
        }
    }

    @Synchronized
    fun updateDriveAlarmTime(context: Context, id: String, newAlarmMillis: Long, newAlarmFormatted: String) {
        val existing = getAllDrives(context).toMutableList()
        val item = existing.find { it.id == id }
        if (item != null) {
            item.alarmMillis = newAlarmMillis
            item.alarmFormatted = newAlarmFormatted
            item.alarm1Millis = newAlarmMillis
            item.alarm1Formatted = newAlarmFormatted
            item.alarm1Dismissed = false
            item.status = "scheduled"
            saveList(context, existing)
        }
    }

    @Synchronized
    fun rescheduleUpcomingDrivesWithNewDefaults(context: Context, stage1Minutes: Int, stage2Minutes: Int): Int {
        val now = System.currentTimeMillis()
        val existing = getAllDrives(context).toMutableList()
        var updatedCount = 0
        val displayFormat = SimpleDateFormat("EEE, MMM dd yyyy 'at' hh:mm a", Locale.ENGLISH)

        existing.forEach { item ->
            // Only update drives that have a future deadline
            if (item.deadlineMillis > now) {
                val newAlarm1 = item.deadlineMillis - (stage1Minutes * 60 * 1000L)
                val newAlarm2 = item.deadlineMillis - (stage2Minutes * 60 * 1000L)

                // Cancel existing scheduled alarms for this drive
                AlarmScheduler.cancelAlarm(context, item.id)

                // Update Stage 1 if not already dismissed
                if (!item.alarm1Dismissed) {
                    item.alarm1Millis = newAlarm1
                    item.alarm1Formatted = displayFormat.format(Date(newAlarm1))
                    item.alarmMillis = newAlarm1
                    item.alarmFormatted = item.alarm1Formatted
                }

                // Update Stage 2 if not already dismissed
                if (!item.alarm2Dismissed) {
                    item.alarm2Millis = newAlarm2
                    item.alarm2Formatted = displayFormat.format(Date(newAlarm2))
                }

                item.status = "scheduled"
                // Reschedule with updated times
                AlarmScheduler.scheduleAlarm(context, item)
                updatedCount++
            }
        }

        if (updatedCount > 0) {
            saveList(context, existing)
        }
        return updatedCount
    }

    private fun saveList(context: Context, list: List<DriveItem>) {
        val arr = JSONArray()
        list.forEach { arr.put(it.toJsonObject()) }
        getPrefs(context).edit().putString(KEY_DRIVES, arr.toString()).apply()
    }
}
