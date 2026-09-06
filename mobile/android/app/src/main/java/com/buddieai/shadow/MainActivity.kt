package com.buddieai.shadow

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import com.buddieai.shadow.auth.MobileApiError
import com.buddieai.shadow.auth.MobileApiException
import com.buddieai.shadow.auth.NativeAuthRepository
import com.buddieai.shadow.auth.NativeSession
import com.buddieai.shadow.auth.SharedMedia
import com.buddieai.shadow.companion.CompanionEvent
import com.buddieai.shadow.companion.CompanionPreferences
import com.buddieai.shadow.companion.CompanionService
import com.buddieai.shadow.companion.CompanionState
import com.buddieai.shadow.deeplink.DeepLinkRouter
import com.buddieai.shadow.security.DeviceKeyManager
import com.buddieai.shadow.security.KeystoreSecureStorage
import java.util.Locale
import java.util.concurrent.Executors

class MainActivity : Activity() {
    private lateinit var statusText: TextView
    private lateinit var detailText: TextView
    private lateinit var signInButton: Button
    private lateinit var enableButton: Button
    private lateinit var disableButton: Button
    private lateinit var permissionButton: Button
    private lateinit var logoutButton: Button
    private lateinit var pauseButton: Button
    private lateinit var resumeButton: Button
    private lateinit var muteButton: Button
    private lateinit var moodButton: Button
    private lateinit var auth: NativeAuthRepository
    private lateinit var companion: CompanionPreferences
    private val executor = Executors.newSingleThreadExecutor()
    private var entitled = false
    private var busy = false
    private var waitingForOverlayPermission = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val deviceKeys = DeviceKeyManager()
        val appVersion = runCatching {
            packageManager.getPackageInfo(packageName, 0).versionName
        }.getOrNull() ?: "unknown"
        auth = NativeAuthRepository(
            KeystoreSecureStorage(this),
            deviceKeys,
            appVersion = appVersion,
        )
        companion = CompanionPreferences(this)
        setContentView(buildContent())
        reconcileCompanionState()
        handleDeepLink(intent)
        val handledShare = handleSharedContext(intent)
        if (!handledShare && auth.hasSession() && intent.data?.host != "auth") {
            verifySession(forEnable = false)
        } else if (!handledShare) {
            render()
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleDeepLink(intent)
        handleSharedContext(intent)
    }

    override fun onResume() {
        super.onResume()
        if (::companion.isInitialized && ::auth.isInitialized) {
            reconcileCompanionState()
        }
        if (::companion.isInitialized && companion.enabled && !Settings.canDrawOverlays(this)) {
            CompanionService.stop(this)
            companion.transition(CompanionEvent.PermissionRevoked)
        }
        if (waitingForOverlayPermission) {
            waitingForOverlayPermission = false
            if (Settings.canDrawOverlays(this)) {
                verifySession(forEnable = true)
            } else {
                companion.transition(CompanionEvent.PermissionResult(false, entitled))
                render(getString(R.string.overlay_permission_explanation))
            }
        } else if (::companion.isInitialized) {
            render()
        }
    }

    override fun onDestroy() {
        executor.shutdownNow()
        super.onDestroy()
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != NOTIFICATION_PERMISSION_REQUEST) return
        if (grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) {
            requestOverlayPermissionOrStart()
        } else {
            companion.transition(CompanionEvent.Failed)
            render(getString(R.string.notification_permission_explanation))
        }
    }

    private fun buildContent(): View {
        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(dp(24), dp(48), dp(24), dp(32))
        }

        content.addView(TextView(this).apply {
            text = getString(R.string.app_name)
            textSize = 30f
            setTextColor(getColor(R.color.buddie_text))
            gravity = Gravity.CENTER
        }, matchWidth())

        content.addView(TextView(this).apply {
            text = getString(R.string.stage_label)
            textSize = 15f
            setTextColor(getColor(R.color.buddie_text_secondary))
            gravity = Gravity.CENTER
            setPadding(0, dp(8), 0, dp(32))
        }, matchWidth())

        statusText = TextView(this).apply {
            text = CompanionState.OFF.name
            contentDescription = getString(R.string.companion_status)
            textSize = 16f
            setTextColor(getColor(R.color.buddie_text))
            gravity = Gravity.CENTER
            setPadding(dp(16), dp(18), dp(16), dp(18))
            background = roundedBackground(R.color.buddie_surface)
        }
        content.addView(statusText, matchWidth(bottomMargin = dp(18)))

        detailText = TextView(this).apply {
            textSize = 14f
            setTextColor(getColor(R.color.buddie_text_secondary))
            gravity = Gravity.CENTER
        }
        content.addView(detailText, matchWidth(bottomMargin = dp(20)))

        signInButton = actionButton(R.string.sign_in, ::beginSignIn)
        content.addView(signInButton, matchWidth(bottomMargin = dp(12)))

        enableButton = actionButton(R.string.enable_companion) {
            verifySession(forEnable = true)
        }
        content.addView(enableButton, matchWidth(bottomMargin = dp(12)))

        permissionButton = actionButton(R.string.open_overlay_settings, ::openOverlaySettings)
        content.addView(permissionButton, matchWidth(bottomMargin = dp(12)))

        disableButton = actionButton(R.string.disable_companion, ::disableCompanion)
        content.addView(disableButton, matchWidth(bottomMargin = dp(12)))

        pauseButton = actionButton(R.string.pause_companion, ::pauseCompanion)
        content.addView(pauseButton, matchWidth(bottomMargin = dp(12)))

        resumeButton = actionButton(R.string.resume_companion, ::resumeCompanion)
        content.addView(resumeButton, matchWidth(bottomMargin = dp(12)))

        muteButton = actionButton(R.string.mute_companion, ::toggleMute)
        content.addView(muteButton, matchWidth(bottomMargin = dp(12)))

        moodButton = actionButton(R.string.share_mood, ::chooseMood)
        content.addView(moodButton, matchWidth(bottomMargin = dp(12)))

        content.addView(actionButton(R.string.companion_settings) {
            openDestination(DeepLinkRouter.Destination.SETTINGS)
        }, matchWidth(bottomMargin = dp(12)))

        logoutButton = actionButton(R.string.logout, ::logout)
        content.addView(logoutButton, matchWidth(bottomMargin = dp(24)))

        content.addView(actionButton(R.string.open_buddie) {
            openDestination(DeepLinkRouter.Destination.OPEN)
        }, matchWidth(bottomMargin = dp(12)))

        content.addView(actionButton(R.string.open_oracle) {
            openDestination(DeepLinkRouter.Destination.ORACLE)
        }, matchWidth(bottomMargin = dp(24)))

        content.addView(TextView(this).apply {
            text = getString(R.string.companion_not_enabled)
            textSize = 13f
            setTextColor(getColor(R.color.buddie_text_secondary))
            gravity = Gravity.CENTER
        }, matchWidth(bottomMargin = dp(16)))

        content.addView(TextView(this).apply {
            text = getString(R.string.privacy_context_copy)
            textSize = 13f
            setTextColor(getColor(R.color.buddie_text_secondary))
            gravity = Gravity.CENTER
        }, matchWidth(bottomMargin = dp(8)))

        content.addView(TextView(this).apply {
            text = getString(R.string.accessibility_controls_copy)
            textSize = 13f
            setTextColor(getColor(R.color.buddie_text_secondary))
            gravity = Gravity.CENTER
        }, matchWidth())

        return ScrollView(this).apply {
            isFillViewport = true
            setBackgroundColor(getColor(R.color.buddie_background))
            addView(
                content,
                FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.WRAP_CONTENT,
                ),
            )
        }
    }

    private fun actionButton(label: Int, onClick: () -> Unit): Button {
        return Button(this).apply {
            text = getString(label)
            contentDescription = getString(label)
            textSize = 16f
            setTextColor(Color.WHITE)
            minHeight = dp(48)
            isAllCaps = false
            background = roundedBackground(R.color.buddie_primary)
            setOnClickListener { onClick() }
        }
    }

    private fun handleDeepLink(sourceIntent: Intent) {
        if (sourceIntent.action != Intent.ACTION_VIEW) return
        val uri = sourceIntent.data
        if (uri?.scheme == "buddieai" && uri.host == "auth") {
            setIntent(Intent(this, MainActivity::class.java))
            exchangeAuthCallback(uri)
            return
        }
        val destination = DeepLinkRouter.parse(sourceIntent.dataString)
        if (destination == null) {
            statusText.text = getString(R.string.invalid_link)
            return
        }
        if (destination == DeepLinkRouter.Destination.COMPANION) {
            render(getString(R.string.companion_controls_description))
            return
        }
        openDestination(destination)
    }

    private fun handleSharedContext(sourceIntent: Intent): Boolean {
        if (sourceIntent.action != Intent.ACTION_SEND || sourceIntent.type != "text/plain") {
            return false
        }
        val text = sourceIntent.getCharSequenceExtra(Intent.EXTRA_TEXT)
            ?.toString()
            ?.trim()
            ?.take(MAX_SHARED_TEXT_LENGTH)
            ?.takeIf { it.isNotBlank() }
        val title = sourceIntent.getStringExtra(Intent.EXTRA_SUBJECT)
            ?.trim()
            ?.take(MAX_SHARED_TITLE_LENGTH)
            ?.takeIf { it.isNotBlank() }
        setIntent(Intent(this, MainActivity::class.java))
        if (text == null && title == null) {
            render(getString(R.string.shared_context_empty))
        } else if (!auth.hasSession()) {
            render(getString(R.string.share_sign_in_required))
        } else {
            sendContext(sharedMedia = SharedMedia(title = title, text = text))
        }
        return true
    }

    private fun beginSignIn() {
        runCatching {
            startActivity(Intent(Intent.ACTION_VIEW, auth.createSignInUri()))
        }.onFailure {
            render(getString(R.string.open_failed))
        }
    }

    private fun exchangeAuthCallback(uri: Uri) {
        if (busy) return
        setBusy(true)
        executor.execute {
            runCatching { auth.exchangeCallback(uri) }
                .onSuccess { session ->
                    runOnUiThread {
                        applySession(session)
                        setBusy(false)
                        render(getString(R.string.authenticated))
                    }
                }
                .onFailure {
                    runOnUiThread {
                        setBusy(false)
                        companion.transition(CompanionEvent.Failed)
                        render(getString(R.string.session_error))
                    }
                }
        }
    }

    private fun verifySession(forEnable: Boolean) {
        if (busy) return
        if (!auth.hasSession()) {
            entitled = false
            render(getString(R.string.session_error))
            return
        }
        setBusy(true)
        executor.execute {
            runCatching { auth.refresh() }
                .onSuccess { session ->
                    runOnUiThread {
                        applySession(session)
                        setBusy(false)
                        if (forEnable && session.entitlement.hasPaidAccess) {
                            requestNotificationPermissionOrContinue()
                        } else if (
                            !forEnable &&
                            session.entitlement.hasPaidAccess &&
                            companion.enabled &&
                            companion.state in setOf(
                                CompanionState.OFFLINE,
                                CompanionState.PAUSED,
                                CompanionState.STARTING,
                            ) &&
                            !companion.userPaused &&
                            Settings.canDrawOverlays(this)
                        ) {
                            startCompanion()
                        } else {
                            render(
                                if (session.entitlement.hasPaidAccess) {
                                    getString(R.string.authenticated)
                                } else {
                                    getString(R.string.entitlement_required)
                                },
                            )
                        }
                    }
                }
                .onFailure { error ->
                    runOnUiThread {
                        setBusy(false)
                        handleSessionFailure(error)
                    }
                }
        }
    }

    private fun applySession(session: NativeSession) {
        entitled = session.entitlement.hasPaidAccess
        if (entitled) {
            companion.entitlementConfirmedAt = System.currentTimeMillis()
            if (companion.state == CompanionState.ENTITLEMENT_REQUIRED) {
                companion.state = CompanionState.OFF
            }
        } else {
            companion.entitlementConfirmedAt = 0L
            companion.enabled = false
            companion.transition(CompanionEvent.EntitlementChanged(false))
            CompanionService.stop(this)
        }
    }

    private fun handleSessionFailure(error: Throwable) {
        if (error is MobileApiException && error.kind == MobileApiError.OFFLINE) {
            companion.transition(CompanionEvent.NetworkLost)
            render(getString(R.string.offline))
            return
        }
        if (error is MobileApiException && error.kind == MobileApiError.ENTITLEMENT) {
            entitled = false
            companion.enabled = false
            companion.entitlementConfirmedAt = 0L
            companion.transition(CompanionEvent.EntitlementChanged(false))
            CompanionService.stop(this)
            render(getString(R.string.entitlement_required))
            return
        }
        auth.clearSession()
        entitled = false
        disableCompanion()
        companion.transition(CompanionEvent.Failed)
        render(getString(R.string.session_error))
    }

    private fun requestNotificationPermissionOrContinue() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            requestPermissions(
                arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                NOTIFICATION_PERMISSION_REQUEST,
            )
        } else {
            requestOverlayPermissionOrStart()
        }
    }

    private fun requestOverlayPermissionOrStart() {
        if (Settings.canDrawOverlays(this)) {
            startCompanion()
        } else {
            companion.enabled = true
            companion.transition(CompanionEvent.Enable(entitled, permissionGranted = false))
            render(getString(R.string.overlay_permission_explanation))
        }
    }

    private fun openOverlaySettings() {
        waitingForOverlayPermission = true
        val intent = Intent(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:$packageName"),
        )
        runCatching { startActivity(intent) }.onFailure {
            waitingForOverlayPermission = false
            companion.transition(CompanionEvent.Failed)
            render(getString(R.string.open_failed))
        }
    }

    private fun startCompanion() {
        companion.userPaused = false
        companion.enabled = true
        companion.transition(CompanionEvent.Enable(entitled, permissionGranted = true))
        runCatching { CompanionService.start(this) }
            .onFailure {
                companion.enabled = false
                companion.transition(CompanionEvent.Failed)
            }
        render()
    }

    private fun pauseCompanion() {
        companion.userPaused = true
        companion.transition(CompanionEvent.Pause)
        CompanionService.pause(this)
        render(getString(R.string.companion_paused))
    }

    private fun resumeCompanion() {
        companion.userPaused = false
        companion.transition(
            CompanionEvent.Resume(
                entitled = entitled,
                permissionGranted = Settings.canDrawOverlays(this),
            ),
        )
        CompanionService.resume(this)
        render(getString(R.string.checking_access))
    }

    private fun toggleMute() {
        companion.muted = !companion.muted
        render(
            getString(
                if (companion.muted) R.string.companion_muted else R.string.companion_unmuted,
            ),
        )
    }

    private fun chooseMood() {
        val moods = resources.getStringArray(R.array.explicit_moods)
        AlertDialog.Builder(this)
            .setTitle(R.string.share_mood)
            .setItems(moods) { _, which ->
                sendContext(explicitMood = moods[which].lowercase(Locale.ROOT))
            }
            .setNegativeButton(android.R.string.cancel, null)
            .show()
    }

    private fun sendContext(
        explicitMood: String? = null,
        sharedMedia: SharedMedia? = null,
    ) {
        if (busy) return
        setBusy(true)
        executor.execute {
            runCatching { auth.sendContext(explicitMood, sharedMedia) }
                .onSuccess { response ->
                    runOnUiThread {
                        CompanionService.react(
                            this,
                            response.reaction.orbCue,
                            response.reaction.mood,
                        )
                        setBusy(false)
                        render(
                            listOf(response.reaction.text, response.reaction.disclaimer)
                                .filter { it.isNotBlank() }
                                .joinToString("\n"),
                        )
                    }
                }
                .onFailure { error ->
                    runOnUiThread {
                        setBusy(false)
                        if (error is MobileApiException &&
                            error.kind in setOf(MobileApiError.UNAUTHORIZED, MobileApiError.ENTITLEMENT)
                        ) {
                            handleSessionFailure(error)
                        } else {
                            render(
                                getString(
                                    if (error is MobileApiException &&
                                        error.kind == MobileApiError.OFFLINE
                                    ) {
                                        R.string.offline
                                    } else {
                                        R.string.context_failed
                                    },
                                ),
                            )
                        }
                    }
                }
        }
    }

    private fun disableCompanion() {
        CompanionService.stop(this)
        companion.clearCompanion()
        render()
    }

    private fun logout() {
        disableCompanion()
        entitled = false
        companion.transition(CompanionEvent.Logout)
        setBusy(true)
        executor.execute {
            runCatching { auth.logout() }
            runOnUiThread {
                setBusy(false)
                render()
            }
        }
    }

    private fun reconcileCompanionState() {
        if (!auth.hasSession()) {
            if (companion.enabled || companion.state != CompanionState.OFF) {
                CompanionService.stop(this)
                companion.clearCompanion()
            }
            return
        }
        if (companion.state == CompanionState.PERMISSION_REQUIRED ||
            companion.state == CompanionState.ENTITLEMENT_REQUIRED
        ) {
            return
        }
        if (!companion.enabled) {
            if (companion.state == CompanionState.ACTIVE) companion.state = CompanionState.OFF
            return
        }
        if (!Settings.canDrawOverlays(this)) {
            CompanionService.stop(this)
            companion.transition(CompanionEvent.PermissionRevoked)
            return
        }

        if (companion.state == CompanionState.ACTIVE && !CompanionService.isRunning) {
            // ACTIVE is a runtime fact, never a durable entitlement assertion.
            // The normal verifySession path must revalidate the server before
            // startCompanion recreates the service and overlay.
            companion.state = CompanionState.PAUSED
        }
    }

    private fun setBusy(value: Boolean) {
        busy = value
        render(if (value) getString(R.string.checking_access) else null)
    }

    private fun render(detail: String? = null) {
        if (!::statusText.isInitialized || !::auth.isInitialized) return
        val hasSession = auth.hasSession()
        statusText.text = companion.state.name
        detailText.text = detail.orEmpty()
        signInButton.visibility = if (hasSession) View.GONE else View.VISIBLE
        enableButton.visibility =
            if (hasSession && !companion.enabled && companion.state != CompanionState.ENTITLEMENT_REQUIRED) {
                View.VISIBLE
            } else {
                View.GONE
            }
        permissionButton.visibility =
            if (companion.state == CompanionState.PERMISSION_REQUIRED) View.VISIBLE else View.GONE
        disableButton.visibility = if (companion.enabled) View.VISIBLE else View.GONE
        pauseButton.visibility =
            if (companion.enabled && !companion.userPaused) View.VISIBLE else View.GONE
        resumeButton.visibility =
            if (companion.enabled && companion.userPaused) View.VISIBLE else View.GONE
        muteButton.visibility = if (companion.enabled) View.VISIBLE else View.GONE
        muteButton.text =
            getString(if (companion.muted) R.string.unmute_companion else R.string.mute_companion)
        moodButton.visibility = if (hasSession) View.VISIBLE else View.GONE
        logoutButton.visibility = if (hasSession) View.VISIBLE else View.GONE
        listOf(
            signInButton,
            enableButton,
            permissionButton,
            disableButton,
            pauseButton,
            resumeButton,
            muteButton,
            moodButton,
            logoutButton,
        )
            .forEach { it.isEnabled = !busy }
    }

    private fun openDestination(destination: DeepLinkRouter.Destination) {
        runCatching {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(destination.webUrl)))
        }.onFailure {
            statusText.text = getString(R.string.open_failed)
        }
    }

    private fun roundedBackground(colorResource: Int): GradientDrawable {
        return GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = dp(16).toFloat()
            setColor(getColor(colorResource))
        }
    }

    private fun matchWidth(bottomMargin: Int = 0): LinearLayout.LayoutParams {
        return LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT,
        ).apply {
            this.bottomMargin = bottomMargin
        }
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private companion object {
        const val NOTIFICATION_PERMISSION_REQUEST = 4103
        const val MAX_SHARED_TEXT_LENGTH = 4_000
        const val MAX_SHARED_TITLE_LENGTH = 200
    }
}
