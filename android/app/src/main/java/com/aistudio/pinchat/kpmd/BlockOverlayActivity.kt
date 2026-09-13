package com.aistudio.pinchat.kpmd

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

class BlockOverlayActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        val packageName = intent.getStringExtra("PACKAGE")
        val appName = if (packageName == "com.instagram.android") "Instagram Reels" else "YouTube Shorts"
        
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor("#0a0a0a"))
            setPadding(60, 60, 60, 60)
        }
        
        val title = TextView(this).apply {
            text = "Daily Focus Limit Reached"
            setTextColor(Color.parseColor("#34d399")) // emerald-400
            textSize = 24f
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, 40)
        }
        
        val message = TextView(this).apply {
            text = "आज की $appName limit पूरी हो चुकी है।"
            setTextColor(Color.WHITE)
            textSize = 18f
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, 80)
        }
        
        val backButton = Button(this).apply {
            text = "Go Back"
            setBackgroundColor(Color.parseColor("#34d399"))
            setTextColor(Color.BLACK)
            setOnClickListener {
                val startMain = Intent(Intent.ACTION_MAIN).apply {
                    addCategory(Intent.CATEGORY_HOME)
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                startActivity(startMain)
                finish()
            }
        }
        
        layout.addView(title)
        layout.addView(message)
        layout.addView(backButton)
        
        setContentView(layout)
    }
}
