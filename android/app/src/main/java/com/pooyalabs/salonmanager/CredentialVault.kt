package com.pooyalabs.salonmanager

import android.content.Context
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import androidx.biometric.BiometricManager
import org.json.JSONObject
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

data class SavedOwnerCredentials(val username: String, val password: String)

/**
 * Stores manager credentials as AES-GCM ciphertext using a non-exportable
 * Android Keystore key that requires strong biometric authentication per use.
 */
class CredentialVault(context: Context) {
    private val appContext = context.applicationContext
    private val preferences = appContext.getSharedPreferences("owner_biometric_credentials_v1", Context.MODE_PRIVATE)
    private val keyAlias = "salon_manager_biometric_credentials_key"
    private val storageKey = "encrypted_credentials"

    fun hasSavedCredentials(): Boolean = !preferences.getString(storageKey, null).isNullOrBlank()

    fun isBiometricAvailable(): Boolean =
        BiometricManager.from(appContext).canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG) ==
            BiometricManager.BIOMETRIC_SUCCESS

    fun newEncryptionCipher(): Cipher {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, secretKey())
        return cipher
    }

    fun newDecryptionCipher(): Cipher {
        val packed = Base64.decode(
            preferences.getString(storageKey, null) ?: throw IllegalStateException("اطلاعات ورود ذخیره نشده است."),
            Base64.NO_WRAP
        )
        if (packed.size < 13) throw IllegalStateException("اطلاعات ورود ذخیره‌شده معتبر نیست.")
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.DECRYPT_MODE, secretKey(), GCMParameterSpec(128, packed.copyOfRange(0, 12)))
        return cipher
    }

    fun storeAuthenticated(cipher: Cipher, credentials: SavedOwnerCredentials) {
        val payload = JSONObject()
            .put("username", credentials.username)
            .put("password", credentials.password)
            .toString()
            .toByteArray(Charsets.UTF_8)
        val encrypted = cipher.doFinal(payload)
        preferences.edit()
            .putString(storageKey, Base64.encodeToString(cipher.iv + encrypted, Base64.NO_WRAP))
            .apply()
    }

    fun readAuthenticated(cipher: Cipher): SavedOwnerCredentials {
        val packed = Base64.decode(
            preferences.getString(storageKey, null) ?: throw IllegalStateException("اطلاعات ورود ذخیره نشده است."),
            Base64.NO_WRAP
        )
        if (packed.size < 13) throw IllegalStateException("اطلاعات ورود ذخیره‌شده معتبر نیست.")
        val clear = cipher.doFinal(packed.copyOfRange(12, packed.size)).toString(Charsets.UTF_8)
        val json = JSONObject(clear)
        val username = json.optString("username")
        val password = json.optString("password")
        if (username.isBlank() || password.isBlank()) throw IllegalStateException("اطلاعات ورود ذخیره‌شده ناقص است.")
        return SavedOwnerCredentials(username, password)
    }

    fun clear() {
        preferences.edit().remove(storageKey).apply()
        runCatching {
            KeyStore.getInstance("AndroidKeyStore").apply { load(null) }.deleteEntry(keyAlias)
        }
    }

    private fun secretKey(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey(keyAlias, null) as? SecretKey)?.let { return it }

        val builder = KeyGenParameterSpec.Builder(
            keyAlias,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setRandomizedEncryptionRequired(true)
            .setUserAuthenticationRequired(true)
            .setInvalidatedByBiometricEnrollment(true)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            builder.setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG)
        } else {
            @Suppress("DEPRECATION")
            builder.setUserAuthenticationValidityDurationSeconds(-1)
        }

        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        generator.init(builder.build())
        return generator.generateKey()
    }
}
