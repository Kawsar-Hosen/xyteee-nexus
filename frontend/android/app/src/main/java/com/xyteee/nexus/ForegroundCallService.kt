package com.xyteee.nexus

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager

/**
 * Foreground service that keeps the app process (and the WebRTC media
 * session) alive while a voice/video call is active, even when the app is
 * backgrounded. It shows a persistent "ongoing call" notification and holds a
 * partial wake lock so the CPU/network keep running.
 *
 * On Android 10+ the service is started with the appropriate foreground
 * service types (mediaPlayback for voice; mediaPlayback|camera|microphone for
 * video) so it is not killed by the system while the call runs.
 */
class ForegroundCallService : Service() {

    companion object {
        private const val CHANNEL_ID = "call_foreground"
        private const val NOTIFICATION_ID = 9201
        private const val EXTRA_MEDIA = "media" // "voice" | "video"
        private const val EXTRA_TITLE = "title"
        private const val EXTRA_SUBTITLE = "subtitle"

        fun start(context: Context, media: String, title: String, subtitle: String) {
            val intent = buildIntent(context, media, title, subtitle)
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(intent)
                } else {
                    context.startService(intent)
                }
            } catch (_: Exception) {
                // Background-start restrictions (Android 12+) or similar — the
                // call keeps working in the foreground either way.
            }
        }

        fun stop(context: Context) {
            try {
                context.stopService(buildIntent(context, "voice", "", ""))
            } catch (_: Exception) {
            }
        }

        private fun buildIntent(context: Context, media: String, title: String, subtitle: String): Intent =
            Intent(context, ForegroundCallService::class.java)
                .putExtra(EXTRA_MEDIA, media)
                .putExtra(EXTRA_TITLE, title)
                .putExtra(EXTRA_SUBTITLE, subtitle)
    }

    private var wakeLock: PowerManager.WakeLock? = null
    private var isForeground = false

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val media = intent?.getStringExtra(EXTRA_MEDIA) ?: "voice"
        val title = intent?.getStringExtra(EXTRA_TITLE) ?: "Nexus call"
        val subtitle = intent?.getStringExtra(EXTRA_SUBTITLE) ?: "Ongoing call…"

        createChannel()
        val notification = buildNotification(title, subtitle)
        promoteToForeground(notification, media)
        acquireWakeLock()

        // Refresh the visible notification text when the call is already running.
        if (isForeground) {
            try {
                val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                nm.notify(NOTIFICATION_ID, notification)
            } catch (_: Exception) {
            }
        }

        return START_NOT_STICKY
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Ongoing calls",
            NotificationManager.IMPORTANCE_LOW
        )
        channel.setShowBadge(false)
        nm.createNotificationChannel(channel)
    }

    private fun buildNotification(title: String, subtitle: String): Notification {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        val contentIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val builder =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Notification.Builder(this, CHANNEL_ID)
            } else {
                @Suppress("DEPRECATION")
                Notification.Builder(this)
            }

        return builder
            .setContentTitle(title)
            .setContentText(subtitle)
            .setSmallIcon(R.drawable.notification_icon)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(Notification.CATEGORY_CALL)
            .setContentIntent(contentIntent)
            .build()
    }

    private fun promoteToForeground(notification: Notification, media: String) {
        if (isForeground) return
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val type =
                    if (media == "video") {
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK or
                            ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA or
                            ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
                    } else {
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
                    }
                startForeground(NOTIFICATION_ID, notification, type)
            } else {
                startForeground(NOTIFICATION_ID, notification)
            }
            isForeground = true
        } catch (security: SecurityException) {
            // A foreground-service type permission is missing on this device —
            // fall back to a plain foreground service so the call still survives
            // in the background.
            try {
                startForeground(NOTIFICATION_ID, notification)
                isForeground = true
            } catch (_: Exception) {
            }
        } catch (_: Exception) {
        }
    }

    private fun acquireWakeLock() {
        if (wakeLock?.isHeld == true) return
        try {
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "nexus:call").apply {
                setReferenceCounted(false)
                acquire()
            }
        } catch (_: Exception) {
        }
    }

    private fun releaseWakeLock() {
        try {
            wakeLock?.takeIf { it.isHeld }?.release()
        } catch (_: Exception) {
        }
        wakeLock = null
    }

    override fun onDestroy() {
        releaseWakeLock()
        if (isForeground) {
            try {
                stopForeground(true)
            } catch (_: Exception) {
            }
            isForeground = false
        }
        super.onDestroy()
    }
}
