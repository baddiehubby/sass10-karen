package com.buddieai.shadow.companion

import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.net.Uri
import android.provider.Settings
import android.view.Gravity
import android.view.WindowManager
import com.buddieai.shadow.MainActivity

class OverlayController(
    private val context: Context,
    private val preferences: CompanionPreferences,
) {
    private val windowManager = context.getSystemService(WindowManager::class.java)
    private var orb: FloatingOrbView? = null
    private var layoutParams: WindowManager.LayoutParams? = null

    val isShowing: Boolean
        get() = orb != null

    fun show(onClose: () -> Unit): Boolean {
        if (orb != null) return true
        if (!Settings.canDrawOverlays(context)) return false

        val params = WindowManager.LayoutParams(
            dp(96),
            dp(96),
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
            PixelFormat.TRANSLUCENT,
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = preferences.orbX
            y = preferences.orbY
        }

        val view = FloatingOrbView(
            context = context,
            onTap = ::openOracle,
            onClose = onClose,
            onDrag = { deltaX, deltaY, finished ->
                params.x = (params.x + deltaX).coerceIn(0, maxX())
                params.y = (params.y + deltaY).coerceIn(0, maxY())
                orb?.let { current ->
                    runCatching { windowManager.updateViewLayout(current, params) }
                }
                if (finished) {
                    preferences.orbX = params.x
                    preferences.orbY = params.y
                }
            },
        )

        return runCatching {
            windowManager.addView(view, params)
            orb = view
            layoutParams = params
            true
        }.getOrElse {
            orb = null
            layoutParams = null
            false
        }
    }

    fun remove() {
        orb?.let { view ->
            runCatching { windowManager.removeViewImmediate(view) }
        }
        orb = null
        layoutParams = null
    }

    private fun openOracle() {
        val intent = Intent(context, MainActivity::class.java).apply {
            action = Intent.ACTION_VIEW
            data = Uri.parse("buddieai://oracle")
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }
        runCatching { context.startActivity(intent) }
    }

    private fun maxX(): Int = (context.resources.displayMetrics.widthPixels - dp(96)).coerceAtLeast(0)

    private fun maxY(): Int = (context.resources.displayMetrics.heightPixels - dp(96)).coerceAtLeast(0)

    private fun dp(value: Int): Int = (value * context.resources.displayMetrics.density).toInt()
}
