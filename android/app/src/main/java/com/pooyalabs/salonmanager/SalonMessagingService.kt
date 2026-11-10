package com.pooyalabs.salonmanager

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class SalonMessagingService : FirebaseMessagingService() {
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
        // Persist the reconciliation attempt; retry if connectivity or Apps Script is temporarily unavailable.
        PushTokenSyncWorker.enqueue(applicationContext, token)
    }

}
