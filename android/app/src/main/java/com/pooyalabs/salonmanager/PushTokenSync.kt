package com.pooyalabs.salonmanager

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import androidx.work.workDataOf
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/** Enqueues a durable token reconciliation when Android reports that the device has booted. */
class PushBootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action == Intent.ACTION_BOOT_COMPLETED) {
            PushTokenSyncWorker.enqueue(context.applicationContext)
        }
    }
}

/**
 * Keeps the server-side FCM subscription in sync without requiring the manager to open the UI.
 * WorkManager persists the request across process death/reboot and retries transient failures.
 */
class PushTokenSyncWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        // A logged-out device should not keep an owner push subscription.
        val session = runCatching { SessionVault(applicationContext).readSessionId() }.getOrNull()
            ?: return Result.success()

        return try {
            val suppliedToken = inputData.getString(KEY_TOKEN).orEmpty()
            val token = suppliedToken.ifBlank { FirebaseMessaging.getInstance().token.await() }
            if (token.isBlank()) return Result.retry()

            withContext(Dispatchers.IO) {
                SalonApi().post(
                    session,
                    "/api/admin/push-subscriptions",
                    JSONObject()
                        .put("token", token)
                        .put("device", "Android · " + android.os.Build.MODEL.take(55))
                )
            }
            Result.success()
        } catch (error: ApiException) {
            if (error.status in 400..499) Result.failure() else Result.retry()
        } catch (_: Exception) {
            Result.retry()
        }
    }

    companion object {
        private const val KEY_TOKEN = "fcm_token"
        private const val UNIQUE_WORK_NAME = "salon-fcm-token-sync"

        fun enqueue(context: Context, token: String? = null) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()
            val request = OneTimeWorkRequestBuilder<PushTokenSyncWorker>()
                .setInputData(workDataOf(KEY_TOKEN to token.orEmpty()))
                .setConstraints(constraints)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.SECONDS)
                .build()

            WorkManager.getInstance(context.applicationContext).enqueueUniqueWork(
                UNIQUE_WORK_NAME,
                ExistingWorkPolicy.REPLACE,
                request
            )
        }
    }
}
