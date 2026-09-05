package com.buddieai.shadow.companion

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.view.Gravity
import android.view.MotionEvent
import android.view.ViewConfiguration
import android.widget.FrameLayout
import android.widget.TextView
import kotlin.math.abs

@SuppressLint("ViewConstructor")
class FloatingOrbView(
    context: Context,
    onTap: () -> Unit,
    onClose: () -> Unit,
    onDrag: (deltaX: Int, deltaY: Int, finished: Boolean) -> Unit,
) : FrameLayout(context) {
    init {
        clipChildren = false
        clipToPadding = false
        importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_YES

        addView(
            OrbFaceView(context, onTap, onDrag).apply {
                text = "✦"
                textSize = 27f
                gravity = Gravity.CENTER
                setTextColor(Color.WHITE)
                contentDescription = "Open Buddie Oracle"
                background = GradientDrawable(
                    GradientDrawable.Orientation.TL_BR,
                    intArrayOf(Color.rgb(139, 92, 246), Color.rgb(79, 70, 229)),
                ).apply {
                    shape = GradientDrawable.OVAL
                    setStroke(dp(2), Color.argb(150, 255, 255, 255))
                }
                elevation = dp(8).toFloat()
            },
            LayoutParams(dp(64), dp(64), Gravity.BOTTOM or Gravity.START),
        )

        addView(
            TextView(context).apply {
                text = "×"
                textSize = 19f
                gravity = Gravity.CENTER
                setTextColor(Color.WHITE)
                contentDescription = "Disable Buddie Companion"
                background = GradientDrawable().apply {
                    shape = GradientDrawable.OVAL
                    setColor(Color.rgb(190, 45, 70))
                    setStroke(dp(1), Color.WHITE)
                }
                elevation = dp(10).toFloat()
                setOnClickListener { onClose() }
            },
            LayoutParams(dp(48), dp(48), Gravity.TOP or Gravity.END),
        )
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
}

@SuppressLint("ViewConstructor")
private class OrbFaceView(
    context: Context,
    private val onTap: () -> Unit,
    private val onDrag: (deltaX: Int, deltaY: Int, finished: Boolean) -> Unit,
) : TextView(context) {
    private val touchSlop = ViewConfiguration.get(context).scaledTouchSlop
    private var downX = 0f
    private var downY = 0f
    private var lastX = 0f
    private var lastY = 0f
    private var dragging = false

    override fun onTouchEvent(event: MotionEvent): Boolean {
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                downX = event.rawX
                downY = event.rawY
                lastX = event.rawX
                lastY = event.rawY
                dragging = false
                animate().scaleX(0.94f).scaleY(0.94f).setDuration(80).start()
                return true
            }

            MotionEvent.ACTION_MOVE -> {
                if (!dragging &&
                    (abs(event.rawX - downX) > touchSlop || abs(event.rawY - downY) > touchSlop)
                ) {
                    dragging = true
                }
                if (dragging) {
                    onDrag((event.rawX - lastX).toInt(), (event.rawY - lastY).toInt(), false)
                    lastX = event.rawX
                    lastY = event.rawY
                }
                return true
            }

            MotionEvent.ACTION_UP -> {
                animate().scaleX(1f).scaleY(1f).setDuration(100).start()
                if (dragging) {
                    onDrag(0, 0, true)
                } else {
                    performClick()
                }
                return true
            }

            MotionEvent.ACTION_CANCEL -> {
                animate().scaleX(1f).scaleY(1f).setDuration(100).start()
                if (dragging) onDrag(0, 0, true)
                return true
            }
        }
        return super.onTouchEvent(event)
    }

    override fun performClick(): Boolean {
        super.performClick()
        onTap()
        return true
    }
}
