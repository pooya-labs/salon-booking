package com.pooyalabs.salonmanager

import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import android.icu.util.Calendar
import android.icu.util.TimeZone
import android.icu.util.ULocale

private val tehran = ZoneId.of("Asia/Tehran")
private val apiDate = DateTimeFormatter.ISO_LOCAL_DATE

data class Booking(
    val id: String, val reference: String, val name: String, val phone: String,
    val startsAt: String, val endsAt: String, val status: String, val service: String,
    val durationMinutes: Int, val note: String
) {
    val date: String get() = runCatching { java.time.Instant.parse(startsAt).atZone(tehran).toLocalDate().format(apiDate) }.getOrDefault("")
    val time: String get() = runCatching { java.time.Instant.parse(startsAt).atZone(tehran).format(DateTimeFormatter.ofPattern("HH:mm")) }.getOrDefault("")
}

data class ServiceItem(
    val id: String, val name: String, val description: String, val category: String,
    val durationMinutes: Int, val priceAmount: Long, val priceCurrency: String,
    val isActive: Boolean, val sortOrder: Int
)
data class WorkInterval(val startsAt: String, val endsAt: String)
data class WeeklyDay(val weekday: Int, val name: String, val intervals: List<WorkInterval>, val isClosed: Boolean, val configured: Boolean)
data class ScheduleException(val id: String, val date: String, val intervals: List<WorkInterval>, val isClosed: Boolean, val note: String)
data class TimeBlock(val id: String, val time: String, val endTime: String, val durationMinutes: Int)
data class DayBooking(val id: String, val time: String, val endTime: String, val serviceName: String, val name: String, val phone: String, val durationMinutes: Int, val status: String)
data class DayPlan(val date: String, val windows: List<WorkInterval>, val bookings: List<DayBooking>, val blocks: List<TimeBlock>)
data class SalonRules(val slotIntervalMinutes: Int = 15, val minBookingNoticeMinutes: Int = 0, val bookingWindowDays: Int = 30, val bufferMinutes: Int = 0)
data class NoticeSettings(val emailEnabled: Boolean = false, val firebaseProjectId: String = "", val pushDeviceCount: Int = 0, val pushReady: Boolean = false)

fun JSONObject.string(key: String) = optString(key).takeUnless { it == "null" }.orEmpty()
fun JSONObject.array(key: String) = optJSONArray(key) ?: JSONArray()
fun JSONObject.toBooking() = Booking(string("id"), string("reference"), string("name"), string("phone"), string("startsAt"), string("endsAt"), string("status"), string("service"), optInt("durationMinutes"), string("note"))
fun JSONObject.toService() = ServiceItem(string("id"), string("name"), string("description"), string("category"), optInt("durationMinutes"), optLong("priceAmount"), string("priceCurrency"), optBoolean("isActive"), optInt("sortOrder"))
fun JSONObject.toInterval() = WorkInterval(string("startsAt"), string("endsAt"))
fun JSONObject.toWeeklyDay() = WeeklyDay(optInt("weekday"), string("name"), array("intervals").objects().map { it.toInterval() }, optBoolean("isClosed"), optBoolean("configured"))
fun JSONObject.toException() = ScheduleException(string("id"), string("date"), array("intervals").objects().map { it.toInterval() }, optBoolean("isClosed"), string("note"))
fun JSONArray.objects(): List<JSONObject> = (0 until length()).mapNotNull { optJSONObject(it) }

object JalaliDate {
    private val digits = "۰۱۲۳۴۵۶۷۸۹"
    fun faDigits(value: String): String = value.map { ch -> if (ch in '0'..'9') digits[ch - '0'] else ch }.joinToString("")

    fun parts(gregorian: String): Triple<Int, Int, Int>? {
        val date = runCatching { LocalDate.parse(gregorian) }.getOrNull() ?: return null
        return toJalali(date.year, date.monthValue, date.dayOfMonth)
    }

    fun toGregorian(year: Int, month: Int, day: Int): String? = runCatching {
        require(month in 1..12 && day >= 1)
        val calendar = Calendar.getInstance(TimeZone.getTimeZone("Asia/Tehran"), ULocale("fa_IR@calendar=persian"))
        calendar.isLenient = false
        calendar.clear()
        calendar.set(year, month - 1, day, 12, 0, 0)
        java.time.Instant.ofEpochMilli(calendar.timeInMillis).atZone(tehran).toLocalDate().format(apiDate)
    }.getOrNull()

    fun monthLength(year: Int, month: Int): Int = runCatching {
        val calendar = android.icu.util.PersianCalendar(android.icu.util.TimeZone.getTimeZone("Asia/Tehran"))
        calendar.isLenient = false
        calendar.clear()
        calendar.set(year, month - 1, 1, 12, 0, 0)
        calendar.getActualMaximum(android.icu.util.Calendar.DATE)
    }.getOrDefault(if (month <= 6) 31 else if (month <= 11) 30 else 29)

    fun format(gregorian: String): String {
        val date = runCatching { LocalDate.parse(gregorian) }.getOrNull() ?: return faDigits(gregorian)
        val (year, month, day) = toJalali(date.year, date.monthValue, date.dayOfMonth)
        val months = listOf("فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند")
        return faDigits("$day " + months[month - 1] + " $year")
    }

    private fun toJalali(gy: Int, gm: Int, gd: Int): Triple<Int, Int, Int> {
        val gdm = intArrayOf(0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334)
        val gy2 = gy + if (gm > 2) 1 else 0
        var days = 355666 + 365 * gy + (gy2 + 3) / 4 - (gy2 + 99) / 100 + (gy2 + 399) / 400 + gd + gdm[gm - 1]
        var jy = -1595 + 33 * (days / 12053)
        days %= 12053
        jy += 4 * (days / 1461)
        days %= 1461
        if (days > 365) {
            jy += (days - 1) / 365
            days = (days - 1) % 365
        }
        val jm: Int
        val jd: Int
        if (days < 186) { jm = 1 + days / 31; jd = 1 + days % 31 }
        else { jm = 7 + (days - 186) / 30; jd = 1 + (days - 186) % 30 }
        return Triple(jy, jm, jd)
    }
}

object BookingTransitions {
    fun allowed(status: String): List<String> = when (status) {
        "pending" -> listOf("confirmed", "cancelled")
        "confirmed" -> listOf("completed", "cancelled", "no_show")
        else -> emptyList()
    }
}
