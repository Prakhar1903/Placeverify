package com.placementalarm

import android.annotation.SuppressLint
import android.app.KeyguardManager
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.view.animation.OvershootInterpolator
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity

class AlarmActivity : AppCompatActivity() {

    private var mediaPlayer: MediaPlayer? = null
    private var vibrator: Vibrator? = null
    private var driveId: String = ""
    private var stage: Int = 1
    private var customAlarmId: String = ""
    private var isActionTriggered = false

    @SuppressLint("ClickableViewAccessibility")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Allow showing over lockscreen and wake up display
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
            val keyguardManager = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
            keyguardManager.requestDismissKeyguard(this, null)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            )
        }

        setContentView(R.layout.activity_alarm)

        driveId = intent.getStringExtra("DRIVE_ID") ?: ""
        val companyName = intent.getStringExtra("COMPANY_NAME") ?: "Company Drive"
        val deadlineFormatted = intent.getStringExtra("DEADLINE_FORMATTED") ?: ""
        var packageInfo = intent.getStringExtra("PACKAGE_INFO") ?: ""
        val rawText = intent.getStringExtra("RAW_TEXT") ?: ""
        stage = intent.getIntExtra("ALARM_STAGE", 1)
        customAlarmId = intent.getStringExtra("CUSTOM_ALARM_ID") ?: ""
        val stageTitle = intent.getStringExtra("STAGE_TITLE") ?: "CUSTOM ALARM"

        val layoutAlarmHalo = findViewById<FrameLayout>(R.id.layoutAlarmHalo)
        val ivAlarmIcon = findViewById<ImageView>(R.id.ivAlarmIcon)
        val tvStageBanner = findViewById<TextView>(R.id.tvStageBanner)
        val tvCompany = findViewById<TextView>(R.id.tvCompanyName)
        val tvPackageBadge = findViewById<TextView>(R.id.tvPackageBadge)
        val tvDeadline = findViewById<TextView>(R.id.tvDeadlineInfo)
        val tvRaw = findViewById<TextView>(R.id.tvRawDescription)
        val layoutRawCard = findViewById<LinearLayout>(R.id.layoutRawCard)

        val layoutSliderContainer = findViewById<FrameLayout>(R.id.layoutSliderContainer)
        val tvSliderLeftLabel = findViewById<TextView>(R.id.tvSliderLeftLabel)
        val tvSliderRightLabel = findViewById<TextView>(R.id.tvSliderRightLabel)
        val layoutSliderThumb = findViewById<FrameLayout>(R.id.layoutSliderThumb)
        val ivThumbIcon = findViewById<ImageView>(R.id.ivThumbIcon)
        val btnOpenPortal = findViewById<View>(R.id.btnOpenPortal)

        tvCompany.text = companyName
        tvDeadline.text = if (deadlineFormatted.isNotBlank()) deadlineFormatted else "Deadline Pending"
        if (rawText.isNotBlank()) {
            tvRaw.text = rawText
            layoutRawCard.visibility = View.VISIBLE
        } else {
            layoutRawCard.visibility = View.GONE
        }

        // Package / LPA resolution with fallback (no emojis)
        if (packageInfo.isBlank() && rawText.isNotBlank()) {
            packageInfo = DeadlineParser.extractPackage(rawText) ?: ""
        }
        if (packageInfo.isBlank() && driveId.isNotBlank()) {
            val drive = DriveStorage.getAllDrives(this).find { it.id == driveId }
            packageInfo = drive?.packageInfo ?: ""
        }

        if (packageInfo.isNotBlank()) {
            tvPackageBadge.visibility = View.VISIBLE
            val cleanPkg = packageInfo.replace("💰", "").replace("₹", "").trim()
            tvPackageBadge.text = "₹ $cleanPkg"
        } else {
            tvPackageBadge.visibility = View.GONE
        }

        // Configure UI based on alarm stage
        if (stage == 1) {
            ivAlarmIcon.setImageResource(R.drawable.ic_alarm_bell)
            layoutAlarmHalo.setBackgroundResource(R.drawable.bg_alarm_icon_halo)
            tvStageBanner.text = if (stageTitle.isNotBlank() && stageTitle != "CUSTOM ALARM") stageTitle.uppercase() else "STAGE 1 WARNING"
            tvStageBanner.setBackgroundResource(R.drawable.bg_stage_banner)
            tvStageBanner.setTextColor(0xFFFDE68A.toInt())
        } else if (stage == 2) {
            ivAlarmIcon.setImageResource(R.drawable.ic_alarm_urgent)
            layoutAlarmHalo.setBackgroundResource(R.drawable.bg_alarm_icon_halo_urgent)
            tvStageBanner.text = if (stageTitle.isNotBlank() && stageTitle != "CUSTOM ALARM") stageTitle.uppercase() else "FINAL NOTICE"
            tvStageBanner.setBackgroundResource(R.drawable.bg_stage_banner_urgent)
            tvStageBanner.setTextColor(0xFFFCA5A5.toInt())
        } else {
            ivAlarmIcon.setImageResource(R.drawable.ic_alarm_bell)
            layoutAlarmHalo.setBackgroundResource(R.drawable.bg_alarm_icon_halo)
            tvStageBanner.text = stageTitle.uppercase()
            tvStageBanner.setBackgroundResource(R.drawable.bg_stage_banner)
            tvStageBanner.setTextColor(0xFFBAE6FD.toInt())
        }

        startBellAnimation(ivAlarmIcon)

        // Horizontal Dual-Action Slider Setup
        var initialTouchX = 0f
        var hasHapticThresholdPassed = false

        layoutSliderThumb.setOnTouchListener { _, event ->
            if (isActionTriggered) return@setOnTouchListener false

            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    initialTouchX = event.rawX
                    hasHapticThresholdPassed = false
                    layoutSliderThumb.animate().cancel()
                    ivThumbIcon.animate().cancel()
                    tvSliderLeftLabel.animate().cancel()
                    tvSliderRightLabel.animate().cancel()
                    true
                }

                MotionEvent.ACTION_MOVE -> {
                    val deltaX = event.rawX - initialTouchX
                    val containerWidth = layoutSliderContainer.width
                    val thumbWidth = layoutSliderThumb.width
                    val maxSlide = ((containerWidth - thumbWidth) / 2f).coerceAtLeast(100f)
                    val targetX = deltaX.coerceIn(-maxSlide, maxSlide)
                    layoutSliderThumb.translationX = targetX

                    val threshold = maxSlide * 0.50f
                    if (targetX >= threshold || targetX <= -threshold) {
                        if (!hasHapticThresholdPassed) {
                            layoutSliderThumb.performHapticFeedback(android.view.HapticFeedbackConstants.KEYBOARD_TAP)
                            hasHapticThresholdPassed = true
                        }
                    } else {
                        hasHapticThresholdPassed = false
                    }

                    val progress = targetX / maxSlide // -1.0 to 1.0

                    if (progress > 0) {
                        // Sliding right towards Snooze
                        val ratio = progress.coerceIn(0f, 1f)
                        tvSliderRightLabel.alpha = 0.85f + 0.15f * ratio
                        tvSliderRightLabel.scaleX = 1f + 0.10f * ratio
                        tvSliderRightLabel.scaleY = 1f + 0.10f * ratio

                        tvSliderLeftLabel.alpha = (0.85f - ratio * 0.75f).coerceAtLeast(0.1f)
                        tvSliderLeftLabel.scaleX = 1f
                        tvSliderLeftLabel.scaleY = 1f

                        ivThumbIcon.rotation = ratio * 15f
                    } else if (progress < 0) {
                        // Sliding left towards Cancel All
                        val ratio = (-progress).coerceIn(0f, 1f)
                        tvSliderLeftLabel.alpha = 0.85f + 0.15f * ratio
                        tvSliderLeftLabel.scaleX = 1f + 0.10f * ratio
                        tvSliderLeftLabel.scaleY = 1f + 0.10f * ratio

                        tvSliderRightLabel.alpha = (0.85f - ratio * 0.75f).coerceAtLeast(0.1f)
                        tvSliderRightLabel.scaleX = 1f
                        tvSliderRightLabel.scaleY = 1f

                        ivThumbIcon.rotation = -ratio * 15f
                    } else {
                        tvSliderRightLabel.alpha = 0.85f
                        tvSliderLeftLabel.alpha = 0.85f
                        tvSliderRightLabel.scaleX = 1f
                        tvSliderLeftLabel.scaleX = 1f
                        ivThumbIcon.rotation = 0f
                    }
                    true
                }

                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                    val containerWidth = layoutSliderContainer.width
                    val thumbWidth = layoutSliderThumb.width
                    val maxSlide = ((containerWidth - thumbWidth) / 2f).coerceAtLeast(100f)
                    val currentX = layoutSliderThumb.translationX
                    val threshold = maxSlide * 0.50f

                    if (currentX >= threshold) {
                        // Completed Slide Right -> Snooze
                        isActionTriggered = true
                        vibrateBriefly()
                        layoutSliderThumb.animate()
                            .translationX(maxSlide)
                            .setDuration(120)
                            .withEndAction { handleSnooze() }
                            .start()
                    } else if (currentX <= -threshold) {
                        // Completed Slide Left -> Cancel All
                        isActionTriggered = true
                        vibrateBriefly()
                        layoutSliderThumb.animate()
                            .translationX(-maxSlide)
                            .setDuration(120)
                            .withEndAction { handleCancelAll() }
                            .start()
                    } else {
                        // Snap back smoothly to center
                        layoutSliderThumb.animate()
                            .translationX(0f)
                            .setDuration(220)
                            .setInterpolator(OvershootInterpolator(1.2f))
                            .start()

                        ivThumbIcon.animate().rotation(0f).setDuration(180).start()

                        tvSliderLeftLabel.animate()
                            .alpha(0.85f)
                            .scaleX(1f)
                            .scaleY(1f)
                            .setDuration(180)
                            .start()

                        tvSliderRightLabel.animate()
                            .alpha(0.85f)
                            .scaleX(1f)
                            .scaleY(1f)
                            .setDuration(180)
                            .start()
                    }
                    true
                }

                else -> false
            }
        }

        // Open portal directly
        btnOpenPortal.setOnClickListener {
            stopAlarm()
            if (driveId.isNotEmpty()) {
                DriveStorage.dismissStageAlarm(this, driveId, stage)
                PlacementAlarmModule.notifyDrivesUpdated()
            }
            try {
                val browserIntent = Intent(Intent.ACTION_VIEW, Uri.parse("https://ums.lpu.in"))
                startActivity(browserIntent)
            } catch (e: Exception) {
                e.printStackTrace()
            }
            finish()
        }

        startAlarmSound()
    }

    private fun handleSnooze() {
        stopAlarm()
        if (driveId.isNotEmpty()) {
            if (stage == 1 || stage == 2) {
                DriveStorage.dismissStageAlarm(this, driveId, stage)
            } else if (customAlarmId.isNotEmpty()) {
                DriveStorage.cancelIndividualAlarm(this, driveId, customAlarmId)
            }
            PlacementAlarmModule.notifyDrivesUpdated()
        }
        if (stage == 1) {
            Toast.makeText(this, "Alarm snoozed! The 1-hour alarm will still ring.", Toast.LENGTH_LONG).show()
        } else {
            Toast.makeText(this, "Alarm snoozed.", Toast.LENGTH_SHORT).show()
        }
        finish()
    }

    private fun handleCancelAll() {
        stopAlarm()
        if (driveId.isNotEmpty()) {
            AlarmScheduler.cancelAlarm(this, driveId)
            DriveStorage.dismissAllAlarms(this, driveId)
            PlacementAlarmModule.notifyDrivesUpdated()
        }
        Toast.makeText(this, "All alarms for this company have been cancelled.", Toast.LENGTH_LONG).show()
        finish()
    }

    private fun vibrateBriefly() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator?.vibrate(VibrationEffect.createOneShot(80, VibrationEffect.DEFAULT_AMPLITUDE))
            } else {
                @Suppress("DEPRECATION")
                vibrator?.vibrate(80)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun startAlarmSound() {
        try {
            var alarmUri: Uri? = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            if (alarmUri == null) {
                alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
            }

            mediaPlayer = MediaPlayer().apply {
                setDataSource(applicationContext, alarmUri!!)
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                isLooping = true
                prepare()
                start()
            }

            vibrator = getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            val pattern = longArrayOf(0, 1000, 500, 1000, 500)
            @Suppress("DEPRECATION")
            vibrator?.vibrate(pattern, 0)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun stopAlarm() {
        try {
            mediaPlayer?.stop()
            mediaPlayer?.release()
            mediaPlayer = null
            vibrator?.cancel()

            val notificationManager =
                getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (driveId.isNotEmpty()) {
                notificationManager.cancel(driveId.hashCode() + 100)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private var bellAnimator: android.animation.AnimatorSet? = null

    private fun startBellAnimation(ivAlarmIcon: ImageView) {
        ivAlarmIcon.post {
            ivAlarmIcon.pivotX = ivAlarmIcon.width / 2f
            ivAlarmIcon.pivotY = 0f

            val r1 = android.animation.ObjectAnimator.ofFloat(ivAlarmIcon, "rotation", 0f, -14f).setDuration(120)
            val r2 = android.animation.ObjectAnimator.ofFloat(ivAlarmIcon, "rotation", -14f, 14f).setDuration(240)
            val r3 = android.animation.ObjectAnimator.ofFloat(ivAlarmIcon, "rotation", 14f, -8f).setDuration(180)
            val r4 = android.animation.ObjectAnimator.ofFloat(ivAlarmIcon, "rotation", -8f, 0f).setDuration(120)
            val pause = android.animation.ValueAnimator.ofFloat(0f, 1f).setDuration(900)

            val set = android.animation.AnimatorSet()
            set.playSequentially(r1, r2, r3, r4, pause)
            set.addListener(object : android.animation.AnimatorListenerAdapter() {
                override fun onAnimationEnd(animation: android.animation.Animator) {
                    if (!isFinishing && !isDestroyed) {
                        set.start()
                    }
                }
            })
            set.start()
            bellAnimator = set
        }
    }

    override fun onDestroy() {
        bellAnimator?.cancel()
        stopAlarm()
        super.onDestroy()
    }
}
