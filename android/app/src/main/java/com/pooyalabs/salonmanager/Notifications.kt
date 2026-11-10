package com.pooyalabs.salonmanager

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.BitmapFactory
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

object SalonNotifications {
    const val CHANNEL_ID = "booking_alerts_v1"

    fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (manager.getNotificationChannel(CHANNEL_ID) != null) return
        val channel = NotificationChannel(CHANNEL_ID, "نوبت‌های جدید سالن", NotificationManager.IMPORTANCE_HIGH).apply {
            description = "اعلان فوری نوبت‌های جدید و تغییرات رزرو"
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 450, 180, 450, 180, 750)
            setSound(Settings.System.DEFAULT_NOTIFICATION_URI, null)
            lockscreenVisibility = android.app.Notification.VISIBILITY_PRIVATE
            setShowBadge(true)
        }
        manager.createNotificationChannel(channel)
    }

    fun show(context: Context, title: String, message: String, tag: String = "booking") {
        ensureChannel(context)
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val pendingIntent = PendingIntent.getActivity(context, 81, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_salon_notification)
            .setLargeIcon(BitmapFactory.decodeResource(context.resources, R.drawable.pooya_monogram))
            .setContentTitle(title.ifBlank { "نوبت جدید سالن" })
            .setContentText(message)
            .setStyle(NotificationCompat.BigTextStyle().bigText(message))
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_EVENT)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setVibrate(longArrayOf(0, 450, 180, 450, 180, 750))
            .build()
        runCatching { NotificationManagerCompat.from(context).notify(tag.hashCode(), notification) }
    }

    fun openChannelSettings(context: Context) {
        ensureChannel(context)
        val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS)
                .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
                .putExtra(Settings.EXTRA_CHANNEL_ID, CHANNEL_ID)
        } else {
            Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
        }
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
    }

    fun localTest(context: Context) {
        show(context, "آزمایش صدای اعلان", "صدای این پیام از کانال اعلان اندروید تنظیم می‌شود.", "local-test-" + System.currentTimeMillis())
    }
}
