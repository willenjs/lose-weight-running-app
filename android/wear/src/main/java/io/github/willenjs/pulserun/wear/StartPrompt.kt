package io.github.willenjs.pulserun.wear

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat

/** "Workout started - tap to open", with a buzz, when the watch cannot start its service on its own. */
object StartPrompt {
    private const val CHANNEL_ID = "start"
    private const val NOTIFICATION_ID = 2

    fun show(context: Context, title: String) {
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(NotificationChannel(CHANNEL_ID, "PulseRun", NotificationManager.IMPORTANCE_HIGH))
        val open = PendingIntent.getActivity(
            context, 0, Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle("PulseRun")
            .setContentText(title)
            .setContentIntent(open)
            .setAutoCancel(true)
            .setCategory(NotificationCompat.CATEGORY_WORKOUT)
            .build()
        manager.notify(NOTIFICATION_ID, notification)
    }

    fun hide(context: Context) {
        context.getSystemService(NotificationManager::class.java).cancel(NOTIFICATION_ID)
    }
}
