package com.pooyalabs.salonmanager

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.json.JSONObject

class SalonMessagingService : FirebaseMessagingService() {
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        // Render first. Do not wait for a server round-trip in the FCM callback.
        val data = message.data
        val title = data["title"] ?: message.notification?.title ?: "نوبت جدید سالن"
        val body = data["body"] ?: message.notification?.body ?: "یک نوبت جدید ثبت شد."
        val tag = data["tag"] ?: "booking-" + System.currentTimeMillis()
        SalonNotifications.show(applicationContext, title, body, tag)
    }

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        val session = SessionVault(applicationContext).readSessionId() ?: return
        serviceScope.launch {
            runCatching {
                SalonApi().post(session, "/api/admin/push-subscriptions", JSONObject()
                    .put("token", token)
                    .put("device", "Android · " + android.os.Build.MODEL.take(55)))
            }
        }
    }

}
