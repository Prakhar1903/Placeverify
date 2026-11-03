package com.placementalarm

import java.text.SimpleDateFormat
import java.util.*
import java.util.regex.Pattern

data class ParsedDrive(
    val companyName: String, // Topic, Subject, or Company
    val title: String,
    val rawText: String,
    val deadlineMillis: Long,
    val deadlineFormatted: String,
    val alarmMillis: Long,
    val alarmFormatted: String,
    val offsetHours: Int,
    val category: String, // "Placement", "Assignment", "Exam", "Fee / Payment", "General"
    val alarm1Millis: Long = 0,
    val alarm1Formatted: String = "",
    val alarm2Millis: Long = 0,
    val alarm2Formatted: String = "",
    val packageInfo: String = ""
)

object DeadlineParser {

    private val displayFormat = SimpleDateFormat("EEE, MMM dd yyyy 'at' hh:mm a", Locale.ENGLISH)

    fun parse(
        title: String,
        text: String,
        stage1Minutes: Int = 120,
        stage2Minutes: Int = 60
    ): ParsedDrive? {
        // Defensive check: ignore internal app notification messages
        if (title.contains("Alarms Scheduled", ignoreCase = true) ||
            title.contains("WARNING:", ignoreCase = true) ||
            title.contains("HOURS LEFT:", ignoreCase = true) ||
            text.contains("1st Alarm", ignoreCase = true) ||
            text.contains("2nd Alarm", ignoreCase = true)) {
            return null
        }

        val deadlineMillis = extractDeadlineTimestamp(text) ?: extractDeadlineTimestamp(title)
        val packageInfo = extractPackage(text) ?: extractPackage(title) ?: ""
        val category = detectCategory(title, text)
        val topicName = extractTopicName(title, text, category)

        // If there is no deadline, no package, and not a recognized placement/academic notice, ignore
        if (deadlineMillis == null && packageInfo.isBlank() && !isPlacementOrImportantNotice(title, text)) {
            return null
        }

        if (deadlineMillis != null) {
            val alarm1Millis = deadlineMillis - (stage1Minutes * 60 * 1000L)
            val alarm2Millis = deadlineMillis - (stage2Minutes * 60 * 1000L)
            val deadlineFormatted = displayFormat.format(Date(deadlineMillis))
            val alarm1Formatted = displayFormat.format(Date(alarm1Millis))
            val alarm2Formatted = displayFormat.format(Date(alarm2Millis))

            return ParsedDrive(
                companyName = topicName,
                title = title,
                rawText = text,
                deadlineMillis = deadlineMillis,
                deadlineFormatted = deadlineFormatted,
                alarmMillis = alarm1Millis,
                alarmFormatted = alarm1Formatted,
                offsetHours = stage1Minutes / 60,
                category = category,
                alarm1Millis = alarm1Millis,
                alarm1Formatted = alarm1Formatted,
                alarm2Millis = alarm2Millis,
                alarm2Formatted = alarm2Formatted,
                packageInfo = packageInfo
            )
        } else {
            // Notification with Package or placement details but without deadline announced yet
            return ParsedDrive(
                companyName = topicName,
                title = title,
                rawText = text,
                deadlineMillis = 0L,
                deadlineFormatted = "Pending / TBA",
                alarmMillis = 0L,
                alarmFormatted = "No alarms (Waiting for deadline)",
                offsetHours = stage1Minutes / 60,
                category = category,
                alarm1Millis = 0L,
                alarm1Formatted = "",
                alarm2Millis = 0L,
                alarm2Formatted = "",
                packageInfo = packageInfo
            )
        }
    }

    fun isPlacementOrImportantNotice(title: String, text: String): Boolean {
        val combined = "$title $text".lowercase(Locale.ENGLISH)
        val triggers = listOf(
            "placement", "drive", "internship", "recruitment", "hiring",
            "job profile", "eligibility", "ctc", "package", "lpa", "stipend"
        )
        return triggers.any { combined.contains(it) }
    }

    fun extractPackage(content: String): String? {
        // 1. Explicit label prefix: CTC / Package / Salary / Stipend / Gross / Remuneration / Pay
        // e.g. "CTC: 14 LPA", "Package - 12.5 Lakhs", "Salary: 8 to 12 LPA", "Stipend: 45,000 pm"
        val p1 = Pattern.compile(
            """(?i)\b(?:CTC|Package|Salary|Stipend|Gross|Remuneration|Pay)\s*[:–\-=]?\s*(?:(?:Rs\.?|INR|₹)\s*)?([0-9]+(?:\.[0-9]+)?(?:\s*(?:-|to)\s*(?:(?:Rs\.?|INR|₹)\s*)?[0-9]+(?:\.[0-9]+)?)?\s*(?:LPA|L\.P\.A|Lakhs?|Lacs?|Cr|k|K(?:\/month)?|per annum|\/year|\/month|pm|PA))\b"""
        )
        val m1 = p1.matcher(content)
        if (m1.find()) {
            return m1.group(1)?.trim()
        }

        // 2. Standalone LPA or Lakhs: e.g. "14.5 LPA", "8-12 LPA", "24 LPA"
        val p2 = Pattern.compile(
            """(?i)\b([0-9]+(?:\.[0-9]+)?(?:\s*(?:-|to)\s*[0-9]+(?:\.[0-9]+)?)?\s*(?:LPA|L\.P\.A|Lakhs?|Lacs?))\b"""
        )
        val m2 = p2.matcher(content)
        if (m2.find()) {
            return m2.group(1)?.trim()
        }

        // 3. Currency figures e.g. "₹ 12,00,000" or "Rs. 15,00,000"
        val p3 = Pattern.compile(
            """(?i)(?:Rs\.?|INR|₹)\s*([0-9]{1,3}(?:,[0-9]{2,3})+(?:\s*(?:per annum|\/year|\/month|pm))?)"""
        )
        val m3 = p3.matcher(content)
        if (m3.find()) {
            val amt = m3.group(1)?.trim()
            if (!amt.isNullOrEmpty()) return "₹$amt"
        }

        // 4. Stipend e.g. "Stipend: 45k" or "40k/month"
        val p4 = Pattern.compile(
            """(?i)\b(?:Stipend\s*[:–\-=]?\s*)(?:(?:Rs\.?|INR|₹)\s*)?([0-9]+(?:\.[0-9]+)?\s*(?:k|K)(?:\s*(?:\/month|pm|per month))?)\b"""
        )
        val m4 = p4.matcher(content)
        if (m4.find()) {
            val amt = m4.group(1)?.trim()
            if (!amt.isNullOrEmpty()) return "$amt stipend"
        }

        return null
    }

    fun detectCategory(title: String, text: String): String {
        val combined = "$title $text".lowercase(Locale.ENGLISH)
        return when {
            combined.contains("placement") || combined.contains("drive") || combined.contains("internship") || combined.contains("recruitment") || combined.contains("hiring") || combined.contains("ctc") || combined.contains("lpa") -> "Placement"
            combined.contains("assignment") || combined.contains("homework") || combined.contains("project") || combined.contains("lab report") || combined.contains("submission") -> "Assignment"
            combined.contains("exam") || combined.contains("quiz") || combined.contains("test") || combined.contains("midterm") || combined.contains("endterm") || combined.contains("viva") -> "Exam"
            combined.contains("fee") || combined.contains("dues") || combined.contains("fine") || combined.contains("tuition") || combined.contains("payment") -> "Fee / Payment"
            else -> "General"
        }
    }

    fun extractTopicName(title: String, text: String, category: String): String {
        val genericWords = listOf(
            "placement cell", "placement", "drive", "internship", "recruitment",
            "hiring", "update", "notice", "job profile", "registration", "deadline",
            "t&p", "cdc", "training and placement", "examination cell", "exam", "accounts",
            "department", "cell", "notice board"
        )

        // Pattern 1: Title with separator e.g. "One-year Internship - PROSPERR.IO" or "PROSPERR.IO - Placement Drive"
        val separators = listOf(" - ", ": ", " | ", " – ")
        for (sep in separators) {
            if (title.contains(sep)) {
                val parts = title.split(sep)
                if (parts.size >= 2) {
                    val p0 = parts[0].trim()
                    val p1 = parts[1].trim()

                    val p1IsGeneric = genericWords.any { p1.equals(it, ignoreCase = true) || p1.contains(it, ignoreCase = true) }
                    val p0IsGeneric = genericWords.any { p0.equals(it, ignoreCase = true) || p0.contains(it, ignoreCase = true) }

                    if (p1IsGeneric && !p0IsGeneric && p0.length <= 40) {
                        return p0
                    }
                    if (!p1IsGeneric && p1.length <= 40) {
                        return p1
                    }
                    if (!p0IsGeneric && p0.length <= 40) {
                        return p0
                    }
                }
            }
        }

        // Pattern 2: Specific patterns in body text
        val bodyRegexes = listOf(
            Pattern.compile("""(?:internship|recruitment|drive|placement|hiring|package|ctc|update)\s+(?:of|for|from)\s+([A-Za-z0-9._\-]+(?:\s+[A-Za-z0-9._\-]+){0,2})""", Pattern.CASE_INSENSITIVE),
            Pattern.compile("""eligible for\s+(?:a\s+)?(?:[A-Za-z0-9._\-]+\s+)?(?:internship|recruitment|drive|placement)\s+of\s+([A-Za-z0-9._\-]+(?:\s+[A-Za-z0-9._\-]+){0,2})""", Pattern.CASE_INSENSITIVE),
            Pattern.compile("""([A-Za-z0-9._\-]+)\s+(?:is\s+)?(?:hiring|recruiting|conducting|announced)""", Pattern.CASE_INSENSITIVE),
            Pattern.compile("""(?:submission of|assignment on|project on)\s+([A-Za-z0-9._\-\\s]+?)\s+(?:is|by|due|before)""", Pattern.CASE_INSENSITIVE),
            Pattern.compile("""(?:fee for|dues for)\s+([A-Za-z0-9._\-\\s]+?)\s+(?:is|by|due|before)""", Pattern.CASE_INSENSITIVE)
        )
        for (regex in bodyRegexes) {
            val matcher = regex.matcher(text)
            if (matcher.find()) {
                val candidate = matcher.group(1)?.trim()
                if (!candidate.isNullOrEmpty() && candidate.length <= 40 && !genericWords.any { candidate.equals(it, ignoreCase = true) }) {
                    return candidate
                }
            }
        }

        // Fallback: Use cleaned title if short and not completely generic
        val cleanTitle = title.trim()
        if (cleanTitle.isNotBlank() && cleanTitle.length <= 35 && !genericWords.any { cleanTitle.equals(it, ignoreCase = true) }) {
            return cleanTitle
        }
        return "$category Update"
    }

    fun extractDeadlineTimestamp(content: String): Long? {
        val nowCalendar = Calendar.getInstance()
        val currentYear = nowCalendar.get(Calendar.YEAR)

        val triggerPrefixes = "(?:register by|registration by|registration|deadline|last date|submit by|submission|due date|due by|due on|apply by|apply before|valid till|valid until|closes on|before)"

        // Pattern 1: Trigger ... Month Day Year [Time]
        val p1 = Pattern.compile(
            "$triggerPrefixes[^.]{0,80}?\\b([A-Za-z]{3,9})\\s+(\\d{1,2})[\\s,]+(\\d{4})(?:[\\s,]+(\\d{1,2})(?::(\\d{2}))?\\s*([APMapm]{2}))?",
            Pattern.CASE_INSENSITIVE
        )
        val m1 = p1.matcher(content)
        if (m1.find()) {
            val monthStr = m1.group(1)
            val day = m1.group(2)?.toIntOrNull() ?: 1
            val year = m1.group(3)?.toIntOrNull() ?: currentYear
            val hour = m1.group(4)?.toIntOrNull() ?: 11
            val min = m1.group(5)?.toIntOrNull() ?: if (m1.group(4) == null) 59 else 0
            val ampm = m1.group(6)?.uppercase(Locale.ENGLISH) ?: "PM"
            return buildTimestamp(year, monthStr, day, hour, min, ampm)
        }

        // Pattern 2: Trigger ... Day Month Year [Time]
        val p2 = Pattern.compile(
            "$triggerPrefixes[^.]{0,80}?\\b(\\d{1,2})[\\s\\-\\/]([A-Za-z]{3,9})[\\s\\-\\/](\\d{4})(?:[\\s,]+(\\d{1,2})(?::(\\d{2}))?\\s*([APMapm]{2}))?",
            Pattern.CASE_INSENSITIVE
        )
        val m2 = p2.matcher(content)
        if (m2.find()) {
            val day = m2.group(1)?.toIntOrNull() ?: 1
            val monthStr = m2.group(2)
            val year = m2.group(3)?.toIntOrNull() ?: currentYear
            val hour = m2.group(4)?.toIntOrNull() ?: 11
            val min = m2.group(5)?.toIntOrNull() ?: if (m2.group(4) == null) 59 else 0
            val ampm = m2.group(6)?.uppercase(Locale.ENGLISH) ?: "PM"
            return buildTimestamp(year, monthStr, day, hour, min, ampm)
        }

        // Pattern 3: Trigger ... Month Day [Time] (no year -> current year)
        val p3 = Pattern.compile(
            "$triggerPrefixes[^.]{0,80}?\\b([A-Za-z]{3,9})\\s+(\\d{1,2})(?:[\\s,]+(\\d{1,2})(?::(\\d{2}))?\\s*([APMapm]{2}))?",
            Pattern.CASE_INSENSITIVE
        )
        val m3 = p3.matcher(content)
        if (m3.find()) {
            val monthStr = m3.group(1)
            val day = m3.group(2)?.toIntOrNull() ?: 1
            val hour = m3.group(3)?.toIntOrNull() ?: 11
            val min = m3.group(4)?.toIntOrNull() ?: if (m3.group(3) == null) 59 else 0
            val ampm = m3.group(5)?.uppercase(Locale.ENGLISH) ?: "PM"
            return buildTimestamp(currentYear, monthStr, day, hour, min, ampm)
        }

        // Pattern 4: Standalone Month Day Year Time anywhere in text
        val p4 = Pattern.compile(
            "\\b([A-Za-z]{3,9})\\s+(\\d{1,2})[\\s,]+(\\d{4})[\\s,]+(\\d{1,2})(?::(\\d{2}))?\\s*([APMapm]{2})",
            Pattern.CASE_INSENSITIVE
        )
        val m4 = p4.matcher(content)
        if (m4.find()) {
            val monthStr = m4.group(1)
            val day = m4.group(2)?.toIntOrNull() ?: 1
            val year = m4.group(3)?.toIntOrNull() ?: currentYear
            val hour = m4.group(4)?.toIntOrNull() ?: 0
            val min = m4.group(5)?.toIntOrNull() ?: 0
            val ampm = m4.group(6)?.uppercase(Locale.ENGLISH) ?: "AM"
            return buildTimestamp(year, monthStr, day, hour, min, ampm)
        }

        // Pattern 5: Relative days: "today at 11:59PM", "tomorrow at 5:00PM"
        val pRel = Pattern.compile(
            """\b(today|tomorrow)\b[^.]{0,30}?\b(\d{1,2})(?::(\d{2}))?\s*([APMapm]{2})""",
            Pattern.CASE_INSENSITIVE
        )
        val mRel = pRel.matcher(content)
        if (mRel.find()) {
            val whichDay = mRel.group(1)?.lowercase(Locale.ENGLISH) ?: "today"
            val hour = mRel.group(2)?.toIntOrNull() ?: 11
            val min = mRel.group(3)?.toIntOrNull() ?: 0
            val ampm = mRel.group(4)?.uppercase(Locale.ENGLISH) ?: "PM"

            val cal = Calendar.getInstance()
            if (whichDay == "tomorrow") {
                cal.add(Calendar.DAY_OF_YEAR, 1)
            }
            var hour24 = hour
            if (ampm == "PM" && hour < 12) hour24 += 12
            if (ampm == "AM" && hour == 12) hour24 = 0
            cal.set(Calendar.HOUR_OF_DAY, hour24)
            cal.set(Calendar.MINUTE, min)
            cal.set(Calendar.SECOND, 0)
            cal.set(Calendar.MILLISECOND, 0)
            return cal.timeInMillis
        }

        // Pattern 6: Numeric date pattern: DD/MM/YYYY or DD-MM-YYYY [Time]
        val pNum = Pattern.compile(
            """\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:[,\s]+(\d{1,2})(?::(\\d{2}))?\s*([APMapm]{2}))?""",
            Pattern.CASE_INSENSITIVE
        )
        val mNum = pNum.matcher(content)
        if (mNum.find()) {
            val d = mNum.group(1)?.toIntOrNull() ?: 1
            val m = (mNum.group(2)?.toIntOrNull() ?: 1) - 1
            val y = mNum.group(3)?.toIntOrNull() ?: currentYear
            val hour = mNum.group(4)?.toIntOrNull() ?: 11
            val min = mNum.group(5)?.toIntOrNull() ?: if (mNum.group(4) == null) 59 else 0
            val ampm = mNum.group(6)?.uppercase(Locale.ENGLISH) ?: "PM"

            val cal = Calendar.getInstance()
            var hour24 = hour
            if (ampm == "PM" && hour < 12) hour24 += 12
            if (ampm == "AM" && hour == 12) hour24 = 0
            cal.set(Calendar.YEAR, y)
            cal.set(Calendar.MONTH, m)
            cal.set(Calendar.DAY_OF_MONTH, d)
            cal.set(Calendar.HOUR_OF_DAY, hour24)
            cal.set(Calendar.MINUTE, min)
            cal.set(Calendar.SECOND, 0)
            cal.set(Calendar.MILLISECOND, 0)
            return cal.timeInMillis
        }

        return null
    }

    private fun buildTimestamp(
        year: Int,
        monthStr: String?,
        day: Int,
        hour: Int,
        min: Int,
        ampm: String
    ): Long? {
        val month = parseMonth(monthStr ?: "") ?: return null
        val cal = Calendar.getInstance()

        var hour24 = hour
        if (ampm == "PM" && hour < 12) hour24 += 12
        if (ampm == "AM" && hour == 12) hour24 = 0

        cal.set(Calendar.YEAR, year)
        cal.set(Calendar.MONTH, month)
        cal.set(Calendar.DAY_OF_MONTH, day)
        cal.set(Calendar.HOUR_OF_DAY, hour24)
        cal.set(Calendar.MINUTE, min)
        cal.set(Calendar.SECOND, 0)
        cal.set(Calendar.MILLISECOND, 0)

        return cal.timeInMillis
    }

    private fun parseMonth(monthStr: String): Int? {
        val m = monthStr.lowercase(Locale.ENGLISH).take(3)
        return when (m) {
            "jan" -> Calendar.JANUARY
            "feb" -> Calendar.FEBRUARY
            "mar" -> Calendar.MARCH
            "apr" -> Calendar.APRIL
            "may" -> Calendar.MAY
            "jun" -> Calendar.JUNE
            "jul" -> Calendar.JULY
            "aug" -> Calendar.AUGUST
            "sep" -> Calendar.SEPTEMBER
            "oct" -> Calendar.OCTOBER
            "nov" -> Calendar.NOVEMBER
            "dec" -> Calendar.DECEMBER
            else -> null
        }
    }
}
