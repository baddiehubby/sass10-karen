package com.buddieai.shadow.companion

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import com.buddieai.shadow.MainActivity
import com.buddieai.shadow.R
import com.buddieai.shadow.auth.MobileApiError
import com.buddieai.shadow.auth.MobileApiException
import com.buddieai.shadow.auth.NativeAuthRepository
import com.buddieai.shadow.security.DeviceKeyManager
import com.buddieai.shadow.security.KeystoreSecureStorage
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong

class CompanionService : Service() {
    private val mainHandler = Handler(Looper.getMainLooper())
    private val scheduler = Executors.newSingleThreadScheduledExecutor()
    private lateinit var preferences: CompanionPreferences
    private lateinit var overlay: OverlayController
    private lateinit var auth: NativeAuthRepository
    private var intentionalStop = false
    private var refreshScheduled = false
    private val lifecycleGeneration = AtomicLong()

    override fun onCreate() {
        super.onCreate()
        startRequested.set(true)
        preferences = CompanionPreferences(this)
        overlay = OverlayController(this, preferences)
        val deviceKeys = DeviceKeyManager()
        auth = NativeAuthRepository(KeystoreSecureStorage(this), deviceKeys)
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            disableAndStop()
            return START_NOT_STICKY
        }

        startVisibleForeground()
        running.set(true)
        val generation = lifecycleGeneration.get()
        if (!preferences.enabled || !auth.hasSession()) {
            preferences.clearCompanion()
            intentionalStop = true
            stopSelf()
            return START_NOT_STICKY
        }
        if (!Settings.canDrawOverlays(this)) {
            preferences.transition(CompanionEvent.PermissionRevoked)
            overlay.remove()
            intentionalStop = true
            stopSelf()
            return START_NOT_STICKY
        }
        if (refreshScheduled) return START_NOT_STICKY

        // A persisted entitlement timestamp is UX state, not authority. Every
        // service start verifies the server before recreating the overlay.
        preferences.state = CompanionState.STARTING

        if (!refreshScheduled) {
            refreshScheduled = true
            scheduler.execute { refreshEntitlement(generation) }
            scheduler.scheduleWithFixedDelay(
                { refreshEntitlement(generation) },
                REFRESH_INTERVAL_MINUTES,
                REFRESH_INTERVAL_MINUTES,
                TimeUnit.MINUTES,
            )
            scheduler.scheduleWithFixedDelay(
                { verifyOverlayPermission(generation) },
                PERMISSION_CHECK_SECONDS,
                PERMISSION_CHECK_SECONDS,
                TimeUnit.SECONDS,
            )
        }
        return START_NOT_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        invalidateLifecycle()
        overlay.remove()
        scheduler.shutdownNow()
        if (!intentionalStop &&
            preferences.enabled &&
            preferences.state != CompanionState.PERMISSION_REQUIRED &&
            preferences.state != CompanionState.ENTITLEMENT_REQUIRED
        ) {
            preferences.state = CompanionState.PAUSED
        }
        super.onDestroy()
    }

    private fun refreshEntitlement(generation: Long) {
        if (!isGenerationActive(generation)) return
        try {
            val session = auth.refresh()
            if (!isGenerationActive(generation)) return
            if (!session.entitlement.hasPaidAccess) {
                preferences.entitlementConfirmedAt = 0L
                preferences.enabled = false
                preferences.transition(CompanionEvent.EntitlementChanged(false))
                stopFromWorker()
                return
            }
            preferences.entitlementConfirmedAt = System.currentTimeMillis()
            if (!Settings.canDrawOverlays(this)) {
                preferences.transition(CompanionEvent.PermissionRevoked)
                stopFromWorker()
                return
            }
            mainHandler.post {
                if (!isGenerationActive(generation)) return@post
                if (overlay.show { disableAndStop(generation) }) {
                    preferences.transition(CompanionEvent.ServiceStarted)
                } else {
                    preferences.transition(CompanionEvent.Failed)
                    stopFromMain()
                }
            }
        } catch (error: MobileApiException) {
            if (!isGenerationActive(generation)) return
            when (error.kind) {
                MobileApiError.OFFLINE -> {
                    preferences.transition(CompanionEvent.NetworkLost)
                    val confirmationAge =
                        System.currentTimeMillis() - preferences.entitlementConfirmedAt
                    val withinOfflineGrace =
                        preferences.entitlementConfirmedAt > 0L &&
                            confirmationAge in 0L..OFFLINE_GRACE_MS
                    if (!overlay.isShowing || !withinOfflineGrace) {
                        preferences.enabled = false
                        overlay.remove()
                        stopFromWorker()
                    }
                }
                MobileApiError.ENTITLEMENT -> {
                    preferences.enabled = false
                    preferences.transition(CompanionEvent.EntitlementChanged(false))
                    stopFromWorker()
                }
                MobileApiError.UNAUTHORIZED,
                MobileApiError.SERVER,
                -> {
                    preferences.enabled = false
                    preferences.transition(CompanionEvent.Failed)
                    stopFromWorker()
                }
            }
        } catch (_: Exception) {
            if (!isGenerationActive(generation)) return
            preferences.enabled = false
            preferences.transition(CompanionEvent.Failed)
            stopFromWorker()
        }
    }

    private fun verifyOverlayPermission(generation: Long) {
        if (!isGenerationActive(generation)) return
        if (!Settings.canDrawOverlays(this)) {
            preferences.transition(CompanionEvent.PermissionRevoked)
            stopFromWorker()
        }
    }

    private fun disableAndStop(expectedGeneration: Long? = null) {
        if (expectedGeneration != null && !isGenerationActive(expectedGeneration)) return
        preferences.clearCompanion()
        intentionalStop = true
        invalidateLifecycle()
        overlay.remove()
        stopSelf()
    }

    private fun stopFromWorker() {
        val generation = lifecycleGeneration.get()
        mainHandler.post {
            if (isGenerationActive(generation)) stopFromMain()
        }
    }

    private fun stopFromMain() {
        intentionalStop = true
        invalidateLifecycle()
        overlay.remove()
        stopSelf()
    }

    private fun isGenerationActive(generation: Long): Boolean {
        return running.get() && lifecycleGeneration.get() == generation
    }

    private fun invalidateLifecycle() {
        lifecycleGeneration.incrementAndGet()
        running.set(false)
        startRequested.set(false)
        mainHandler.removeCallbacksAndMessages(null)
    }

    private fun startVisibleForeground() {
        val notification = activeNotification()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE,
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun activeNotification(): Notification {
        val openIntent = Intent(this, MainActivity::class.java).apply {
            action = Intent.ACTION_VIEW
            data = Uri.parse("buddieai://companion")
            addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }
        val stopIntent = Intent(this, CompanionService::class.java).apply {
            action = ACTION_STOP
        }
        val openPendingIntent = PendingIntent.getActivity(
            this,
            1,
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val stopPendingIntent = PendingIntent.getService(
            this,
            2,
            stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        return Notification.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_buddie_notification)
            .setContentTitle(getString(R.string.companion_notification_title))
            .setContentText(getString(R.string.companion_notification_text))
            .setContentIntent(openPendingIntent)
            .setOngoing(true)
            .setCategory(Notification.CATEGORY_SERVICE)
            .addAction(
                Notification.Action.Builder(
                    null,
                    getString(R.string.disable_companion),
                    stopPendingIntent,
                ).build(),
            )
            .build()
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            getString(R.string.companion_notification_channel),
            NotificationManager.IMPORTANCE_LOW,
        ).apply {
            description = getString(R.string.companion_notification_channel_description)
            setShowBadge(false)
        }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    companion object {
        const val ACTION_START = "com.buddieai.shadow.companion.START"
        const val ACTION_STOP = "com.buddieai.shadow.companion.STOP"
        const val CHANNEL_ID = "buddie_companion_active"
        const val NOTIFICATION_ID = 4102
        const val REFRESH_INTERVAL_MINUTES = 15L
        const val PERMISSION_CHECK_SECONDS = 30L
        const val OFFLINE_GRACE_MS = 24L * 60 * 60 * 1000

        private val running = AtomicBoolean(false)
        private val startRequested = AtomicBoolean(false)

        val isRunning: Boolean
            get() = running.get()

        fun start(context: Context) {
            if (!startRequested.compareAndSet(false, true)) return
            val intent = Intent(context, CompanionService::class.java).setAction(ACTION_START)
            try {
                context.startForegroundService(intent)
            } catch (error: Exception) {
                startRequested.set(false)
                throw error
            }
        }

        fun stop(context: Context) {
            startRequested.set(false)
            running.set(false)
            context.stopService(Intent(context, CompanionService::class.java))
        }
    }
}
