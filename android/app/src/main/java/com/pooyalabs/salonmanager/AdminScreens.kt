package com.pooyalabs.salonmanager

import android.content.Intent
import android.net.Uri
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.Image
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
import androidx.compose.material.icons.filled.Fingerprint
import androidx.compose.material.icons.filled.Block
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
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.time.LocalDate
import java.time.ZoneId



@Composable
fun LoadingScreen() {
    Box(Modifier.fillMaxSize().background(Brush.radialGradient(listOf(MaterialTheme.colorScheme.surfaceVariant, MaterialTheme.colorScheme.background))), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Surface(shape = RoundedCornerShape(28.dp), color = MaterialTheme.colorScheme.surface, border = BorderStroke(1.dp, MaterialTheme.colorScheme.secondary.copy(alpha = .3f)), shadowElevation = 20.dp) {
                Box(Modifier.size(92.dp), contentAlignment = Alignment.Center) { Image(painterResource(R.drawable.pooya_monogram), null, Modifier.size(66.dp), contentScale = ContentScale.Fit) }
            }
            CircularProgressIndicator(color = MaterialTheme.colorScheme.secondary, strokeWidth = 2.5.dp)
            Text("در حال اتصال امن به پنل مدیریت…", color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
fun LoginScreen(
    state: AdminUiState,
    hasSavedCredentials: Boolean,
    onLogin: (String, String, Boolean) -> Unit,
    onBiometricLogin: () -> Unit
) {
    var username by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var saveWithBiometric by remember { mutableStateOf(hasSavedCredentials) }
    var showLogin by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { showLogin = true }

    Box(
        Modifier.fillMaxSize().background(
            Brush.linearGradient(listOf(MaterialTheme.colorScheme.surfaceVariant, MaterialTheme.colorScheme.background, MaterialTheme.colorScheme.surface))
        ).padding(horizontal = 22.dp, vertical = 26.dp),
        contentAlignment = Alignment.Center
    ) {
        AnimatedVisibility(
            visible = showLogin,
            enter = fadeIn(tween(520)) + slideInVertically(tween(520)) { it / 12 }
        ) {
        Column(
            modifier = Modifier.fillMaxWidth().verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(18.dp)
        ) {
            Surface(
                modifier = Modifier.size(104.dp),
                shape = RoundedCornerShape(30.dp),
                color = MaterialTheme.colorScheme.surface,
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.secondary.copy(alpha = .28f)),
                shadowElevation = 24.dp
            ) {
                Image(
                    painter = painterResource(R.drawable.pooya_monogram),
                    contentDescription = "نشان پویا لبز",
                    modifier = Modifier.fillMaxSize().padding(10.dp),
                    contentScale = ContentScale.Fit
                )
            }
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(5.dp)) {
                Text("POOYA LABS", color = MaterialTheme.colorScheme.secondary, fontSize = 11.sp, fontWeight = FontWeight.Bold, letterSpacing = 2.sp)
                Text("مدیریت سالن", color = MaterialTheme.colorScheme.onSurface, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                Text("ورود امن به فضای مدیریت", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp)
            }
            ElevatedCard(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(28.dp),
                colors = CardDefaults.elevatedCardColors(containerColor = MaterialTheme.colorScheme.surface),
                elevation = CardDefaults.elevatedCardElevation(defaultElevation = 8.dp)
            ) {
                Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(13.dp)) {
                    Text("خوش برگشتی", color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                    OutlinedTextField(
                        value = username,
                        onValueChange = { username = it },
                        label = { Text("نام کاربری") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        shape = RoundedCornerShape(16.dp)
                    )
                    OutlinedTextField(
                        value = password,
                        onValueChange = { password = it },
                        label = { Text("گذرواژه") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        visualTransformation = PasswordVisualTransformation(),
                        shape = RoundedCornerShape(16.dp)
                    )
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(
                            checked = saveWithBiometric,
                            onCheckedChange = { saveWithBiometric = it },
                            colors = CheckboxDefaults.colors(checkedColor = MaterialTheme.colorScheme.primary)
                        )
                        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            Text("ذخیره ورود با اثر انگشت", color = MaterialTheme.colorScheme.onSurface, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                            Text("رمز فقط به‌صورت رمزنگاری‌شده و محافظت‌شده با اثر انگشت نگهداری می‌شود.", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 10.sp, lineHeight = 15.sp)
                        }
                    }
                    if (state.error.isNotBlank()) {
                        Text(state.error, color = MaterialTheme.colorScheme.error, fontSize = 12.sp)
                    }
                    Button(
                        onClick = { onLogin(username, password, saveWithBiometric) },
                        enabled = !state.busy && username.isNotBlank() && password.isNotBlank(),
                        modifier = Modifier.fillMaxWidth().height(54.dp),
                        shape = RoundedCornerShape(17.dp)
                    ) {
                        if (state.busy) CircularProgressIndicator(Modifier.size(20.dp), color = Color.White, strokeWidth = 2.dp)
                        else Text("ورود به پنل", fontWeight = FontWeight.Bold)
                    }
                    if (hasSavedCredentials) {
                        OutlinedButton(
                            onClick = onBiometricLogin,
                            enabled = !state.busy,
                            modifier = Modifier.fillMaxWidth().height(54.dp),
                            shape = RoundedCornerShape(17.dp),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.secondary),
                            border = BorderStroke(1.dp, MaterialTheme.colorScheme.secondary.copy(alpha = .7f))
                        ) {
                            Icon(Icons.Default.Fingerprint, null, modifier = Modifier.size(21.dp))
                            Spacer(Modifier.width(9.dp))
                            Text("ورود سریع با اثر انگشت", fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
            }
            Text(
                "حساب ورود همان حساب مدیریت وب‌سایت است. نشست فعال روی دستگاه امن نگهداری می‌شود.",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                fontSize = 11.sp,
                textAlign = TextAlign.Center,
                lineHeight = 17.sp
            )
        }
        }
    }
}

private enum class AdminTab(val label: String) {
    BOOKINGS("نوبت‌ها"), CALENDAR("تقویم"), SERVICES("خدمات"), SCHEDULE("برنامه"), SETTINGS("تنظیمات")
}

@Composable
fun AdminHome(
    state: AdminUiState,
    vm: AdminViewModel,
    hasSavedCredentials: Boolean,
    themeMode: String,
    onThemeModeChange: (String) -> Unit,
    onClearSavedCredentials: () -> Unit
) {
    var selected by remember { mutableStateOf(AdminTab.BOOKINGS) }
    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            Column(
                Modifier.fillMaxWidth().background(
                    Brush.horizontalGradient(listOf(MaterialTheme.colorScheme.surface, MaterialTheme.colorScheme.surfaceVariant, MaterialTheme.colorScheme.surface))
                )
            ) {
                Row(
                    Modifier.fillMaxWidth().padding(horizontal = 19.dp, vertical = 15.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Surface(
                            modifier = Modifier.size(45.dp),
                            shape = RoundedCornerShape(15.dp),
                            color = Color(0xFF141B27),
                            border = BorderStroke(1.dp, MaterialTheme.colorScheme.secondary.copy(alpha = .28f))
                        ) {
                            Image(
                                painter = painterResource(R.drawable.pooya_monogram),
                                contentDescription = "پویا لبز",
                                modifier = Modifier.fillMaxSize().padding(5.dp),
                                contentScale = ContentScale.Fit
                            )
                        }
                        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            Text("POOYA LABS", color = MaterialTheme.colorScheme.secondary, fontWeight = FontWeight.Bold, fontSize = 9.sp, letterSpacing = 1.8.sp)
                            Text("مدیریت سالن", color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                            Text("خوش اومدی، " + state.username, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp)
                        }
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(5.dp), verticalAlignment = Alignment.CenterVertically) {
                        IconButton(onClick = vm::refreshAll) {
                            Icon(Icons.Default.Refresh, "به‌روزرسانی", tint = MaterialTheme.colorScheme.onSurface)
                        }
                        IconButton(onClick = { selected = AdminTab.SETTINGS }) {
                            Icon(Icons.Default.NotificationsActive, "اعلان‌ها", tint = MaterialTheme.colorScheme.onSurface)
                        }
                    }
                }
                Row(
                    Modifier.fillMaxWidth().padding(start = 18.dp, end = 18.dp, bottom = 14.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    MetricChip("نوبت‌ها", JalaliDate.faDigits(state.bookings.size.toString()))
                    MetricChip("در انتظار", JalaliDate.faDigits(state.bookings.count { it.status == "pending" }.toString()))
                    MetricChip("خدمات فعال", JalaliDate.faDigits(state.services.count { it.isActive }.toString()))
                }
            }
        },
        bottomBar = {
            Surface(
                color = MaterialTheme.colorScheme.surface.copy(alpha = .96f),
                tonalElevation = 0.dp,
                shadowElevation = 18.dp,
                shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp),
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = .7f))
            ) {
                Row(
                    Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 5.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.SpaceEvenly,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    AdminTab.entries.forEach { tab ->
                        val icon = when (tab) {
                            AdminTab.BOOKINGS -> Icons.Default.Home
                            AdminTab.CALENDAR -> Icons.Default.CalendarMonth
                            AdminTab.SERVICES -> Icons.Default.ShoppingBag
                            AdminTab.SCHEDULE -> Icons.Default.Schedule
                            AdminTab.SETTINGS -> Icons.Default.Settings
                        }
                        val active = selected == tab
                        val tint by androidx.compose.animation.animateColorAsState(
                            if (active) MaterialTheme.colorScheme.secondary else MaterialTheme.colorScheme.onSurfaceVariant,
                            animationSpec = tween(220), label = "navTint"
                        )
                        val pillWidth by animateDpAsState(if (active) 66.dp else 48.dp, tween(260), label = "navWidth")
                        Column(
                            Modifier.weight(1f).clickable { selected = tab }.padding(vertical = 2.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Surface(
                                modifier = Modifier.width(pillWidth).height(34.dp),
                                color = if (active) MaterialTheme.colorScheme.secondary.copy(alpha = .14f) else Color.Transparent,
                                shape = RoundedCornerShape(14.dp)
                            ) {
                                Box(contentAlignment = Alignment.Center) { Icon(icon, null, tint = tint, modifier = Modifier.size(21.dp)) }
                            }
                            Text(tab.label, color = tint, fontSize = 10.sp, fontWeight = if (active) FontWeight.Bold else FontWeight.Medium)
                        }
                    }
                }
            }
        }
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            if (state.refreshing) LinearProgressIndicator(Modifier.fillMaxWidth(), color = MaterialTheme.colorScheme.secondary, trackColor = MaterialTheme.colorScheme.surface)
            if (state.error.isNotBlank()) MessageStrip(state.error, true)
            if (state.message.isNotBlank()) MessageStrip(state.message, false)
            AnimatedContent(
                targetState = selected,
                transitionSpec = {
                    (fadeIn(tween(220)) + slideInVertically(tween(260)) { it / 18 }) togetherWith
                        (fadeOut(tween(140)) + slideOutVertically(tween(180)) { -it / 24 })
                },
                label = "adminTabTransition"
            ) { tab ->
                when (tab) {
                    AdminTab.BOOKINGS -> BookingScreen(state, vm)
                    AdminTab.CALENDAR -> CalendarScreen(state, vm)
                    AdminTab.SERVICES -> ServicesScreen(state, vm)
                    AdminTab.SCHEDULE -> ScheduleScreen(state, vm)
                    AdminTab.SETTINGS -> SettingsScreen(state, vm, hasSavedCredentials, onClearSavedCredentials, themeMode, onThemeModeChange)
                }
            }
        }
    }
}

@Composable
private fun MetricChip(title: String, count: String) {
    Surface(color = MaterialTheme.colorScheme.surfaceVariant, shape = RoundedCornerShape(12.dp), border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)) {
        Row(Modifier.padding(horizontal = 12.dp, vertical = 7.dp), horizontalArrangement = Arrangement.spacedBy(7.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(count, color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold)
            Text(title, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp)
        }
    }
}

@Composable
private fun MessageStrip(message: String, error: Boolean) {
    val accent = if (error) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.secondary
    Surface(
        color = accent.copy(alpha = .10f),
        modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 5.dp),
        shape = RoundedCornerShape(14.dp),
        border = BorderStroke(1.dp, accent.copy(alpha = .24f))
    ) {
        Row(Modifier.padding(horizontal = 14.dp, vertical = 11.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(7.dp).background(accent, CircleShape))
            Spacer(Modifier.width(10.dp))
            Text(message, color = if (error) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary, fontSize = 12.sp)
        }
    }
}

@Composable
private fun SectionTitle(title: String, subtitle: String? = null, action: (@Composable () -> Unit)? = null) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
        Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
            if (!subtitle.isNullOrBlank()) Text(subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)
        }
        action?.invoke()
    }
}

@Composable
private fun PageColumn(content: @Composable ColumnScope.() -> Unit) {
    var entered by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) { entered = true }
    val alpha by animateFloatAsState(if (entered) 1f else 0f, tween(320), label = "pageAlpha")
    val offset by animateDpAsState(if (entered) 0.dp else 14.dp, tween(360), label = "pageOffset")
    Column(
        Modifier.fillMaxSize().graphicsLayer { this.alpha = alpha; translationY = offset.toPx() }
            .verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 18.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
        content = content
    )
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
        Text(JalaliDate.format(state.selectedDate), color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.SemiBold)
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
    ElevatedCard(shape = RoundedCornerShape(20.dp), colors = CardDefaults.elevatedCardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.padding(15.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Top) {
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(booking.name.ifBlank { "مشتری" }, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface, fontSize = 16.sp)
                    Text(booking.service + " · " + JalaliDate.faDigits(booking.durationMinutes.toString()) + " دقیقه", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)
                }
                StatusBadge(booking.status)
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(JalaliDate.format(booking.date), color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)
                Text(JalaliDate.faDigits(booking.time), color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold)
            }
            if (booking.note.isNotBlank()) {
                Text(booking.note, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp)
            }
            if (booking.phone.isNotBlank()) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(booking.phone, color = MaterialTheme.colorScheme.onSurface, fontSize = 13.sp, modifier = Modifier.weight(1f))
                    val context = LocalContext.current
                    OutlinedButton(onClick = {
                        context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + booking.phone)))
                    }, contentPadding = PaddingValues(horizontal = 11.dp, vertical = 5.dp)) {
                        Icon(Icons.Default.Call, null, Modifier.size(15.dp))
                        Spacer(Modifier.width(5.dp))
                        Text("تماس")
                    }
                }
            } else Text("شماره تماس ثبت نشده", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp)
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
        "confirmed" -> "تأییدشده" to Color(0xFF4BE0A5)
        "pending" -> "در انتظار" to Color(0xFFF0C879)
        "completed" -> "انجام‌شده" to Color(0xFF75CDE0)
        "cancelled" -> "لغوشده" to Color(0xFFF08D82)
        "no_show" -> "عدم مراجعه" to Color(0xFFC19CA4)
        else -> status to MaterialTheme.colorScheme.onSurfaceVariant
    }
    Surface(color = color.copy(alpha = .12f), shape = RoundedCornerShape(50)) {
        Text(label, Modifier.padding(horizontal = 10.dp, vertical = 5.dp), color = color, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun CalendarScreen(state: AdminUiState, vm: AdminViewModel) {
    var showBlock by remember { mutableStateOf(false) }
    var showManualBooking by remember { mutableStateOf(false) }
    val selected = runCatching { LocalDate.parse(state.selectedDate) }.getOrDefault(LocalDate.now(ZoneId.of("Asia/Tehran")))
    val days = (0L..6L).map { selected.plusDays(it) }
    val bookingsByDate = state.bookings.groupBy { it.date }

    PageColumn {
        SectionTitle("تقویم رزروها", "نمای هفتگی و برنامه گرافیکی روز")
        Surface(
            color = MaterialTheme.colorScheme.surface,
            shape = RoundedCornerShape(24.dp),
            border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(Modifier.padding(15.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                    Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        Text("هفته جاری", color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        Text(JalaliDate.format(state.selectedDate), color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp)
                    }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        TextButton(onClick = { vm.selectDate(LocalDate.now(ZoneId.of("Asia/Tehran")).toString()) }) {
                            Icon(Icons.Default.Today, null, Modifier.size(17.dp))
                            Spacer(Modifier.width(5.dp))
                            Text("امروز")
                        }
                        IconButton(onClick = { shiftDate(state.selectedDate, -7, vm) }) {
                            Icon(Icons.Default.ChevronRight, null, tint = MaterialTheme.colorScheme.onSurface)
                        }
                        IconButton(onClick = { shiftDate(state.selectedDate, 7, vm) }) {
                            Icon(Icons.Default.ChevronLeft, null, tint = MaterialTheme.colorScheme.onSurface)
                        }
                    }
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                    days.forEach { day ->
                        val dateKey = day.toString()
                        val isSelected = dateKey == state.selectedDate
                        val count = bookingsByDate[dateKey].orEmpty().size
                        Surface(
                            modifier = Modifier.weight(1f).height(82.dp).clickable { vm.selectDate(dateKey) },
                            color = if (isSelected) MaterialTheme.colorScheme.primary.copy(alpha = .16f) else MaterialTheme.colorScheme.surfaceVariant,
                            shape = RoundedCornerShape(15.dp),
                            border = BorderStroke(1.dp, if (isSelected) MaterialTheme.colorScheme.secondary.copy(alpha = .65f) else MaterialTheme.colorScheme.outlineVariant)
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                                Text(persianWeekday(day), color = if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 9.sp)
                                Text(
                                    JalaliDate.format(dateKey).substringBefore(" "),
                                    color = if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 20.sp
                                )
                                Row(horizontalArrangement = Arrangement.spacedBy(3.dp), verticalAlignment = Alignment.CenterVertically) {
                                    repeat(minOf(count, 3)) {
                                        Box(Modifier.size(4.dp).background(if (isSelected) MaterialTheme.colorScheme.secondary else MaterialTheme.colorScheme.primary, CircleShape))
                                    }
                                    if (count > 0) Text(JalaliDate.faDigits(count.toString()), color = if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 9.sp)
                                    else Text("—", color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = .65f), fontSize = 9.sp)
                                }
                            }
                        }
                    }
                }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    CalendarMetric("نوبت امروز", JalaliDate.faDigits((state.dayPlan?.bookings?.size ?: 0).toString()), MaterialTheme.colorScheme.secondary, Modifier.weight(1f))
                    CalendarMetric("زمان مسدود", JalaliDate.faDigits((state.dayPlan?.blocks?.size ?: 0).toString()), MaterialTheme.colorScheme.tertiary, Modifier.weight(1f))
                    CalendarMetric("ساعات کاری", JalaliDate.faDigits((state.dayPlan?.windows?.size ?: 0).toString()), MaterialTheme.colorScheme.primary, Modifier.weight(1f))
                }
            }
        }

        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(
                onClick = { showManualBooking = true },
                modifier = Modifier.weight(1f).height(48.dp),
                shape = RoundedCornerShape(15.dp)
            ) {
                Icon(Icons.Default.Add, null, Modifier.size(18.dp))
                Spacer(Modifier.width(6.dp))
                Text("ثبت نوبت")
            }
            OutlinedButton(
                onClick = { showBlock = true },
                modifier = Modifier.weight(1f).height(48.dp),
                shape = RoundedCornerShape(15.dp),
                border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)
            ) {
                Icon(Icons.Default.Block, null, Modifier.size(18.dp))
                Spacer(Modifier.width(6.dp))
                Text("مسدود کردن زمان")
            }
        }

        val plan = state.dayPlan
        if (plan == null) {
            EmptyPanel("در حال دریافت برنامه روز…", Icons.Default.Schedule)
        } else {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxWidth()
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    Text("خط زمانی روز", color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold, fontSize = 17.sp)
                    Text(JalaliDate.format(plan.date), color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp)
                }
                StatusBadge(if (plan.windows.isEmpty()) "cancelled" else "confirmed")
            }
            Surface(color = MaterialTheme.colorScheme.surface, shape = RoundedCornerShape(20.dp), border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)) {
                Column(Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
                        TimelineLegend(MaterialTheme.colorScheme.secondary, "نوبت تأییدشده", Modifier.weight(1f))
                        TimelineLegend(MaterialTheme.colorScheme.tertiary, "در انتظار", Modifier.weight(1f))
                        TimelineLegend(Color(0xFFF08D82), "مسدودی", Modifier.weight(1f))
                    }
                    InfoPanel(
                        "ساعات کاری",
                        plan.windows.joinToString("  ·  ") { it.startsAt + " تا " + it.endsAt }
                            .ifBlank { "برای این روز ساعت کاری ثبت نشده است." }
                    )
                    if (plan.windows.isEmpty() && plan.bookings.isEmpty() && plan.blocks.isEmpty()) {
                        EmptyPanel("این روز تعطیل است یا بازه کاری برای آن تعریف نشده.", Icons.Default.EventAvailable)
                    } else {
                        DayTimeline(plan)
                    }
                }
            }
            SectionTitle("جزئیات نوبت‌های روز", JalaliDate.faDigits(plan.bookings.size.toString()) + " نوبت")
            if (plan.bookings.isEmpty()) Text("برای این روز نوبتی ثبت نشده است.", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)
            plan.bookings.sortedBy { timeToMinutes(it.time) }.forEach { item ->
                ElevatedCard(shape = RoundedCornerShape(16.dp), colors = CardDefaults.elevatedCardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                    Column(Modifier.padding(13.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Text(item.serviceName, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface, modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
                            StatusBadge(item.status)
                        }
                        Text(JalaliDate.faDigits(item.time + " – " + item.endTime) + "  ·  " + item.name, color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
                        Text(JalaliDate.faDigits(item.durationMinutes.toString()) + " دقیقه", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp)
                        if (item.phone.isNotBlank()) {
                            val context = LocalContext.current
                            TextButton(onClick = { context.startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + item.phone))) }) {
                                Icon(Icons.Default.Call, null, Modifier.size(15.dp))
                                Spacer(Modifier.width(5.dp))
                                Text(item.phone)
                            }
                        }
                    }
                }
            }
            if (plan.blocks.isNotEmpty()) {
                SectionTitle("زمان‌های مسدودشده", JalaliDate.faDigits(plan.blocks.size.toString()) + " بازه")
                plan.blocks.sortedBy { timeToMinutes(it.time) }.forEach { block ->
                    Surface(color = MaterialTheme.colorScheme.surfaceVariant, shape = RoundedCornerShape(14.dp), border = BorderStroke(1.dp, Color(0xFF68403B))) {
                        Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                                Text(JalaliDate.faDigits(block.time + " – " + block.endTime), fontWeight = FontWeight.Bold, color = Color(0xFFFFA59A))
                                Text("مسدودی دستی · " + JalaliDate.faDigits(block.durationMinutes.toString()) + " دقیقه", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp)
                            }
                            TextButton(onClick = { vm.deleteTimeBlock(block) }) { Text("برداشتن", color = Color(0xFFFFA59A)) }
                        }
                    }
                }
            }
        }
    }
    if (showBlock) {
        TimeBlockDialog(
            state.selectedDate,
            onDismiss = { showBlock = false },
            onSave = { date, time, duration -> showBlock = false; vm.createTimeBlock(date, time, duration) }
        )
    }
    if (showManualBooking) {
        ManualBookingDialog(
            services = state.services.filter { it.isActive },
            initialDate = state.selectedDate,
            onDismiss = { showManualBooking = false },
            onSave = { first, last, phone, service, date, time, note ->
                showManualBooking = false
                vm.createManualBooking(first, last, phone, service, date, time, note)
            }
        )
    }
}

@Composable
private fun CalendarMetric(label: String, value: String, accent: Color, modifier: Modifier = Modifier) {
    Surface(modifier = modifier, color = MaterialTheme.colorScheme.surfaceVariant, shape = RoundedCornerShape(13.dp), border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)) {
        Column(Modifier.padding(vertical = 9.dp, horizontal = 7.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(value, color = accent, fontSize = 18.sp, fontWeight = FontWeight.Bold)
            Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 9.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Composable
private fun TimelineLegend(color: Color, text: String, modifier: Modifier = Modifier) {
    Row(modifier = modifier, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
        Box(Modifier.size(7.dp).background(color, CircleShape))
        Text(text, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 9.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
private fun DayTimeline(plan: DayPlan) {
    val starts = buildList {
        plan.windows.forEach { add(timeToMinutes(it.startsAt)) }
        plan.bookings.forEach { add(timeToMinutes(it.time)) }
        plan.blocks.forEach { add(timeToMinutes(it.time)) }
    }
    val ends = buildList {
        plan.windows.forEach { add(timeToMinutes(it.endsAt)) }
        plan.bookings.forEach { add(timeToMinutes(it.endTime)) }
        plan.blocks.forEach { add(timeToMinutes(it.endTime)) }
    }
    val firstHour = ((starts.minOrNull() ?: 9 * 60) / 60).coerceIn(6, 22)
    val lastHour = (((ends.maxOrNull() ?: 18 * 60) + 59) / 60).coerceIn(firstHour + 1, 23)
    val hourHeight = 68.dp
    val minutesToDp = 68f / 60f
    val fullHeight = hourHeight * (lastHour - firstHour)

    Box(Modifier.fillMaxWidth().height(fullHeight)) {
        Column(Modifier.fillMaxSize()) {
            for (hour in firstHour until lastHour) {
                Row(Modifier.fillMaxWidth().height(hourHeight), verticalAlignment = Alignment.Top) {
                    Text(
                        JalaliDate.faDigits("%02d:00".format(hour)),
                        modifier = Modifier.width(49.dp).padding(top = 3.dp),
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        fontSize = 10.sp,
                        textAlign = TextAlign.Start
                    )
                    Box(
                        Modifier.weight(1f).fillMaxHeight()
                            .border(BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant.copy(alpha = .82f)), RoundedCornerShape(8.dp))
                    )
                }
            }
        }
        Box(Modifier.fillMaxSize().padding(start = 49.dp)) {
            plan.bookings.forEach { booking ->
                val startMinute = timeToMinutes(booking.time)
                val endMinute = maxOf(startMinute + 30, timeToMinutes(booking.endTime))
                val y = ((startMinute - firstHour * 60).coerceAtLeast(0) * minutesToDp).dp
                val height = (((endMinute - startMinute).coerceAtLeast(25) * minutesToDp).dp).coerceAtLeast(46.dp)
                val color = when (booking.status) {
                    "pending" -> MaterialTheme.colorScheme.tertiary
                    "confirmed" -> MaterialTheme.colorScheme.secondary
                    "completed" -> Color(0xFF8BB7A4)
                    "cancelled" -> Color(0xFFF08D82)
                    else -> Color(0xFFB69BA4)
                }
                Surface(
                    modifier = Modifier.offset(y = y).fillMaxWidth().padding(end = 3.dp).height(height),
                    color = color.copy(alpha = .16f),
                    shape = RoundedCornerShape(11.dp),
                    border = BorderStroke(1.dp, color.copy(alpha = .65f))
                ) {
                    Column(Modifier.padding(horizontal = 9.dp, vertical = 5.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                        Text(JalaliDate.faDigits(booking.time + " · " + booking.name), color = color, fontSize = 11.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text(booking.serviceName, color = MaterialTheme.colorScheme.onSurface, fontSize = 10.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
            }
            plan.blocks.forEach { block ->
                val startMinute = timeToMinutes(block.time)
                val endMinute = maxOf(startMinute + 20, timeToMinutes(block.endTime))
                val y = ((startMinute - firstHour * 60).coerceAtLeast(0) * minutesToDp).dp
                val height = (((endMinute - startMinute).coerceAtLeast(20) * minutesToDp).dp).coerceAtLeast(42.dp)
                Surface(
                    modifier = Modifier.offset(y = y).fillMaxWidth().padding(end = 3.dp).height(height),
                    color = Color(0xFFF08D82).copy(alpha = .13f),
                    shape = RoundedCornerShape(11.dp),
                    border = BorderStroke(1.dp, Color(0xFFF08D82).copy(alpha = .55f))
                ) {
                    Row(Modifier.fillMaxSize().padding(horizontal = 9.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Block, null, tint = Color(0xFFF08D82), modifier = Modifier.size(15.dp))
                        Spacer(Modifier.width(7.dp))
                        Text("مسدود · " + JalaliDate.faDigits(block.time + "–" + block.endTime), color = Color(0xFFF08D82), fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }
    }
}

private fun timeToMinutes(time: String): Int {
    val parts = time.split(":")
    val hour = parts.getOrNull(0)?.toIntOrNull() ?: 0
    val minute = parts.getOrNull(1)?.toIntOrNull() ?: 0
    return hour.coerceIn(0, 23) * 60 + minute.coerceIn(0, 59)
}

private fun persianWeekday(date: LocalDate): String = when (date.dayOfWeek.value) {
    6 -> "شنبه"
    7 -> "یکشنبه"
    1 -> "دوشنبه"
    2 -> "سه‌شنبه"
    3 -> "چهارشنبه"
    4 -> "پنجشنبه"
    else -> "جمعه"
}

@Composable
private fun TimeBlockDialog(date: String, onDismiss: () -> Unit, onSave: (String, String, Int) -> Unit) {
    val initial = remember(date) { JalaliDate.parts(date) ?: Triple(1405, 1, 1) }
    var year by remember(date) { mutableIntStateOf(initial.first) }
    var month by remember(date) { mutableIntStateOf(initial.second) }
    var selectedDay by remember(date) { mutableIntStateOf(initial.third) }
    var time by remember { mutableStateOf("10:00") }
    var duration by remember { mutableStateOf("30") }
    val monthNames = listOf("فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند")
    val monthLength = JalaliDate.monthLength(year, month)
    val firstIso = JalaliDate.toGregorian(year, month, 1)
    val leading = firstIso?.let { (java.time.LocalDate.parse(it).dayOfWeek.value + 1) % 7 } ?: 0
    val days = (1..monthLength).toList()
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("مسدود کردن زمان") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Surface(color = MaterialTheme.colorScheme.surfaceVariant, shape = RoundedCornerShape(16.dp), border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant)) {
                    Column(Modifier.fillMaxWidth().padding(10.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
                            IconButton(onClick = {
                                if (month == 1) { month = 12; year-- } else month--
                                selectedDay = selectedDay.coerceAtMost(JalaliDate.monthLength(year, month))
                            }) { Icon(Icons.Default.ChevronRight, "ماه قبل", tint = MaterialTheme.colorScheme.secondary) }
                            Text(monthNames[month - 1] + " " + JalaliDate.faDigits(year.toString()), color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold)
                            IconButton(onClick = {
                                if (month == 12) { month = 1; year++ } else month++
                                selectedDay = selectedDay.coerceAtMost(JalaliDate.monthLength(year, month))
                            }) { Icon(Icons.Default.ChevronLeft, "ماه بعد", tint = MaterialTheme.colorScheme.secondary) }
                        }
                        Row(Modifier.fillMaxWidth()) {
                            listOf("ش", "ی", "د", "س", "چ", "پ", "ج").forEach { label ->
                                Text(label, Modifier.weight(1f), color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center, fontSize = 11.sp)
                            }
                        }
                        val cells = List(leading) { 0 } + days
                        cells.chunked(7).forEach { week ->
                            Row(Modifier.fillMaxWidth()) {
                                week.forEach { value ->
                                    if (value == 0) {
                                        Box(Modifier.weight(1f).height(36.dp))
                                    } else {
                                        val selected = value == selectedDay
                                        TextButton(
                                            onClick = { selectedDay = value },
                                            modifier = Modifier.weight(1f).height(36.dp),
                                            contentPadding = PaddingValues(0.dp),
                                            colors = ButtonDefaults.textButtonColors(
                                                containerColor = if (selected) MaterialTheme.colorScheme.primary else Color.Transparent,
                                                contentColor = if (selected) Color(0xFF06130E) else MaterialTheme.colorScheme.onSurface
                                            )
                                        ) { Text(JalaliDate.faDigits(value.toString()), fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal) }
                                    }
                                }
                                repeat(7 - week.size) { Box(Modifier.weight(1f).height(36.dp)) }
                            }
                        }
                    }
                }
                Text("تاریخ انتخاب‌شده: " + JalaliDate.faDigits("$year/$month/$selectedDay"), color = MaterialTheme.colorScheme.secondary, fontSize = 12.sp)
                OutlinedTextField(time, { time = it }, label = { Text("ساعت ۲۴ ساعته") }, singleLine = true)
                OutlinedTextField(duration, { duration = it.filter(Char::isDigit) }, label = { Text("مدت به دقیقه") }, singleLine = true)
            }
        },
        confirmButton = {
            Button(onClick = {
                val iso = JalaliDate.toGregorian(year, month, selectedDay)
                if (iso != null && time.matches(Regex("^([01]?[0-9]|2[0-3]):[0-5][0-9]$")) && (duration.toIntOrNull() ?: 0) > 0) {
                    onSave(iso, time.padStart(5, '0'), duration.toInt())
                }
            }) { Text("ثبت مسدودی") }
        },
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
            ElevatedCard(shape = RoundedCornerShape(18.dp), colors = CardDefaults.elevatedCardColors(containerColor = MaterialTheme.colorScheme.surface)) {
                Row(Modifier.fillMaxWidth().padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(service.name, color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold)
                        Text(service.category + " · " + service.durationMinutes + " دقیقه", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp)
                        Text(if (service.priceAmount > 0) JalaliDate.faDigits(service.priceAmount.toString()) + " " + service.priceCurrency else "قیمت توافقی", color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
                    }
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Switch(checked = service.isActive, onCheckedChange = { vm.toggleService(service) })
                        IconButton(onClick = { selected = service; creating = true }) { Icon(Icons.Default.Edit, null, tint = MaterialTheme.colorScheme.onSurface) }
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
        Card(shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
            Column(Modifier.padding(15.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text("قوانین رزرو", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
                        Text("فاصله نوبت، مهلت و بازه مجاز رزرو", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp)
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
            Surface(color = MaterialTheme.colorScheme.surface, shape = RoundedCornerShape(15.dp), modifier = Modifier.fillMaxWidth().clickable { editingDay = day }) {
                Row(Modifier.padding(horizontal = 14.dp, vertical = 13.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(day.name, fontWeight = FontWeight.SemiBold)
                        Text(if (day.isClosed) "تعطیل" else day.intervals.joinToString(" · ") { it.startsAt + " تا " + it.endsAt }, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp)
                    }
                    Icon(Icons.Default.Edit, null, tint = MaterialTheme.colorScheme.onSurface)
                }
            }
        }
        SectionTitle("تعطیلی‌ها و تغییرات ویژه", action = {
            FilledIconButton(onClick = { showException = true }) { Icon(Icons.Default.Add, null) }
        })
        if (state.exceptions.isEmpty()) Text("تغییر ویژه‌ای ثبت نشده است.", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)
        state.exceptions.forEach { exception ->
            Surface(color = MaterialTheme.colorScheme.surface, shape = RoundedCornerShape(14.dp)) {
                Row(Modifier.fillMaxWidth().padding(13.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(JalaliDate.format(exception.date), fontWeight = FontWeight.Bold)
                        Text(if (exception.isClosed) "تعطیل" else exception.intervals.joinToString(" · ") { it.startsAt + " تا " + it.endsAt }, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp)
                        if (exception.note.isNotBlank()) Text(exception.note, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp)
                    }
                    IconButton(onClick = { vm.deleteException(exception) }) { Icon(Icons.Default.Delete, null, tint = Color(0xFFF08D82)) }
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
        Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 12.sp)
        Text(value, color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.SemiBold, fontSize = 12.sp)
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
private fun SettingsScreen(state: AdminUiState, vm: AdminViewModel, hasSavedCredentials: Boolean, onClearSavedCredentials: () -> Unit, themeMode: String, onThemeModeChange: (String) -> Unit) {
    var email by remember(state.notices) { mutableStateOf(state.notices.emailEnabled) }
    var project by remember(state.notices) { mutableStateOf(state.notices.firebaseProjectId) }
    val context = LocalContext.current
    PageColumn {
        SectionTitle("اعلان‌ها و تنظیمات", "دریافت اعلان بومی روی گوشی مدیر")
        ElevatedCard(shape = RoundedCornerShape(20.dp), colors = CardDefaults.elevatedCardColors(containerColor = MaterialTheme.colorScheme.surface)) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("ظاهر برنامه", color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold)
                Text("حالت رنگی را انتخاب کن؛ حالت خودکار از تنظیمات نمایش گوشی پیروی می‌کند.", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp, lineHeight = 17.sp)
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                    listOf("SYSTEM" to "خودکار", "LIGHT" to "روز", "DARK" to "شب").forEach { (mode, label) ->
                        FilterChip(
                            selected = themeMode == mode,
                            onClick = { onThemeModeChange(mode) },
                            label = { Text(label) },
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
            }
        }
        ElevatedCard(shape = RoundedCornerShape(20.dp), colors = CardDefaults.elevatedCardColors(containerColor = MaterialTheme.colorScheme.surface)) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(11.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.NotificationsActive, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(28.dp))
                    Spacer(Modifier.width(10.dp))
                    Column(Modifier.weight(1f)) {
                        Text("اعلان‌های اندروید", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onSurface)
                        Text(if (state.notices.pushReady) "اتصال سرور آماده است" else "برای فعال‌سازی، دستگاه را ثبت کنید", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp)
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
        ElevatedCard(shape = RoundedCornerShape(20.dp), colors = CardDefaults.elevatedCardColors(containerColor = MaterialTheme.colorScheme.surface)) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Fingerprint, null, tint = MaterialTheme.colorScheme.secondary, modifier = Modifier.size(27.dp))
                    Spacer(Modifier.width(10.dp))
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        Text("ورود سریع با اثر انگشت", color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold)
                        Text(
                            if (hasSavedCredentials) "نام کاربری و گذرواژه به‌صورت رمزنگاری‌شده روی این دستگاه ذخیره شده‌اند."
                            else "در ورود بعدی، گزینه ذخیره با اثر انگشت را فعال کن.",
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            fontSize = 11.sp,
                            lineHeight = 16.sp
                        )
                    }
                    StatusBadge(if (hasSavedCredentials) "confirmed" else "pending")
                }
                if (hasSavedCredentials) {
                    OutlinedButton(
                        onClick = onClearSavedCredentials,
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFFF08D82)),
                        border = BorderStroke(1.dp, Color(0xFFF08D82).copy(alpha = .5f))
                    ) {
                        Icon(Icons.Default.Delete, null)
                        Spacer(Modifier.width(7.dp))
                        Text("حذف اطلاعات ورود ذخیره‌شده")
                    }
                }
            }
        }
        ElevatedCard(shape = RoundedCornerShape(20.dp), colors = CardDefaults.elevatedCardColors(containerColor = MaterialTheme.colorScheme.surface)) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("ترجیحات", color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold)
                Row(verticalAlignment = Alignment.CenterVertically) { Text("اعلان ایمیلی", Modifier.weight(1f)); Switch(email, { email = it }) }
                OutlinedTextField(project, { project = it }, label = { Text("شناسه پروژه Firebase") }, modifier = Modifier.fillMaxWidth(), singleLine = true)
                Button(onClick = { vm.saveNotifications(state.notices.copy(emailEnabled = email, firebaseProjectId = project)) }, modifier = Modifier.fillMaxWidth()) { Text("ذخیره ترجیحات") }
            }
        }
        InfoPanel("حساب مدیر", "ورود با همان حساب پنل فعلی. نشست ورود روی دستگاه به‌صورت رمزگذاری‌شده نگهداری می‌شود.")
        OutlinedButton(onClick = vm::logout, modifier = Modifier.fillMaxWidth(), colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFF9D5047))) { Icon(Icons.Default.Close, null); Spacer(Modifier.width(7.dp)); Text("خروج از حساب") }
        Text("نسخه ۱.۱.۰ · ساخته‌شده توسط Pooya Labs", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 10.sp, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
    }
}

@Composable
private fun InfoPanel(title: String, body: String) {
    Surface(color = MaterialTheme.colorScheme.surfaceVariant, shape = RoundedCornerShape(16.dp), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Text(title, color = MaterialTheme.colorScheme.onSurface, fontWeight = FontWeight.Bold, fontSize = 13.sp)
            Text(body, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 11.sp, lineHeight = 17.sp)
        }
    }
}

@Composable
private fun EmptyPanel(message: String, icon: androidx.compose.ui.graphics.vector.ImageVector) {
    Surface(color = MaterialTheme.colorScheme.surface, shape = RoundedCornerShape(20.dp), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.fillMaxWidth().padding(28.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Icon(icon, null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(34.dp))
            Text(message, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center, fontSize = 13.sp)
        }
    }
}
