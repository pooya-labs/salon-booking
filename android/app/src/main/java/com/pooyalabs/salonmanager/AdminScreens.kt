package com.pooyalabs.salonmanager

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Call
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.EventAvailable
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.NotificationsActive
import androidx.compose.material.icons.filled.NotificationsNone
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.SettingsSuggest
import androidx.compose.material.icons.filled.ShoppingBag
import androidx.compose.material.icons.filled.Today
import androidx.compose.material.icons.filled.Tune
import androidx.compose.material.icons.filled.Vibration
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.time.LocalDate
import java.time.ZoneId

private val ForestColor = Color(0xFF173D32)
private val Sage = Color(0xFFE7EEE8)
private val CreamBg = Color(0xFFF5F3EC)
private val MutedText = Color(0xFF77817A)
private val InkColor = Color(0xFF1E2924)
private val EmeraldColor = Color(0xFF2D725A)
private val GoldTone = Color(0xFFC29A56)

@Composable
fun LoadingScreen() {
    Box(Modifier.fillMaxSize().background(CreamBg), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(14.dp)) {
            CircularProgressIndicator(color = ForestColor)
            Text("در حال اتصال امن به پنل مدیریت…", color = MutedText)
        }
    }
}

@Composable
fun LoginScreen(state: AdminUiState, onLogin: (String, String) -> Unit) {
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    Box(Modifier.fillMaxSize().background(CreamBg).padding(22.dp), contentAlignment = Alignment.Center) {
        Column(verticalArrangement = Arrangement.spacedBy(18.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Box(Modifier.size(82.dp).background(ForestColor, RoundedCornerShape(26.dp)), contentAlignment = Alignment.Center) {
                Text("ف", color = Color.White, fontSize = 42.sp, fontWeight = FontWeight.Bold)
            }
            Text("مدیریت سالن فُرم", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold, color = ForestColor)
            Text("ورود امن مدیر مجموعه", color = MutedText)
            ElevatedCard(shape = RoundedCornerShape(26.dp), colors = CardDefaults.elevatedCardColors(containerColor = Color.White)) {
                Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    OutlinedTextField(username, { username = it }, label = { Text("نام کاربری") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                    OutlinedTextField(password, { password = it }, label = { Text("گذرواژه") }, modifier = Modifier.fillMaxWidth(), singleLine = true, visualTransformation = PasswordVisualTransformation())
                    if (state.error.isNotBlank()) Text(state.error, color = MaterialTheme.colorScheme.error, fontSize = 13.sp)
                    Button(onClick = { onLogin(username, password) }, enabled = !state.busy, modifier = Modifier.fillMaxWidth().height(52.dp), shape = RoundedCornerShape(16.dp)) {
                        if (state.busy) CircularProgressIndicator(Modifier.size(20.dp), color = Color.White, strokeWidth = 2.dp)
                        else Text("ورود به پنل")
                    }
                }
            }
            Text("اطلاعات ورود همان حساب فعلی پنل وب است.", color = MutedText, fontSize = 12.sp, textAlign = TextAlign.Center)
        }
    }
}

private enum class AdminTab(val label: String) {
    BOOKINGS("نوبت‌ها"), CALENDAR("تقویم"), SERVICES("خدمات"), SCHEDULE("برنامه"), SETTINGS("تنظیمات")
}

@Composable
fun AdminHome(state: AdminUiState, vm: AdminViewModel) {
    var selected by remember { mutableStateOf(AdminTab.BOOKINGS) }
    Scaffold(
        containerColor = CreamBg,
        topBar = {
            Column {
                Row(
                    Modifier.fillMaxWidth().background(ForestColor).padding(horizontal = 20.dp, vertical = 16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        Text("فُرم", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 21.sp)
                        Text("سلام، " + state.username, color = Color(0xFFCAD9CF), fontSize = 12.sp)
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        Surface(shape = CircleShape, color = Color.White.copy(alpha = .12f)) {
                            IconButton(onClick = vm::refreshAll) { Icon(Icons.Default.Refresh, null, tint = Color.White) }
                        }
                        Surface(shape = CircleShape, color = Color.White.copy(alpha = .12f)) {
                            IconButton(onClick = { selected = AdminTab.SETTINGS }) { Icon(Icons.Default.NotificationsActive, null, tint = Color.White) }
                        }
                    }
                }
                Row(Modifier.fillMaxWidth().background(ForestColor).padding(start = 20.dp, end = 20.dp, bottom = 14.dp), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                    MetricChip("نوبت‌ها", state.bookings.size.toString())
                    MetricChip("در انتظار", state.bookings.count { it.status == "pending" }.toString())
                    MetricChip("خدمات", state.services.count { it.isActive }.toString())
                }
            }
        },
        bottomBar = {
            NavigationBar(containerColor = Color.White, tonalElevation = 10.dp) {
                AdminTab.entries.forEach { tab ->
                    val icon = when (tab) {
                        AdminTab.BOOKINGS -> Icons.Default.Home
                        AdminTab.CALENDAR -> Icons.Default.CalendarMonth
                        AdminTab.SERVICES -> Icons.Default.ShoppingBag
                        AdminTab.SCHEDULE -> Icons.Default.Schedule
                        AdminTab.SETTINGS -> Icons.Default.Settings
                    }
                    NavigationBarItem(
                        selected = selected == tab,
                        onClick = { selected = tab },
                        icon = { Icon(icon, null) },
                        label = { Text(tab.label, fontSize = 10.sp) },
                        colors = NavigationBarItemDefaults.colors(selectedIconColor = ForestColor, indicatorColor = Sage, selectedTextColor = ForestColor)
                    )
                }
            }
        }
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            if (state.refreshing) LinearProgressIndicator(Modifier.fillMaxWidth(), color = MaterialTheme.colorScheme.secondary)
            if (state.error.isNotBlank()) MessageStrip(state.error, true)
            if (state.message.isNotBlank()) MessageStrip(state.message, false)
            when (selected) {
                AdminTab.BOOKINGS -> BookingScreen(state, vm)
                AdminTab.CALENDAR -> CalendarScreen(state, vm)
                AdminTab.SERVICES -> ServicesScreen(state, vm)
                AdminTab.SCHEDULE -> ScheduleScreen(state, vm)
                AdminTab.SETTINGS -> SettingsScreen(state, vm)
            }
        }
    }
}

@Composable
private fun MetricChip(title: String, count: String) {
    Surface(color = Color.White.copy(alpha = .12f), shape = RoundedCornerShape(12.dp)) {
        Row(Modifier.padding(horizontal = 12.dp, vertical = 7.dp), horizontalArrangement = Arrangement.spacedBy(7.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(count, color = Color.White, fontWeight = FontWeight.Bold)
            Text(title, color = Color(0xFFDCE6DF), fontSize = 11.sp)
        }
    }
}

@Composable
private fun MessageStrip(message: String, error: Boolean) {
    Surface(color = if (error) Color(0xFFFFE9E5) else Color(0xFFE4F1E7), modifier = Modifier.fillMaxWidth()) {
        Text(message, Modifier.padding(horizontal = 16.dp, vertical = 9.dp), color = if (error) Color(0xFF9D3326) else ForestColor, fontSize = 12.sp)
    }
}

@Composable
private fun SectionTitle(title: String, subtitle: String? = null, action: (@Composable () -> Unit)? = null) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
        Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = ForestColor)
            if (!subtitle.isNullOrBlank()) Text(subtitle, color = MutedText, fontSize = 12.sp)
        }
        action?.invoke()
    }
}

@Composable
private fun PageColumn(content: @Composable ColumnScope.() -> Unit) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 18.dp), verticalArrangement = Arrangement.spacedBy(14.dp), content = content)
}

@Composable
private fun BookingScreen(state: AdminUiState, vm: AdminViewModel) {
    var showManualBooking by remember { mutableStateOf(false) }
    PageColumn {
        SectionTitle("مدیریت نوبت‌ها", "فهرست هفت روز انتخاب‌شده")
        Button(onClick = { showManualBooking = true }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp)) {
            Icon(Icons.Default.Add, null); Spacer(Modifier.width(7.dp)); Text("ثبت نوبت تلفنی یا حضوری")
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            OutlinedButton(onClick = { shiftDate(state.selectedDate, -1, vm) }, modifier = Modifier.weight(1f)) { Icon(Icons.Default.ChevronRight, null); Text("روز قبل") }
            OutlinedButton(onClick = { vm.selectDate(LocalDate.now(ZoneId.of("Asia/Tehran")).toString()) }, modifier = Modifier.weight(1f)) { Icon(Icons.Default.Today, null); Text("امروز") }
            OutlinedButton(onClick = { shiftDate(state.selectedDate, 1, vm) }, modifier = Modifier.weight(1f)) { Text("روز بعد"); Icon(Icons.Default.ChevronLeft, null) }
        }
        Text(JalaliDate.format(state.selectedDate), color = ForestColor, fontWeight = FontWeight.SemiBold)
        Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
            listOf("all" to "همه", "pending" to "در انتظار", "confirmed" to "تأییدشده", "completed" to "انجام‌شده", "cancelled" to "لغوشده", "no_show" to "عدم مراجعه").forEach { (key, label) ->
                FilterChip(selected = state.statusFilter == key, onClick = { vm.setStatusFilter(key) }, label = { Text(label, fontSize = 11.sp) })
            }
        }
        if (state.bookings.isEmpty()) EmptyPanel("برای این بازه نوبتی ثبت نشده است.", Icons.Default.EventAvailable)
        state.bookings.forEach { booking -> BookingCard(booking, onStatus = { vm.updateBookingStatus(booking, it) }, onDelete = { vm.deleteBooking(booking) }) }
    }
    if (showManualBooking) ManualBookingDialog(
        services = state.services.filter { it.isActive },
        initialDate = state.selectedDate,
        onDismiss = { showManualBooking = false },
        onSave = { first, last, phone, service, date, time, note ->
            showManualBooking = false
            vm.createManualBooking(first, last, phone, service, date, time, note)
        }
    )
}

private fun shiftDate(date: String, days: Long, vm: AdminViewModel) {
    val next = runCatching { LocalDate.parse(date).plusDays(days).toString() }.getOrDefault(date)
    vm.selectDate(next)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ManualBookingDialog(
    services: List<ServiceItem>,
    initialDate: String,
    onDismiss: () -> Unit,
    onSave: (String, String, String, String, String, String, String) -> Unit
) {
    var firstName by remember { mutableStateOf("") }
    var lastName by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var date by remember(initialDate) { mutableStateOf(initialDate) }
    var time by remember { mutableStateOf("10:00") }
    var note by remember { mutableStateOf("") }
    var selectedService by remember(services) { mutableStateOf(services.firstOrNull()) }
    var expanded by remember { mutableStateOf(false) }
    var localError by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("ثبت نوبت تلفنی یا حضوری") },
        text = {
            Column(Modifier.heightIn(max = 540.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(9.dp)) {
                OutlinedTextField(firstName, { firstName = it }, label = { Text("نام") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                OutlinedTextField(lastName, { lastName = it }, label = { Text("نام خانوادگی") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                OutlinedTextField(phone, { phone = it }, label = { Text("شماره تماس") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = it }) {
                    OutlinedTextField(
                        value = selectedService?.name ?: "خدمتی ثبت نشده",
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("خدمت") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                        modifier = Modifier.menuAnchor().fillMaxWidth()
                    )
                    ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                        services.forEach { service ->
                            DropdownMenuItem(text = { Text(service.name + " · " + service.durationMinutes + " دقیقه") }, onClick = {
                                selectedService = service
                                expanded = false
                            })
                        }
                    }
                }
                OutlinedTextField(date, { date = it }, label = { Text("تاریخ میلادی YYYY-MM-DD") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                OutlinedTextField(time, { time = it }, label = { Text("ساعت ۲۴ ساعته HH:mm") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                OutlinedTextField(note, { note = it }, label = { Text("توضیحات (اختیاری)") }, modifier = Modifier.fillMaxWidth())
                if (localError.isNotBlank()) Text(localError, color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
                if (services.isEmpty()) Text("ابتدا یک خدمت فعال تعریف کنید.", color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
            }
        },
        confirmButton = {
            Button(onClick = {
                localError = when {
                    firstName.trim().isBlank() || lastName.trim().isBlank() -> "نام و نام خانوادگی را کامل کنید."
                    phone.filter { it.isDigit() }.length < 8 -> "شماره تماس معتبر وارد کنید."
                    selectedService == null -> "یک خدمت فعال انتخاب کنید."
                    !runCatching { LocalDate.parse(date) }.isSuccess -> "تاریخ را با قالب YYYY-MM-DD وارد کنید."
                    !time.matches(Regex("^([01]\\d|2[0-3]):[0-5]\\d$")) -> "ساعت را با قالب HH:mm وارد کنید."
                    else -> ""
                }
                if (localError.isBlank() && selectedService != null) onSave(firstName, lastName, phone, selectedService!!.id, date, time, note)
            }, enabled = services.isNotEmpty()) { Text("ثبت نوبت") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("انصراف") } }
    )
}

@Composable
private fun BookingCard(booking: Booking, onStatus: (String) -> Unit, onDelete: () -> Unit) {
    var confirmDelete by remember { mutableStateOf(false) }
    ElevatedCard(shape = RoundedCornerShape(20.dp), colors = CardDefaults.elevatedCardColors(containerColor = Color.White)) {
        Column(Modifier.padding(15.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Top) {
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(booking.name.ifBlank { "مشتری" }, fontWeight = FontWeight.Bold, color = ForestColor, fontSize = 16.sp)
                    Text(booking.service + " · " + JalaliDate.faDigits(booking.durationMinutes.toString()) + " دقیقه", color = MutedText, fontSize = 12.sp)
                }
                StatusBadge(booking.status)
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(JalaliDate.format(booking.date), color = MutedText, fontSize = 12.sp)
                Text(JalaliDate.faDigits(booking.time), color = ForestColor, fontWeight = FontWeight.Bold)
            }
            if (booking.note.isNotBlank()) {
                Text(booking.note, color = MutedText, fontSize = 11.sp)
            }
            if (booking.phone.isNotBlank()) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(booking.phone, color = InkColor, fontSize = 13.sp, modifier = Modifier.weight(1f))
                    val context = LocalContext.current
                    OutlinedButton(onClick = {
                        context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + booking.phone)))
                    }, contentPadding = PaddingValues(horizontal = 11.dp, vertical = 5.dp)) {
                        Icon(Icons.Default.Call, null, Modifier.size(15.dp))
                        Spacer(Modifier.width(5.dp))
                        Text("تماس")
                    }
                }
            } else Text("شماره تماس ثبت نشده", color = MutedText, fontSize = 11.sp)
            Row(horizontalArrangement = Arrangement.spacedBy(7.dp), verticalAlignment = Alignment.CenterVertically) {
                when (booking.status) {
                    "pending" -> {
                        Button(onClick = { onStatus("confirmed") }, modifier = Modifier.weight(1f), contentPadding = PaddingValues(vertical = 8.dp)) { Text("تأیید نوبت", fontSize = 11.sp) }
                        OutlinedButton(onClick = { onStatus("cancelled") }, modifier = Modifier.weight(1f), contentPadding = PaddingValues(vertical = 8.dp)) { Text("لغو", fontSize = 11.sp) }
                    }
                    "confirmed" -> {
                        Button(onClick = { onStatus("completed") }, modifier = Modifier.weight(1f), contentPadding = PaddingValues(vertical = 8.dp)) { Text("انجام شد", fontSize = 11.sp) }
                        OutlinedButton(onClick = { onStatus("no_show") }, modifier = Modifier.weight(1f), contentPadding = PaddingValues(vertical = 8.dp)) { Text("عدم مراجعه", fontSize = 11.sp) }
                    }
                }
                IconButton(onClick = { confirmDelete = true }) { Icon(Icons.Default.Delete, null, tint = Color(0xFFAB5348)) }
            }
        }
    }
    if (confirmDelete) AlertDialog(
        onDismissRequest = { confirmDelete = false },
        title = { Text("حذف نوبت") },
        text = { Text("نوبت " + booking.name + " حذف شود؟ این عملیات قابل بازگشت نیست.") },
        confirmButton = { TextButton(onClick = { confirmDelete = false; onDelete() }) { Text("حذف", color = Color(0xFFAB5348)) } },
        dismissButton = { TextButton(onClick = { confirmDelete = false }) { Text("انصراف") } }
    )
}

@Composable
private fun StatusBadge(status: String) {
    val (label, color) = when (status) {
        "confirmed" -> "تأییدشده" to Color(0xFF23704F)
        "pending" -> "در انتظار" to Color(0xFFAE7B22)
        "completed" -> "انجام‌شده" to Color(0xFF456C83)
        "cancelled" -> "لغوشده" to Color(0xFF9D5047)
        "no_show" -> "عدم مراجعه" to Color(0xFF86646A)
        else -> status to MutedText
    }
    Surface(color = color.copy(alpha = .12f), shape = RoundedCornerShape(50)) {
        Text(label, Modifier.padding(horizontal = 10.dp, vertical = 5.dp), color = color, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun CalendarScreen(state: AdminUiState, vm: AdminViewModel) {
    var showBlock by remember { mutableStateOf(false) }
    PageColumn {
        SectionTitle("تقویم روزانه", "نوبت‌ها، ساعات کاری و مسدودی‌ها")
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = { shiftDate(state.selectedDate, -1, vm) }) { Icon(Icons.Default.ChevronRight, null) }
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(JalaliDate.format(state.selectedDate), fontWeight = FontWeight.Bold, color = ForestColor)
                Text(state.selectedDate, color = MutedText, fontSize = 10.sp)
            }
            IconButton(onClick = { shiftDate(state.selectedDate, 1, vm) }) { Icon(Icons.Default.ChevronLeft, null) }
        }
        Button(onClick = { showBlock = true }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp)) {
            Icon(Icons.Default.Add, null); Spacer(Modifier.width(7.dp)); Text("مسدود کردن زمان دستی")
        }
        val plan = state.dayPlan
        if (plan == null) EmptyPanel("در حال دریافت برنامه روز…", Icons.Default.Schedule)
        else {
            InfoPanel("ساعات کاری", plan.windows.joinToString("  ·  ") { it.startsAt + " تا " + it.endsAt }.ifBlank { "برای این روز ساعتی ثبت نشده است." })
            SectionTitle("نوبت‌های مشتری", JalaliDate.faDigits(plan.bookings.size.toString()) + " نوبت")
            if (plan.bookings.isEmpty()) Text("نوبتی در این روز وجود ندارد.", color = MutedText, fontSize = 12.sp)
            plan.bookings.forEach { item ->
                ElevatedCard(shape = RoundedCornerShape(16.dp), colors = CardDefaults.elevatedCardColors(containerColor = Color.White)) {
                    Column(Modifier.padding(13.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text(item.serviceName, fontWeight = FontWeight.Bold, color = ForestColor)
                            Text(JalaliDate.faDigits(item.time + "–" + item.endTime), fontWeight = FontWeight.Bold)
                        }
                        Text(item.name + " · " + item.durationMinutes + " دقیقه", color = MutedText, fontSize = 12.sp)
                        if (item.phone.isNotBlank()) {
                            val context = LocalContext.current
                            TextButton(onClick = { context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + item.phone))) }) {
                                Icon(Icons.Default.Call, null, Modifier.size(15.dp)); Spacer(Modifier.width(5.dp)); Text(item.phone)
                            }
                        }
                    }
                }
            }
            SectionTitle("زمان‌های مسدودشده", plan.blocks.size.toString() + " بازه")
            if (plan.blocks.isEmpty()) Text("زمانی به‌صورت دستی مسدود نشده است.", color = MutedText, fontSize = 12.sp)
            plan.blocks.forEach { block ->
                Surface(color = Color.White, shape = RoundedCornerShape(14.dp), border = BorderStroke(1.dp, Color(0xFFE6DED2))) {
                    Row(Modifier.fillMaxWidth().padding(13.dp), verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(JalaliDate.faDigits(block.time + "–" + block.endTime), fontWeight = FontWeight.Bold)
                            Text("مسدودی دستی · " + block.durationMinutes + " دقیقه", color = MutedText, fontSize = 11.sp)
                        }
                        TextButton(onClick = { vm.deleteTimeBlock(block) }) { Text("برداشتن", color = Color(0xFF9D5047)) }
                    }
                }
            }
        }
    }
    if (showBlock) TimeBlockDialog(state.selectedDate, onDismiss = { showBlock = false }, onSave = { date, time, duration -> showBlock = false; vm.createTimeBlock(date, time, duration) })
}

@Composable
private fun TimeBlockDialog(date: String, onDismiss: () -> Unit, onSave: (String, String, Int) -> Unit) {
    var day by remember(date) { mutableStateOf(date) }
    var time by remember { mutableStateOf("10:00") }
    var duration by remember { mutableStateOf("30") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("مسدود کردن زمان") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
                OutlinedTextField(day, { day = it }, label = { Text("تاریخ میلادی YYYY-MM-DD") }, singleLine = true)
                OutlinedTextField(time, { time = it }, label = { Text("ساعت ۲۴ ساعته") }, singleLine = true)
                OutlinedTextField(duration, { duration = it.filter(Char::isDigit) }, label = { Text("مدت به دقیقه") }, singleLine = true)
            }
        },
        confirmButton = { Button(onClick = { onSave(day, time, duration.toIntOrNull() ?: 30) }) { Text("ثبت مسدودی") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("انصراف") } }
    )
}

@Composable
private fun ServicesScreen(state: AdminUiState, vm: AdminViewModel) {
    var selected by remember { mutableStateOf<ServiceItem?>(null) }
    var creating by remember { mutableStateOf(false) }
    PageColumn {
        SectionTitle("خدمات سالن", "مدیریت قیمت، مدت و وضعیت نمایش", action = {
            FilledIconButton(onClick = { selected = null; creating = true }) { Icon(Icons.Default.Add, null) }
        })
        if (state.services.isEmpty()) EmptyPanel("هنوز خدمتی ثبت نشده است.", Icons.Default.ShoppingBag)
        state.services.forEach { service ->
            ElevatedCard(shape = RoundedCornerShape(18.dp), colors = CardDefaults.elevatedCardColors(containerColor = Color.White)) {
                Row(Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(service.name, color = ForestColor, fontWeight = FontWeight.Bold)
                        Text(service.category + " · " + service.durationMinutes + " دقیقه", color = MutedText, fontSize = 11.sp)
                        Text(if (service.priceAmount > 0) JalaliDate.faDigits(service.priceAmount.toString()) + " " + service.priceCurrency else "قیمت توافقی", color = InkColor, fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
                    }
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Switch(checked = service.isActive, onCheckedChange = { vm.toggleService(service) })
                        IconButton(onClick = { selected = service; creating = true }) { Icon(Icons.Default.Edit, null, tint = ForestColor) }
                    }
                }
            }
        }
    }
    if (creating) ServiceDialog(service = selected, onDismiss = { creating = false }, onSave = { vm.saveService(it); creating = false })
}

@Composable
private fun ServiceDialog(service: ServiceItem?, onDismiss: () -> Unit, onSave: (ServiceItem) -> Unit) {
    var name by remember(service) { mutableStateOf(service?.name.orEmpty()) }
    var category by remember(service) { mutableStateOf(service?.category ?: "عمومی") }
    var description by remember(service) { mutableStateOf(service?.description.orEmpty()) }
    var duration by remember(service) { mutableStateOf((service?.durationMinutes ?: 45).toString()) }
    var price by remember(service) { mutableStateOf((service?.priceAmount ?: 0L).toString()) }
    var currency by remember(service) { mutableStateOf(service?.priceCurrency ?: "IRR") }
    var active by remember(service) { mutableStateOf(service?.isActive ?: true) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (service == null) "افزودن خدمت" else "ویرایش خدمت") },
        text = {
            Column(Modifier.heightIn(max = 480.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(name, { name = it }, label = { Text("نام خدمت") }, singleLine = true)
                OutlinedTextField(category, { category = it }, label = { Text("دسته‌بندی") }, singleLine = true)
                OutlinedTextField(description, { description = it }, label = { Text("توضیحات") })
                OutlinedTextField(duration, { duration = it.filter(Char::isDigit) }, label = { Text("مدت به دقیقه") }, singleLine = true)
                OutlinedTextField(price, { price = it.filter(Char::isDigit) }, label = { Text("مبلغ") }, singleLine = true)
                OutlinedTextField(currency, { currency = it.uppercase().take(8) }, label = { Text("واحد پول") }, singleLine = true)
                Row(verticalAlignment = Alignment.CenterVertically) { Text("فعال در سایت مشتری", Modifier.weight(1f)); Switch(active, { active = it }) }
            }
        },
        confirmButton = { Button(onClick = {
            if (name.isNotBlank()) onSave(ServiceItem(service?.id.orEmpty(), name.trim(), description.trim(), category.trim(), duration.toIntOrNull() ?: 45, price.toLongOrNull() ?: 0L, currency.ifBlank { "IRR" }, active, service?.sortOrder ?: 0))
        }) { Text("ذخیره") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("انصراف") } }
    )
}

@Composable
private fun ScheduleScreen(state: AdminUiState, vm: AdminViewModel) {
    var editingDay by remember { mutableStateOf<WeeklyDay?>(null) }
    var showRules by remember { mutableStateOf(false) }
    var showException by remember { mutableStateOf(false) }
    PageColumn {
        SectionTitle("برنامه کاری", "ساعات هفتگی و تعطیلی‌های ویژه")
        InfoPanel("منطقه زمانی", "تهران · Asia/Tehran")
        Card(shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = Color.White)) {
            Column(Modifier.padding(15.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("قوانین رزرو", fontWeight = FontWeight.Bold, color = ForestColor)
                        Text("فاصله نوبت، مهلت و بازه مجاز رزرو", color = MutedText, fontSize = 11.sp)
                    }
                    IconButton(onClick = { showRules = true }) { Icon(Icons.Default.Tune, null) }
                }
                RuleLine("فاصله نوبت‌ها", state.rules.slotIntervalMinutes.toString() + " دقیقه")
                RuleLine("حداقل مهلت رزرو", state.rules.minBookingNoticeMinutes.toString() + " دقیقه")
                RuleLine("بازه رزرو", state.rules.bookingWindowDays.toString() + " روز")
                RuleLine("فاصله بین خدمات", state.rules.bufferMinutes.toString() + " دقیقه")
            }
        }
        SectionTitle("ساعات هفتگی")
        state.weeklyDays.forEach { day ->
            Surface(color = Color.White, shape = RoundedCornerShape(15.dp), modifier = Modifier.fillMaxWidth().clickable { editingDay = day }) {
                Row(Modifier.padding(horizontal = 14.dp, vertical = 13.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(day.name, fontWeight = FontWeight.SemiBold)
                        Text(if (day.isClosed) "تعطیل" else day.intervals.joinToString(" · ") { it.startsAt + " تا " + it.endsAt }, color = MutedText, fontSize = 11.sp)
                    }
                    Icon(Icons.Default.Edit, null, tint = ForestColor)
                }
            }
        }
        SectionTitle("تعطیلی‌ها و تغییرات ویژه", action = {
            FilledIconButton(onClick = { showException = true }) { Icon(Icons.Default.Add, null) }
        })
        if (state.exceptions.isEmpty()) Text("تغییر ویژه‌ای ثبت نشده است.", color = MutedText, fontSize = 12.sp)
        state.exceptions.forEach { exception ->
            Surface(color = Color.White, shape = RoundedCornerShape(14.dp)) {
                Row(Modifier.fillMaxWidth().padding(13.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(JalaliDate.format(exception.date), fontWeight = FontWeight.Bold)
                        Text(if (exception.isClosed) "تعطیل" else exception.intervals.joinToString(" · ") { it.startsAt + " تا " + it.endsAt }, color = MutedText, fontSize = 11.sp)
                        if (exception.note.isNotBlank()) Text(exception.note, color = MutedText, fontSize = 11.sp)
                    }
                    IconButton(onClick = { vm.deleteException(exception) }) { Icon(Icons.Default.Delete, null, tint = Color(0xFF9D5047)) }
                }
            }
        }
    }
    editingDay?.let { day -> WeeklyDayDialog(day, onDismiss = { editingDay = null }, onSave = { vm.saveWeeklyDay(it); editingDay = null }) }
    if (showRules) RulesDialog(state.rules, onDismiss = { showRules = false }, onSave = { vm.saveRules(it); showRules = false })
    if (showException) ExceptionDialog(onDismiss = { showException = false }, onSave = { date, closed, intervals, note -> vm.addException(date, closed, intervals, note); showException = false })
}

@Composable
private fun RuleLine(label: String, value: String) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, color = MutedText, fontSize = 12.sp)
        Text(value, color = ForestColor, fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
    }
}

@Composable
private fun RulesDialog(rules: SalonRules, onDismiss: () -> Unit, onSave: (SalonRules) -> Unit) {
    var slot by remember { mutableStateOf(rules.slotIntervalMinutes.toString()) }
    var notice by remember { mutableStateOf(rules.minBookingNoticeMinutes.toString()) }
    var window by remember { mutableStateOf(rules.bookingWindowDays.toString()) }
    var buffer by remember { mutableStateOf(rules.bufferMinutes.toString()) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("قوانین رزرو") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(slot, { slot = it.filter(Char::isDigit) }, label = { Text("فاصله نوبت‌ها (۵ تا ۱۲۰ دقیقه)") }, singleLine = true)
                OutlinedTextField(notice, { notice = it.filter(Char::isDigit) }, label = { Text("حداقل مهلت رزرو به دقیقه") }, singleLine = true)
                OutlinedTextField(window, { window = it.filter(Char::isDigit) }, label = { Text("بازه رزرو به روز") }, singleLine = true)
                OutlinedTextField(buffer, { buffer = it.filter(Char::isDigit) }, label = { Text("فاصله بین نوبت‌ها به دقیقه") }, singleLine = true)
            }
        },
        confirmButton = { Button(onClick = { onSave(SalonRules(slot.toIntOrNull() ?: 15, notice.toIntOrNull() ?: 0, window.toIntOrNull() ?: 30, buffer.toIntOrNull() ?: 0)) }) { Text("ذخیره") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("انصراف") } }
    )
}

@Composable
private fun WeeklyDayDialog(day: WeeklyDay, onDismiss: () -> Unit, onSave: (WeeklyDay) -> Unit) {
    var closed by remember(day) { mutableStateOf(day.isClosed) }
    var intervals by remember(day) { mutableStateOf(day.intervals.ifEmpty { listOf(WorkInterval("09:00", "17:00")) }) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("ساعات " + day.name) },
        text = {
            Column(Modifier.heightIn(max = 420.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(9.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) { Text("این روز تعطیل است", Modifier.weight(1f)); Switch(closed, { closed = it }) }
                if (!closed) {
                    intervals.forEachIndexed { index, interval ->
                        Row(horizontalArrangement = Arrangement.spacedBy(5.dp), verticalAlignment = Alignment.CenterVertically) {
                            OutlinedTextField(interval.startsAt, { v -> intervals = intervals.toMutableList().also { it[index] = interval.copy(startsAt = v) } }, label = { Text("شروع") }, modifier = Modifier.weight(1f), singleLine = true)
                            OutlinedTextField(interval.endsAt, { v -> intervals = intervals.toMutableList().also { it[index] = interval.copy(endsAt = v) } }, label = { Text("پایان") }, modifier = Modifier.weight(1f), singleLine = true)
                            IconButton(onClick = { if (intervals.size > 1) intervals = intervals.filterIndexed { i, _ -> i != index } }) { Icon(Icons.Default.Close, null) }
                        }
                    }
                    TextButton(onClick = { if (intervals.size < 8) intervals = intervals + WorkInterval("13:00", "14:00") }) { Icon(Icons.Default.Add, null); Text("افزودن بازه") }
                }
            }
        },
        confirmButton = { Button(onClick = { onSave(day.copy(isClosed = closed, intervals = if (closed) emptyList() else intervals, configured = true)) }) { Text("ذخیره") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("انصراف") } }
    )
}

@Composable
private fun ExceptionDialog(onDismiss: () -> Unit, onSave: (String, Boolean, List<WorkInterval>, String) -> Unit) {
    var date by remember { mutableStateOf(LocalDate.now(ZoneId.of("Asia/Tehran")).toString()) }
    var closed by remember { mutableStateOf(false) }
    var start by remember { mutableStateOf("09:00") }
    var end by remember { mutableStateOf("17:00") }
    var note by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("تغییر برنامه یک روز") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(date, { date = it }, label = { Text("تاریخ میلادی YYYY-MM-DD") }, singleLine = true)
                Row(verticalAlignment = Alignment.CenterVertically) { Text("تعطیلی کامل", Modifier.weight(1f)); Switch(closed, { closed = it }) }
                if (!closed) {
                    OutlinedTextField(start, { start = it }, label = { Text("شروع") }, singleLine = true)
                    OutlinedTextField(end, { end = it }, label = { Text("پایان") }, singleLine = true)
                }
                OutlinedTextField(note, { note = it }, label = { Text("یادداشت") }, singleLine = true)
            }
        },
        confirmButton = { Button(onClick = { onSave(date, closed, if (closed) emptyList() else listOf(WorkInterval(start, end)), note) }) { Text("ثبت") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("انصراف") } }
    )
}

@Composable
private fun SettingsScreen(state: AdminUiState, vm: AdminViewModel) {
    var email by remember(state.notices) { mutableStateOf(state.notices.emailEnabled) }
    var project by remember(state.notices) { mutableStateOf(state.notices.firebaseProjectId) }
    val context = LocalContext.current
    PageColumn {
        SectionTitle("اعلان‌ها و تنظیمات", "دریافت اعلان بومی روی گوشی مدیر")
        ElevatedCard(shape = RoundedCornerShape(20.dp), colors = CardDefaults.elevatedCardColors(containerColor = Color.White)) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(11.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.NotificationsActive, null, tint = EmeraldColor, modifier = Modifier.size(28.dp))
                    Spacer(Modifier.width(10.dp))
                    Column(Modifier.weight(1f)) {
                        Text("اعلان‌های اندروید", fontWeight = FontWeight.Bold, color = ForestColor)
                        Text(if (state.notices.pushReady) "اتصال سرور آماده است" else "برای فعال‌سازی، دستگاه را ثبت کنید", color = MutedText, fontSize = 11.sp)
                    }
                    StatusBadge(if (state.notices.pushReady) "confirmed" else "pending")
                }
                RuleLine("دستگاه‌های ثبت‌شده", JalaliDate.faDigits(state.notices.pushDeviceCount.toString()))
                Button(onClick = vm::registerFcmToken, modifier = Modifier.fillMaxWidth()) { Icon(Icons.Default.NotificationsActive, null); Spacer(Modifier.width(7.dp)); Text("ثبت این گوشی برای اعلان‌ها") }
                OutlinedButton(onClick = { SalonNotifications.localTest(context) }, modifier = Modifier.fillMaxWidth()) { Icon(Icons.Default.Vibration, null); Spacer(Modifier.width(7.dp)); Text("آزمایش صدا و لرزش همین گوشی") }
                OutlinedButton(onClick = { SalonNotifications.openChannelSettings(context) }, modifier = Modifier.fillMaxWidth()) { Icon(Icons.Default.SettingsSuggest, null); Spacer(Modifier.width(7.dp)); Text("تنظیم صدای اعلان در اندروید") }
                OutlinedButton(onClick = vm::sendRemoteTest, modifier = Modifier.fillMaxWidth()) { Icon(Icons.Default.NotificationsNone, null); Spacer(Modifier.width(7.dp)); Text("ارسال اعلان آزمایشی از سرور") }
            }
        }
        ElevatedCard(shape = RoundedCornerShape(20.dp), colors = CardDefaults.elevatedCardColors(containerColor = Color.White)) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("ترجیحات", color = ForestColor, fontWeight = FontWeight.Bold)
                Row(verticalAlignment = Alignment.CenterVertically) { Text("اعلان ایمیلی", Modifier.weight(1f)); Switch(email, { email = it }) }
                OutlinedTextField(project, { project = it }, label = { Text("شناسه پروژه Firebase") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                Button(onClick = { vm.saveNotifications(state.notices.copy(emailEnabled = email, firebaseProjectId = project)) }, modifier = Modifier.fillMaxWidth()) { Text("ذخیره ترجیحات") }
            }
        }
        InfoPanel("حساب مدیر", "ورود با همان حساب پنل فعلی. نشست ورود روی دستگاه به‌صورت رمزگذاری‌شده نگهداری می‌شود.")
        OutlinedButton(onClick = vm::logout, modifier = Modifier.fillMaxWidth(), colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFF9D5047))) { Icon(Icons.Default.Close, null); Spacer(Modifier.width(7.dp)); Text("خروج از حساب") }
        Text("نسخه ۱.۰.۰ · ساخته‌شده توسط Pooya Labs", color = MutedText, fontSize = 10.sp, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
    }
}

@Composable
private fun InfoPanel(title: String, body: String) {
    Surface(color = Sage, shape = RoundedCornerShape(16.dp), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Text(title, color = ForestColor, fontWeight = FontWeight.Bold, fontSize = 13.sp)
            Text(body, color = MutedText, fontSize = 11.sp, lineHeight = 17.sp)
        }
    }
}

@Composable
private fun EmptyPanel(message: String, icon: androidx.compose.ui.graphics.vector.ImageVector) {
    Surface(color = Color.White, shape = RoundedCornerShape(20.dp), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.fillMaxWidth().padding(28.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Icon(icon, null, tint = EmeraldColor, modifier = Modifier.size(34.dp))
            Text(message, color = MutedText, textAlign = TextAlign.Center, fontSize = 13.sp)
        }
    }
}
