package com.pooyalabs.salonmanager

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate
import java.time.ZoneId

data class AdminUiState(
    val checkingSession: Boolean = true,
    val signedIn: Boolean = false,
    val username: String = "",
    val busy: Boolean = false,
    val refreshing: Boolean = false,
    val error: String = "",
    val message: String = "",
    val bookings: List<Booking> = emptyList(),
    val selectedDate: String = LocalDate.now(ZoneId.of("Asia/Tehran")).toString(),
    val statusFilter: String = "all",
    val dayPlan: DayPlan? = null,
    val services: List<ServiceItem> = emptyList(),
    val weeklyDays: List<WeeklyDay> = emptyList(),
    val exceptions: List<ScheduleException> = emptyList(),
    val rules: SalonRules = SalonRules(),
    val notices: NoticeSettings = NoticeSettings()
)

class AdminViewModel(application: Application) : AndroidViewModel(application) {
    private val vault = SessionVault(application)
    private val api = SalonApi()
    private val _state = kotlinx.coroutines.flow.MutableStateFlow(AdminUiState())
    val state: kotlinx.coroutines.flow.StateFlow<AdminUiState> = _state

    init { restoreSession() }
    private fun update(block: (AdminUiState) -> AdminUiState) { _state.value = block(_state.value) }
    private fun currentSession(): String? = vault.readSessionId()

    private fun restoreSession() {
        viewModelScope.launch {
            val session = currentSession()
            if (session == null) {
                update { it.copy(checkingSession = false) }
                return@launch
            }
            runCatching { withContext(Dispatchers.IO) { api.get(session, "/api/admin/me") } }
                .onSuccess { result ->
                    update { it.copy(checkingSession = false, signedIn = true, username = result.optJSONObject("user")?.string("username").orEmpty()) }
                    refreshAll()
                    registerFcmToken()
                }
                .onFailure {
                    vault.clear()
                    update { it.copy(checkingSession = false, signedIn = false) }
                }
        }
    }

    fun login(username: String, password: String) {
        if (username.isBlank() || password.isBlank()) {
            update { it.copy(error = "نام کاربری و گذرواژه را وارد کنید.") }
            return
        }
        viewModelScope.launch {
            update { it.copy(busy = true, error = "", message = "") }
            runCatching {
                withContext(Dispatchers.IO) {
                    val session = vault.newSessionId()
                    val response = api.post(session, "/api/admin/login", JSONObject().put("username", username.trim()).put("password", password))
                    vault.saveSessionId(session)
                    response
                }
            }.onSuccess { result ->
                update { it.copy(busy = false, signedIn = true, username = result.optJSONObject("user")?.string("username") ?: username.trim(), message = "ورود موفق بود.") }
                refreshAll()
                registerFcmToken()
            }.onFailure { fail(it) }
        }
    }

    fun logout() {
        viewModelScope.launch {
            update { it.copy(busy = true, error = "") }
            val session = currentSession()
            if (session != null) {
                runCatching {
                    val token = runCatching { FirebaseMessaging.getInstance().token.await() }.getOrNull()
                    withContext(Dispatchers.IO) {
                        if (!token.isNullOrBlank()) api.call(session, "/api/admin/push-subscriptions", "DELETE", JSONObject().put("token", token))
                        api.post(session, "/api/admin/logout", JSONObject())
                    }
                }
            }
            vault.clear()
            update { AdminUiState(checkingSession = false, signedIn = false) }
        }
    }

    fun refreshAll() {
        val session = currentSession() ?: return
        viewModelScope.launch {
            update { it.copy(refreshing = true, error = "", message = "") }
            runCatching {
                withContext(Dispatchers.IO) {
                    val selected = runCatching { LocalDate.parse(_state.value.selectedDate) }.getOrDefault(LocalDate.now(ZoneId.of("Asia/Tehran")))
                    val range = "/api/admin/bookings?from=" + selected + "&to=" + selected.plusDays(6) + "&status=" + _state.value.statusFilter
                    val bookings = api.get(session, range).array("bookings").objects().map { it.toBooking() }
                    val services = api.get(session, "/api/admin/services").array("services").objects().map { it.toService() }
                    val schedule = api.get(session, "/api/admin/schedule")
                    val rulesJson = schedule.optJSONObject("settings") ?: JSONObject()
                    val weekly = schedule.array("weeklyHours").objects().map { it.toWeeklyDay() }
                    val exceptions = schedule.array("exceptions").objects().map { it.toException() }
                    val notices = api.get(session, "/api/admin/notifications")
                    val day = loadDayBlocking(session, _state.value.selectedDate)
                    Triple(bookings to services, Triple(weekly, exceptions, rulesJson), Pair(notices, day))
                }
            }.onSuccess { (lists, schedule, noticesAndDay) ->
                val rulesJson = schedule.third
                val notices = noticesAndDay.first
                update {
                    it.copy(
                        refreshing = false, bookings = lists.first, services = lists.second,
                        weeklyDays = schedule.first, exceptions = schedule.second,
                        rules = SalonRules(
                            rulesJson.optInt("slotIntervalMinutes", 15),
                            rulesJson.optInt("minBookingNoticeMinutes", 0),
                            rulesJson.optInt("bookingWindowDays", 30),
                            rulesJson.optInt("bufferMinutes", 0)
                        ),
                        notices = NoticeSettings(notices.optBoolean("emailEnabled"), notices.string("firebaseProjectId"), notices.optInt("pushDeviceCount"), notices.optBoolean("pushReady")),
                        dayPlan = noticesAndDay.second
                    )
                }
            }.onFailure { fail(it, refreshing = true) }
        }
    }

    private fun loadDayBlocking(session: String, date: String): DayPlan {
        val result = api.get(session, "/api/admin/day-schedule?date=" + date)
        return DayPlan(
            result.string("date"),
            result.array("workingIntervals").objects().map { it.toInterval() },
            result.array("bookings").objects().map {
                DayBooking(it.string("id"), it.string("time"), it.string("endTime"), it.string("serviceName"), it.string("name"), it.string("phone"), it.optInt("durationMinutes"), it.string("status"))
            },
            result.array("blocks").objects().map { TimeBlock(it.string("id"), it.string("time"), it.string("endTime"), it.optInt("durationMinutes")) }
        )
    }

    fun selectDate(date: String) {
        update { it.copy(selectedDate = date) }
        val session = currentSession() ?: return
        viewModelScope.launch {
            runCatching { withContext(Dispatchers.IO) { loadDayBlocking(session, date) } }
                .onSuccess { plan -> update { it.copy(dayPlan = plan) } }
                .onFailure { fail(it) }
        }
        refreshBookingsOnly()
    }

    fun setStatusFilter(status: String) {
        update { it.copy(statusFilter = status) }
        refreshBookingsOnly()
    }

    private fun refreshBookingsOnly() {
        val session = currentSession() ?: return
        viewModelScope.launch {
            runCatching {
                withContext(Dispatchers.IO) {
                    val date = LocalDate.parse(_state.value.selectedDate)
                    api.get(session, "/api/admin/bookings?from=" + date + "&to=" + date.plusDays(6) + "&status=" + _state.value.statusFilter)
                        .array("bookings").objects().map { it.toBooking() }
                }
            }.onSuccess { list -> update { it.copy(bookings = list) } }.onFailure { fail(it) }
        }
    }

    fun updateBookingStatus(booking: Booking, status: String) = runAction {
        api.patch(it, "/api/admin/bookings/" + booking.id + "/status", JSONObject().put("status", status))
        update { it.copy(message = "وضعیت نوبت تغییر کرد.") }
        refreshAll()
    }

    fun deleteBooking(booking: Booking) = runAction {
        api.delete(it, "/api/admin/bookings/" + booking.id)
        update { it.copy(message = "نوبت حذف شد.") }
        refreshAll()
    }

    fun createManualBooking(firstName: String, lastName: String, phone: String, serviceId: String, date: String, time: String, note: String) = runAction {
        api.post(it, "/api/admin/bookings", JSONObject()
            .put("firstName", firstName.trim())
            .put("lastName", lastName.trim())
            .put("phone", phone.trim())
            .put("serviceId", serviceId)
            .put("date", date.trim())
            .put("time", time.trim())
            .put("note", note.trim()))
        update { it.copy(message = "نوبت تلفنی ثبت شد.") }
        selectDate(date)
    }

    fun createTimeBlock(date: String, time: String, duration: Int) = runAction {
        api.post(it, "/api/admin/time-blocks", JSONObject().put("date", date).put("time", time).put("durationMinutes", duration))
        update { it.copy(message = "زمان موردنظر مسدود شد.") }
        selectDate(date)
    }

    fun deleteTimeBlock(block: TimeBlock) = runAction {
        api.delete(it, "/api/admin/time-blocks/" + block.id)
        update { it.copy(message = "مسدودی زمان برداشته شد.") }
        selectDate(_state.value.selectedDate)
    }

    fun saveService(service: ServiceItem) = runAction {
        val payload = JSONObject()
            .put("name", service.name).put("description", service.description).put("category", service.category)
            .put("durationMinutes", service.durationMinutes).put("priceAmount", service.priceAmount)
            .put("priceCurrency", service.priceCurrency).put("isActive", service.isActive).put("sortOrder", service.sortOrder)
        if (service.id.isBlank()) api.post(it, "/api/admin/services", payload)
        else api.patch(it, "/api/admin/services/" + service.id, payload)
        update { it.copy(message = "خدمت ذخیره شد.") }
        refreshAll()
    }

    fun toggleService(service: ServiceItem) = runAction {
        api.patch(it, "/api/admin/services/" + service.id, JSONObject().put("isActive", !service.isActive))
        update { it.copy(message = if (service.isActive) "خدمت غیرفعال شد." else "خدمت فعال شد.") }
        refreshAll()
    }

    fun saveWeeklyDay(day: WeeklyDay) = runAction {
        val intervals = JSONArray()
        day.intervals.forEach { intervals.put(JSONObject().put("startsAt", it.startsAt).put("endsAt", it.endsAt)) }
        api.put(it, "/api/admin/schedule/weekly/" + day.weekday, JSONObject().put("isClosed", day.isClosed).put("intervals", intervals))
        update { it.copy(message = "برنامه کاری ذخیره شد.") }
        refreshAll()
    }

    fun saveRules(rules: SalonRules) = runAction {
        api.put(it, "/api/admin/settings", JSONObject()
            .put("timezone", "Asia/Tehran")
            .put("slotIntervalMinutes", rules.slotIntervalMinutes)
            .put("minBookingNoticeMinutes", rules.minBookingNoticeMinutes)
            .put("bookingWindowDays", rules.bookingWindowDays)
            .put("bufferMinutes", rules.bufferMinutes))
        update { it.copy(message = "تنظیمات رزرو ذخیره شد.") }
        refreshAll()
    }

    fun addException(date: String, closed: Boolean, intervals: List<WorkInterval>, note: String) = runAction {
        val array = JSONArray()
        intervals.forEach { array.put(JSONObject().put("startsAt", it.startsAt).put("endsAt", it.endsAt)) }
        api.post(it, "/api/admin/schedule/exceptions", JSONObject().put("date", date).put("isClosed", closed).put("intervals", array).put("note", note))
        update { it.copy(message = "تغییر برنامه برای این روز ذخیره شد.") }
        refreshAll()
    }

    fun deleteException(exception: ScheduleException) = runAction {
        api.delete(it, "/api/admin/schedule/exceptions/" + exception.id)
        update { it.copy(message = "استثنای برنامه حذف شد.") }
        refreshAll()
    }

    fun saveNotifications(notices: NoticeSettings) = runAction {
        val result = api.put(it, "/api/admin/notifications", JSONObject()
            .put("emailEnabled", notices.emailEnabled)
            .put("firebaseProjectId", notices.firebaseProjectId.trim()))
        update { it.copy(notices = NoticeSettings(
            result.optBoolean("emailEnabled"), result.string("firebaseProjectId"),
            result.optInt("pushDeviceCount"), result.optBoolean("pushReady")
        ), message = "تنظیمات اعلان ذخیره شد.") }
    }

    fun registerFcmToken() {
        val session = currentSession() ?: return
        viewModelScope.launch {
            runCatching { FirebaseMessaging.getInstance().token.await() }
                .onSuccess { token ->
                    if (token.isNullOrBlank()) return@onSuccess
                    runCatching {
                        withContext(Dispatchers.IO) {
                            api.post(session, "/api/admin/push-subscriptions", JSONObject()
                                .put("token", token).put("device", "Android · " + android.os.Build.MODEL.take(55)))
                        }
                    }.onSuccess {
                        update { it.copy(message = "این گوشی برای اعلان نوبت‌ها ثبت شد.") }
                        refreshAll()
                    }.onFailure { fail(it) }
                }
                .onFailure { fail(ApiException("تنظیمات Firebase اندروید کامل نیست. فایل google-services.json را اضافه کنید.")) }
        }
    }

    fun sendRemoteTest() = runAction {
        api.post(it, "/api/admin/notifications/test", JSONObject())
        update { it.copy(message = "اعلان آزمایشی از سرور ارسال شد.") }
    }

    private fun runAction(action: suspend (String) -> Unit) {
        val session = currentSession() ?: return
        viewModelScope.launch {
            update { it.copy(busy = true, error = "", message = "") }
            runCatching { withContext(Dispatchers.IO) { action(session) } }.onFailure { fail(it) }
            update { it.copy(busy = false) }
        }
    }

    private fun fail(error: Throwable, refreshing: Boolean = false) {
        update { it.copy(busy = false, refreshing = if (refreshing) false else it.refreshing, error = error.message ?: "خطای نامشخص") }
    }
}
