package com.pooyalabs.salonmanager

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.widget.Toast
import androidx.activity.compose.setContent
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.LayoutDirection
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.viewmodel.compose.viewModel
import javax.crypto.Cipher

private val Background = Color(0xFF080A10)
private val Panel = Color(0xFF141923)
private val TextPrimary = Color(0xFFF4F6FA)
private val Mint = Color(0xFF25E6C8)
private val Cyan = Color(0xFF39D9F2)
private val Muted = Color(0xFF929BAA)
private val Danger = Color(0xFFF08D82)

class MainActivity : FragmentActivity() {
    private var activeBiometricPrompt: BiometricPrompt? = null

    private fun authenticateWithBiometric(
        cipher: Cipher,
        onAuthenticated: (Cipher) -> Unit,
        onError: (String) -> Unit
    ) {
        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle("ورود امن پویا لبز")
            .setSubtitle("برای ادامه، اثر انگشت خود را تأیید کن")
            .setNegativeButtonText("انصراف")
            .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
            .build()

        activeBiometricPrompt = BiometricPrompt(
            this,
            ContextCompat.getMainExecutor(this),
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    val authenticatedCipher = result.cryptoObject?.cipher
                    if (authenticatedCipher == null) {
                        onError("احراز هویت امن کامل نشد؛ دوباره تلاش کن.")
                    } else {
                        onAuthenticated(authenticatedCipher)
                    }
                    activeBiometricPrompt = null
                }

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    onError(errString.toString())
                    activeBiometricPrompt = null
                }
            }
        )
        activeBiometricPrompt?.authenticate(promptInfo, BiometricPrompt.CryptoObject(cipher))
    }

    override fun onDestroy() {
        activeBiometricPrompt = null
        super.onDestroy()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = android.graphics.Color.rgb(8, 10, 16)
        window.navigationBarColor = android.graphics.Color.rgb(8, 10, 16)
        SalonNotifications.ensureChannel(this)

        setContent {
            val context = LocalContext.current
            val credentialVault = remember { CredentialVault(applicationContext) }
            var hasSavedCredentials by remember { mutableStateOf(runCatching { credentialVault.hasSavedCredentials() }.getOrDefault(false)) }
            var pendingCredentials by remember { mutableStateOf<SavedOwnerCredentials?>(null) }
            var awaitingBiometricServerLogin by remember { mutableStateOf(false) }
            val biometricAvailable = remember(hasSavedCredentials) {
                hasSavedCredentials && runCatching { credentialVault.isBiometricAvailable() }.getOrDefault(false)
            }

            LaunchedEffect(Unit) {
                if (Build.VERSION.SDK_INT >= 33 &&
                    ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
                ) {
                    ActivityCompat.requestPermissions(
                        this@MainActivity,
                        arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                        1001
                    )
                }
            }

            val vm: AdminViewModel = viewModel()
            val state by vm.state.collectAsState()

            LaunchedEffect(state.error) {
                if (state.error.isNotBlank()) {
                    if (pendingCredentials != null) pendingCredentials = null
                    if (awaitingBiometricServerLogin) {
                        awaitingBiometricServerLogin = false
                        credentialVault.clear()
                        hasSavedCredentials = false
                        Toast.makeText(
                            context,
                            "ورود ذخیره‌شده معتبر نبود؛ یک‌بار با نام کاربری و گذرواژه وارد شو.",
                            Toast.LENGTH_LONG
                        ).show()
                    }
                }
            }

            LaunchedEffect(state.signedIn) {
                if (state.signedIn) awaitingBiometricServerLogin = false
            }

            LaunchedEffect(state.signedIn, pendingCredentials) {
                val toSave = pendingCredentials
                if (state.signedIn && toSave != null) {
                    pendingCredentials = null
                    try {
                        val cipher = credentialVault.newEncryptionCipher()
                        authenticateWithBiometric(
                            cipher,
                            onAuthenticated = { authenticatedCipher ->
                                runCatching {
                                    credentialVault.storeAuthenticated(authenticatedCipher, toSave)
                                }.onSuccess {
                                    hasSavedCredentials = true
                                    Toast.makeText(context, "ورود سریع با اثر انگشت فعال شد.", Toast.LENGTH_LONG).show()
                                }.onFailure {
                                    Toast.makeText(context, "ذخیره امن ورود انجام نشد؛ بعداً دوباره تلاش کن.", Toast.LENGTH_LONG).show()
                                }
                            },
                            onError = {
                                Toast.makeText(context, "ورود انجام شد؛ ذخیره با اثر انگشت لغو شد.", Toast.LENGTH_SHORT).show()
                            }
                        )
                    } catch (_: Exception) {
                        Toast.makeText(
                            context,
                            "برای ذخیره ورود، ابتدا اثر انگشت را در تنظیمات گوشی فعال کن.",
                            Toast.LENGTH_LONG
                        ).show()
                    }
                }
            }

            CompositionLocalProvider(androidx.compose.ui.platform.LocalLayoutDirection provides LayoutDirection.Rtl) {
                MaterialTheme(
                    colorScheme = darkColorScheme(
                        primary = Mint,
                        onPrimary = Color(0xFF06130E),
                        secondary = Cyan,
                        onSecondary = Color(0xFF071311),
                        background = Background,
                        onBackground = TextPrimary,
                        surface = Panel,
                        onSurface = TextPrimary,
                        surfaceVariant = Color(0xFF202A38),
                        onSurfaceVariant = Muted,
                        tertiary = Color(0xFFF0C879),
                        error = Danger,
                        onError = Color(0xFF250C08)
                    )
                ) {
                    when {
                        state.checkingSession -> LoadingScreen()
                        !state.signedIn -> LoginScreen(
                            state = state,
                            hasSavedCredentials = hasSavedCredentials && biometricAvailable,
                            onLogin = { username, password, remember ->
                                if (remember) {
                                    val canSaveWithBiometric = runCatching {
                                        credentialVault.isBiometricAvailable()
                                    }.getOrDefault(false)
                                    if (canSaveWithBiometric) {
                                        pendingCredentials = SavedOwnerCredentials(username.trim(), password)
                                    } else {
                                        pendingCredentials = null
                                        Toast.makeText(
                                            context,
                                            "اثر انگشت در دسترس نیست؛ ورود عادی انجام می‌شود.",
                                            Toast.LENGTH_LONG
                                        ).show()
                                    }
                                } else {
                                    pendingCredentials = null
                                    credentialVault.clear()
                                    hasSavedCredentials = false
                                }
                                vm.login(username, password)
                            },
                            onBiometricLogin = {
                                try {
                                    val cipher = credentialVault.newDecryptionCipher()
                                    authenticateWithBiometric(
                                        cipher,
                                        onAuthenticated = { authenticatedCipher ->
                                            runCatching {
                                                credentialVault.readAuthenticated(authenticatedCipher)
                                            }.onSuccess { saved ->
                                                awaitingBiometricServerLogin = true
                                                vm.login(saved.username, saved.password)
                                            }.onFailure {
                                                credentialVault.clear()
                                                hasSavedCredentials = false
                                                Toast.makeText(
                                                    context,
                                                    "اطلاعات ورود ذخیره‌شده قابل بازیابی نیست؛ دستی وارد شو.",
                                                    Toast.LENGTH_LONG
                                                ).show()
                                            }
                                        },
                                        onError = { }
                                    )
                                } catch (_: Exception) {
                                    credentialVault.clear()
                                    hasSavedCredentials = false
                                    Toast.makeText(
                                        context,
                                        "اثر انگشت یا کلید امن تغییر کرده است؛ یک‌بار دستی وارد شو.",
                                        Toast.LENGTH_LONG
                                    ).show()
                                }
                            }
                        )
                        else -> AdminHome(
                            state = state,
                            vm = vm,
                            hasSavedCredentials = hasSavedCredentials,
                            onClearSavedCredentials = {
                                credentialVault.clear()
                                hasSavedCredentials = false
                                Toast.makeText(context, "اطلاعات ورود ذخیره‌شده حذف شد.", Toast.LENGTH_SHORT).show()
                            }
                        )
                    }
                }
            }
        }
    }
}
