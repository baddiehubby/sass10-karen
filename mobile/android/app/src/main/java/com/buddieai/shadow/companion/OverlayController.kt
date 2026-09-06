package com.buddieai.shadow.companion

import android.content.ComponentCallbacks2
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.Gravity
import android.view.WindowInsets
import android.view.WindowManager
import com.buddieai.shadow.MainActivity

@Suppress("OVERRIDE_DEPRECATION")
class OverlayController(
    private val context: Context,
    private val preferences: CompanionPreferences,
) : ComponentCallbacks2, DisplayManager.DisplayListener {
    private val windowManager = context.getSystemService(WindowManager::class.java)
    private val displayManager = context.getSystemService(DisplayManager::class.java)
    private val mainHandler = Handler(Looper.getMainLooper())
    private var orb: FloatingOrbView? = null
    private var layoutParams: WindowManager.LayoutParams? = null
    private var observingDisplay = false

    val isShowing: Boolean
        get() = orb != null

    fun show(
        visualState: OrbVisualState = OrbVisualState.IDLE,
        onClose: () -> Unit,
    ): Boolean {
        orb?.let {
            it.setVisualState(visualState)
            return true
        }
        if (!Settings.canDrawOverlays(context)) return false

        val orbSize = dp(96)
        val initialPosition = clamp(preferences.orbX, preferences.orbY, orbSize)
        val params = WindowManager.LayoutParams(
            orbSize,
            orbSize,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
            PixelFormat.TRANSLUCENT,
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = initialPosition.x
            y = initialPosition.y
        }

        val view = FloatingOrbView(
            context = context,
            onTap = ::openOracle,
            onLongPress = ::openCompanionControls,
            onClose = onClose,
            onDrag = { deltaX, deltaY, finished ->
                val position = clamp(params.x + deltaX, params.y + deltaY, orbSize)
                params.x = position.x
                params.y = position.y
                orb?.let { current ->
                    runCatching { windowManager.updateViewLayout(current, params) }
                }
                if (finished) {
                    preferences.orbX = params.x
                    preferences.orbY = params.y
                }
            },
        ).apply { setVisualState(visualState) }

        return runCatching {
            windowManager.addView(view, params)
            orb = view
            layoutParams = params
            startObservingDisplay()
            persistPosition(params)
            true
        }.getOrElse {
            orb = null
            layoutParams = null
            false
        }
    }

    fun remove() {
        stopObservingDisplay()
        orb?.let { view ->
            runCatching { windowManager.removeViewImmediate(view) }
        }
        orb = null
        layoutParams = null
    }

    fun updateVisualState(state: OrbVisualState) {
        orb?.setVisualState(state)
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        reclamp()
    }

    override fun onDisplayChanged(displayId: Int) {
        reclamp()
    }

    override fun onDisplayAdded(displayId: Int) = Unit

    override fun onDisplayRemoved(displayId: Int) {
        reclamp()
    }

    override fun onLowMemory() = Unit

    override fun onTrimMemory(level: Int) = Unit

    private fun openOracle() {
        val intent = Intent(context, MainActivity::class.java).apply {
            action = Intent.ACTION_VIEW
            data = Uri.parse("buddieai://oracle")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }
        runCatching { context.startActivity(intent) }
    }

    private fun openCompanionControls() {
        val intent = Intent(context, MainActivity::class.java).apply {
            action = Intent.ACTION_VIEW
            data = Uri.parse("buddieai://companion")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }
        runCatching { context.startActivity(intent) }
    }

    private fun reclamp() {
        val params = layoutParams ?: return
        val view = orb ?: return
        mainHandler.post {
            if (orb !== view || layoutParams !== params) return@post
            val position = clamp(params.x, params.y, params.width)
            params.x = position.x
            params.y = position.y
            runCatching { windowManager.updateViewLayout(view, params) }
            persistPosition(params)
        }
    }

    private fun clamp(x: Int, y: Int, orbSize: Int): OverlayPosition {
        val area = availableArea()
        return OverlayGeometry.clamp(x, y, orbSize, area)
    }

    private fun availableArea(): OverlayArea {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            runCatching {
                val metrics = windowManager.currentWindowMetrics
                val insets = metrics.windowInsets.getInsetsIgnoringVisibility(
                    WindowInsets.Type.systemBars() or WindowInsets.Type.displayCutout(),
                )
                return OverlayArea(
                    metrics.bounds.left + insets.left,
                    metrics.bounds.top + insets.top,
                    metrics.bounds.right - insets.right,
                    metrics.bounds.bottom - insets.bottom,
                )
            }
        }
        val metrics = context.resources.displayMetrics
        return OverlayArea(0, 0, metrics.widthPixels, metrics.heightPixels)
    }

    private fun startObservingDisplay() {
        if (observingDisplay) return
        observingDisplay = true
        context.registerComponentCallbacks(this)
        displayManager.registerDisplayListener(this, mainHandler)
    }

    private fun stopObservingDisplay() {
        if (!observingDisplay) return
        observingDisplay = false
        runCatching { context.unregisterComponentCallbacks(this) }
        displayManager.unregisterDisplayListener(this)
        mainHandler.removeCallbacksAndMessages(null)
    }

    private fun persistPosition(params: WindowManager.LayoutParams) {
        preferences.orbX = params.x
        preferences.orbY = params.y
    }

    private fun dp(value: Int): Int = (value * context.resources.displayMetrics.density).toInt()
}

internal data class OverlayPosition(val x: Int, val y: Int)

internal data class OverlayArea(val left: Int, val top: Int, val right: Int, val bottom: Int)

internal object OverlayGeometry {
    fun clamp(x: Int, y: Int, orbSize: Int, area: OverlayArea): OverlayPosition {
        val maxX = (area.right - orbSize).coerceAtLeast(area.left)
        val maxY = (area.bottom - orbSize).coerceAtLeast(area.top)
        return OverlayPosition(
            x = x.coerceIn(area.left, maxX),
            y = y.coerceIn(area.top, maxY),
        )
    }
}
