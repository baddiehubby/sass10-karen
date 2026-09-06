package com.buddieai.shadow.companion

import android.annotation.SuppressLint
import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Handler
import android.os.Looper
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
    onLongPress: () -> Unit,
    onClose: () -> Unit,
    onDrag: (deltaX: Int, deltaY: Int, finished: Boolean) -> Unit,
) : FrameLayout(context) {
    private val face: OrbFaceView

    init {
        clipChildren = false
        clipToPadding = false
        importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_YES

        face = OrbFaceView(context, onTap, onLongPress, onDrag).apply {
                text = "✦"
                textSize = 27f
                gravity = Gravity.CENTER
                setTextColor(Color.WHITE)
                elevation = dp(8).toFloat()
            }
        addView(
            face,
            LayoutParams(dp(64), dp(64), Gravity.BOTTOM or Gravity.START),
        )

        addView(
            TextView(context).apply {
                text = "×"
                textSize = 19f
                gravity = Gravity.CENTER
                setTextColor(Color.WHITE)
                contentDescription = context.getString(com.buddieai.shadow.R.string.disable_companion)
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
        setVisualState(OrbVisualState.IDLE)
    }

    fun setVisualState(state: OrbVisualState) = face.setVisualState(state)

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
}

@SuppressLint("ViewConstructor")
private class OrbFaceView(
    context: Context,
    private val onTap: () -> Unit,
    private val onLongPress: () -> Unit,
    private val onDrag: (deltaX: Int, deltaY: Int, finished: Boolean) -> Unit,
) : TextView(context) {
    private val touchSlop = ViewConfiguration.get(context).scaledTouchSlop
    private var downX = 0f
    private var downY = 0f
    private var lastX = 0f
    private var lastY = 0f
    private var dragging = false
    private var longPressed = false
    private var pulse: ValueAnimator? = null
    private val handler = Handler(Looper.getMainLooper())
    private val longPress = Runnable {
        if (!dragging && isPressed) {
            longPressed = true
            performHapticFeedback(android.view.HapticFeedbackConstants.LONG_PRESS)
            onLongPress()
        }
    }

    fun setVisualState(state: OrbVisualState) {
        val colors = when (state) {
            OrbVisualState.IDLE -> intArrayOf(Color.rgb(139, 92, 246), Color.rgb(79, 70, 229))
            OrbVisualState.HAPPY -> intArrayOf(Color.rgb(250, 204, 21), Color.rgb(249, 115, 22))
            OrbVisualState.LISTENING -> intArrayOf(Color.rgb(34, 211, 238), Color.rgb(59, 130, 246))
            OrbVisualState.THINKING -> intArrayOf(Color.rgb(129, 140, 248), Color.rgb(88, 28, 135))
            OrbVisualState.EXCITED -> intArrayOf(Color.rgb(244, 63, 94), Color.rgb(249, 115, 22))
            OrbVisualState.CALM -> intArrayOf(Color.rgb(45, 212, 191), Color.rgb(14, 116, 144))
            OrbVisualState.SAD -> intArrayOf(Color.rgb(96, 165, 250), Color.rgb(71, 85, 105))
            OrbVisualState.PLAYFUL -> intArrayOf(Color.rgb(232, 121, 249), Color.rgb(124, 58, 237))
            OrbVisualState.MUSIC -> intArrayOf(Color.rgb(236, 72, 153), Color.rgb(99, 102, 241))
            OrbVisualState.OFFLINE -> intArrayOf(Color.rgb(148, 163, 184), Color.rgb(71, 85, 105))
            OrbVisualState.ERROR -> intArrayOf(Color.rgb(239, 68, 68), Color.rgb(127, 29, 29))
        }
        background = GradientDrawable(GradientDrawable.Orientation.TL_BR, colors).apply {
            shape = GradientDrawable.OVAL
            setStroke(dp(2), Color.argb(150, 255, 255, 255))
        }
        contentDescription = context.getString(
            com.buddieai.shadow.R.string.orb_state_description,
            state.name.lowercase().replaceFirstChar { it.uppercase() },
        )
        pulse?.cancel()
        pulse = null
        scaleX = 1f
        scaleY = 1f
        if (state !in setOf(OrbVisualState.OFFLINE, OrbVisualState.ERROR) &&
            ValueAnimator.areAnimatorsEnabled()
        ) {
            pulse = ValueAnimator.ofFloat(1f, 1.035f).apply {
                duration = 2_400L
                repeatMode = ValueAnimator.REVERSE
                repeatCount = ValueAnimator.INFINITE
                addUpdateListener {
                    val scale = it.animatedValue as Float
                    scaleX = scale
                    scaleY = scale
                }
                start()
            }
        }
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                downX = event.rawX
                downY = event.rawY
                lastX = event.rawX
                lastY = event.rawY
                dragging = false
                longPressed = false
                isPressed = true
                handler.postDelayed(longPress, ViewConfiguration.getLongPressTimeout().toLong())
                animate().scaleX(0.94f).scaleY(0.94f).setDuration(80).start()
                return true
            }

            MotionEvent.ACTION_MOVE -> {
                if (!dragging &&
                    (abs(event.rawX - downX) > touchSlop || abs(event.rawY - downY) > touchSlop)
                ) {
                    dragging = true
                    handler.removeCallbacks(longPress)
                }
                if (dragging) {
                    onDrag((event.rawX - lastX).toInt(), (event.rawY - lastY).toInt(), false)
                    lastX = event.rawX
                    lastY = event.rawY
                }
                return true
            }

            MotionEvent.ACTION_UP -> {
                handler.removeCallbacks(longPress)
                isPressed = false
                animate().scaleX(1f).scaleY(1f).setDuration(100).start()
                if (dragging) {
                    onDrag(0, 0, true)
                } else if (!longPressed) {
                    performClick()
                }
                return true
            }

            MotionEvent.ACTION_CANCEL -> {
                handler.removeCallbacks(longPress)
                isPressed = false
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

    override fun onDetachedFromWindow() {
        handler.removeCallbacks(longPress)
        pulse?.cancel()
        pulse = null
        super.onDetachedFromWindow()
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
}
