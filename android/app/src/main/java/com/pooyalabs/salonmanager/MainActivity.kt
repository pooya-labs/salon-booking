package com.pooyalabs.salonmanager

import android.Manifest
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.LayoutDirection
import androidx.core.content.ContextCompat
import android.content.pm.PackageManager
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.ui.graphics.Color

private val Forest = Color(0xFF173D32)
private val Emerald = Color(0xFF2D725A)
private val Cream = Color(0xFFF5F3EC)
private val Ink = Color(0xFF1E2924)
private val Muted = Color(0xFF77817A)
private val Gold = Color(0xFFC29A56)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        SalonNotifications.ensureChannel(this)
        setContent {
            val context = LocalContext.current
            val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { }
            LaunchedEffect(Unit) {
                if (Build.VERSION.SDK_INT >= 33 &&
                    ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
                ) {
                    permissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                }
            }
            val vm: AdminViewModel = viewModel()
            val state by vm.state.collectAsState()
            CompositionLocalProvider(androidx.compose.ui.platform.LocalLayoutDirection provides LayoutDirection.Rtl) {
                MaterialTheme(
                    colorScheme = lightColorScheme(
                        primary = Forest,
                        onPrimary = Color.White,
                        secondary = Emerald,
                        onSecondary = Color.White,
                        background = Cream,
                        onBackground = Ink,
                        surface = Color.White,
                        onSurface = Ink,
                        surfaceVariant = Color(0xFFE9EDE7),
                        onSurfaceVariant = Muted,
                        tertiary = Gold
                    )
                ) {
                    when {
                        state.checkingSession -> LoadingScreen()
                        !state.signedIn -> LoginScreen(state = state, onLogin = vm::login)
                        else -> AdminHome(state = state, vm = vm)
                    }
                }
            }
        }
    }
}
