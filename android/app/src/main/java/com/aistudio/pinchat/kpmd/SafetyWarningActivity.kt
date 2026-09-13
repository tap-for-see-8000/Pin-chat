package com.aistudio.pinchat.kpmd

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

class SafetyWarningActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.parseColor("#0a0a0a"))
            setPadding(60, 60, 60, 60)
        }
        
        val title = TextView(this).apply {
            text = "Content Safety Warning"
            setTextColor(Color.parseColor("#f43f5e")) // rose-500
            textSize = 24f
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, 40)
        }
        
        val message = TextView(this).apply {
            text = "यह content आपकी current safety settings के अनुसार restricted हो सकता है।"
            setTextColor(Color.WHITE)
            textSize = 16f
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, 80)
        }
        
        val buttonLayout = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, 0)
        }
        
        val closeButton = Button(this).apply {
            text = "Close"
            setBackgroundColor(Color.parseColor("#3f3f46"))
            setTextColor(Color.WHITE)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                setMargins(0, 0, 40, 0)
            }
            setOnClickListener {
                finish()
            }
        }
        
        val goBackButton = Button(this).apply {
            text = "Go Back"
            setBackgroundColor(Color.parseColor("#f43f5e"))
            setTextColor(Color.WHITE)
            setOnClickListener {
                val startMain = Intent(Intent.ACTION_MAIN).apply {
                    addCategory(Intent.CATEGORY_HOME)
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                startActivity(startMain)
                finish()
            }
        }
        
        buttonLayout.addView(closeButton)
        buttonLayout.addView(goBackButton)
        
        layout.addView(title)
        layout.addView(message)
        layout.addView(buttonLayout)
        
        setContentView(layout)
    }
}
