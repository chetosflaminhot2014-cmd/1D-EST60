package mx.est60.grupo1d

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class SchoolFirebaseMessagingService : FirebaseMessagingService() {
    override fun onMessageReceived(message: RemoteMessage) {
        val title = message.notification?.title
            ?: message.data["title"]
            ?: "Aviso de 1°D EST60"
        val body = message.notification?.body
            ?: message.data["body"]
            ?: message.data["message"]
            ?: "Hay una nueva actualización escolar."

        showNotification(title, body)
    }

    private fun showNotification(title: String, body: String) {
        val channelId = "avisos_1d_est60"
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                channelId,
                "Avisos de 1°D EST60",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "Tareas, avisos y novedades del grupo"
            }
            manager.createNotificationChannel(channel)
        }

        val openAppIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(applicationInfo.icon)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .build()

        manager.notify((System.currentTimeMillis() % Int.MAX_VALUE).toInt(), notification)
    }
}
