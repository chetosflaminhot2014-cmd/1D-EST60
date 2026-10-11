package mx.est60.grupo1d

import android.Manifest
import android.app.Activity
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.pm.PackageManager
import androidx.core.app.NotificationCompat
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.ValueCallback
import android.webkit.WebSettings
import android.view.ViewGroup
import android.graphics.Color
import android.util.Base64
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import com.google.firebase.messaging.FirebaseMessaging
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONObject

class MainActivity : FragmentActivity() {
    private lateinit var webView: WebView
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private val fileChooserRequestCode = 1002
    private val prefs by lazy { getSharedPreferences("admin_biometric", MODE_PRIVATE) }
    private val keyAlias = "est60_admin_biometric_key"

    @Suppress("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = Color.rgb(13, 26, 42)
        window.navigationBarColor = Color.rgb(13, 26, 42)

        requestNotificationPermissionIfNeeded()
        FirebaseMessaging.getInstance().subscribeToTopic("1d-est60-all")
        checkForAppUpdate()

        webView = WebView(this)
        webView.layoutParams = ViewGroup.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        )
        webView.setBackgroundColor(Color.WHITE)
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = true
            allowContentAccess = true
            javaScriptCanOpenWindowsAutomatically = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            @Suppress("DEPRECATION")
            allowFileAccessFromFileURLs = true
            @Suppress("DEPRECATION")
            allowUniversalAccessFromFileURLs = true
        }
        webView.addJavascriptInterface(AdminBiometricBridge(), "AndroidAdminBiometrics")
        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                view: WebView,
                filePathCallback: ValueCallback<Array<Uri>>,
                fileChooserParams: FileChooserParams
            ): Boolean {
                this@MainActivity.filePathCallback?.onReceiveValue(null)
                this@MainActivity.filePathCallback = filePathCallback
                val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "image/*"
                }
                return try {
                    startActivityForResult(
                        Intent.createChooser(intent, "Selecciona tu foto de perfil"),
                        fileChooserRequestCode
                    )
                    true
                } catch (_: Exception) {
                    this@MainActivity.filePathCallback?.onReceiveValue(null)
                    this@MainActivity.filePathCallback = null
                    false
                }
            }
        }
        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView, url: String) {
                super.onPageFinished(view, url)
                view.evaluateJavascript(
                    "(function(){var b=document.getElementById('installAppButton');if(b)b.remove();var h=document.getElementById('installAppHelp');if(h)h.remove();var ids=['chatAuthPanel','chatRoomPanel'];ids.forEach(function(id){var e=document.getElementById(id);if(e){var p=e.closest('section,article,.card')||e;p.style.display='none';}});Array.from(document.querySelectorAll('a,button,[role=button]')).forEach(function(e){var t=(e.innerText||e.textContent||'').trim();if(/^(chat|chat grupal|credencial|mi credencial|solicitar credencial)$/i.test(t)){e.style.display='none';}});})();",
                    null
                )
            }
        }
        setContentView(webView)
        webView.loadUrl("file:///android_asset/www/index.html")
    }


    private fun checkForAppUpdate() {
        Thread {
            var connection: HttpURLConnection? = null
            try {
                connection = (URL("https://github.com/chetosflaminhot2014-cmd/1D-EST60/releases/download/latest/version.json").openConnection() as HttpURLConnection).apply {
                    requestMethod = "GET"
                    connectTimeout = 8000
                    readTimeout = 8000
                    setRequestProperty("Cache-Control", "no-cache")
                }
                if (connection.responseCode != HttpURLConnection.HTTP_OK) return@Thread
                val payload = connection.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
                val remoteVersion = JSONObject(payload).optInt("versionCode", 0)
                if (remoteVersion <= BuildConfig.VERSION_CODE) return@Thread

                val updatePrefs = getSharedPreferences("app_updates", MODE_PRIVATE)
                if (updatePrefs.getInt("last_notified_version", 0) >= remoteVersion) return@Thread
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                    checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
                ) return@Thread

                runOnUiThread {
                    val channelId = "app_updates_1d_est60"
                    val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        manager.createNotificationChannel(
                            NotificationChannel(channelId, "Actualizaciones de la app", NotificationManager.IMPORTANCE_HIGH).apply {
                                description = "Avisos cuando hay una nueva versión de 1°D EST60"
                            }
                        )
                    }
                    val downloadUrl = "https://github.com/chetosflaminhot2014-cmd/1D-EST60/releases/download/latest/1D-EST60.apk"
                    val openDownload = Intent(Intent.ACTION_VIEW, Uri.parse(downloadUrl))
                    val pendingIntent = PendingIntent.getActivity(
                        this, 2002, openDownload,
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                    )
                    val notification = NotificationCompat.Builder(this, channelId)
                        .setSmallIcon(applicationInfo.icon)
                        .setContentTitle("Actualización disponible")
                        .setContentText("La app 1°D EST60 tiene una nueva versión. Toca para descargarla.")
                        .setStyle(NotificationCompat.BigTextStyle().bigText("Hay una versión nueva de 1°D EST60. Toca esta notificación para descargar el APK actualizado."))
                        .setContentIntent(pendingIntent)
                        .setAutoCancel(true)
                        .setPriority(NotificationCompat.PRIORITY_HIGH)
                        .build()
                    manager.notify(2002, notification)
                    updatePrefs.edit().putInt("last_notified_version", remoteVersion).apply()
                }
            } catch (_: Exception) {
                // Sin conexión o sin publicación: la app sigue funcionando normalmente.
            } finally {
                connection?.disconnect()
            }
        }.start()
    }

    private fun biometricAvailable(): Boolean {
        return BiometricManager.from(this)
            .canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_WEAK) == BiometricManager.BIOMETRIC_SUCCESS
    }

    private fun getOrCreateSecretKey(): SecretKey {
        val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (keyStore.getKey(keyAlias, null) as? SecretKey)?.let { return it }
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore")
        generator.init(
            KeyGenParameterSpec.Builder(
                keyAlias,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build()
        )
        return generator.generateKey()
    }

    private fun saveEncryptedPassword(password: String) {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding")
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateSecretKey())
        val encrypted = cipher.doFinal(password.toByteArray(Charsets.UTF_8))
        prefs.edit()
            .putString("iv", Base64.encodeToString(cipher.iv, Base64.NO_WRAP))
            .putString("password", Base64.encodeToString(encrypted, Base64.NO_WRAP))
            .apply()
    }

    private fun readEncryptedPassword(): String? {
        val ivText = prefs.getString("iv", null) ?: return null
        val encryptedText = prefs.getString("password", null) ?: return null
        return try {
            val cipher = Cipher.getInstance("AES/GCM/NoPadding")
            cipher.init(
                Cipher.DECRYPT_MODE,
                getOrCreateSecretKey(),
                GCMParameterSpec(128, Base64.decode(ivText, Base64.NO_WRAP))
            )
            String(cipher.doFinal(Base64.decode(encryptedText, Base64.NO_WRAP)), Charsets.UTF_8)
        } catch (_: Exception) {
            prefs.edit().clear().apply()
            null
        }
    }

    private fun callJsConfigured(status: String, value: String) {
        val safeStatus = org.json.JSONObject.quote(status)
        val safeValue = org.json.JSONObject.quote(value)
        runOnUiThread {
            if (::webView.isInitialized) {
                webView.evaluateJavascript(
                    "if(window.onAdminBiometricConfigured)window.onAdminBiometricConfigured($safeStatus,$safeValue);",
                    null
                )
            }
        }
    }

    private fun callJsResult(status: String, value: String) {
        val safeStatus = org.json.JSONObject.quote(status)
        val safeValue = org.json.JSONObject.quote(value)
        runOnUiThread {
            if (::webView.isInitialized) {
                webView.evaluateJavascript(
                    "if(window.onAdminBiometricResult)window.onAdminBiometricResult($safeStatus,$safeValue);",
                    null
                )
            }
        }
    }

    private inner class AdminBiometricBridge {
        @JavascriptInterface
        fun isBiometricAvailable(): Boolean = biometricAvailable()

        @JavascriptInterface
        fun saveAdminPassword(password: String) {
            if (password.isNotBlank() && password.length <= 512) {
                try {
                    saveEncryptedPassword(password)
                } catch (_: Exception) {
                    // The password login still works if secure local storage is unavailable.
                }
            }
        }

        @JavascriptInterface
        fun configureAdminBiometrics(password: String) {
            runOnUiThread {
                if (password.isBlank() || password.length > 512) {
                    callJsConfigured("error", "Vuelve a iniciar sesión con tu contraseña y prueba otra vez.")
                    return@runOnUiThread
                }
                if (!biometricAvailable()) {
                    callJsConfigured("error", "No hay huella configurada en Android. Regístrala en Ajustes y vuelve a intentarlo.")
                    return@runOnUiThread
                }
                val prompt = BiometricPrompt(
                    this@MainActivity,
                    ContextCompat.getMainExecutor(this@MainActivity),
                    object : BiometricPrompt.AuthenticationCallback() {
                        override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                            super.onAuthenticationSucceeded(result)
                            try {
                                saveEncryptedPassword(password)
                                callJsConfigured("success", "Huella configurada correctamente en este dispositivo.")
                            } catch (_: Exception) {
                                callJsConfigured("error", "No se pudo guardar el acceso biométrico. Usa tu contraseña.")
                            }
                        }

                        override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                            super.onAuthenticationError(errorCode, errString)
                            callJsConfigured("error", errString.toString())
                        }

                        override fun onAuthenticationFailed() {
                            super.onAuthenticationFailed()
                            callJsConfigured("error", "Huella no reconocida. Inténtalo de nuevo.")
                        }
                    }
                )
                val info = BiometricPrompt.PromptInfo.Builder()
                    .setTitle("Configurar huella digital")
                    .setSubtitle("Confirma tu identidad para habilitar el acceso de administrador")
                    .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_WEAK)
                    .setNegativeButtonText("Cancelar")
                    .build()
                prompt.authenticate(info)
            }
        }

        @JavascriptInterface
        fun authenticateAdmin() {
            runOnUiThread {
                val savedPassword = try { readEncryptedPassword() } catch (_: Exception) { null }
                if (savedPassword.isNullOrBlank()) {
                    callJsResult("error", "Primero inicia sesión con tu contraseña para habilitar la huella.")
                    return@runOnUiThread
                }
                if (!biometricAvailable()) {
                    callJsResult("error", "Este dispositivo no tiene biometría disponible. Usa tu contraseña.")
                    return@runOnUiThread
                }
                val prompt = BiometricPrompt(
                    this@MainActivity,
                    ContextCompat.getMainExecutor(this@MainActivity),
                    object : BiometricPrompt.AuthenticationCallback() {
                        override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                            super.onAuthenticationSucceeded(result)
                            callJsResult("success", savedPassword)
                        }

                        override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                            super.onAuthenticationError(errorCode, errString)
                            callJsResult("error", errString.toString())
                        }

                        override fun onAuthenticationFailed() {
                            super.onAuthenticationFailed()
                            callJsResult("error", "Huella no reconocida. Inténtalo de nuevo.")
                        }
                    }
                )
                val info = BiometricPrompt.PromptInfo.Builder()
                    .setTitle("Acceso de administrador")
                    .setSubtitle("Confirma tu identidad para continuar")
                    .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_WEAK)
                    .setNegativeButtonText("Cancelar")
                    .build()
                prompt.authenticate(info)
            }
        }
    }

    private fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1001)
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == fileChooserRequestCode) {
            val callback = filePathCallback ?: return
            filePathCallback = null
            val results = WebChromeClient.FileChooserParams.parseResult(resultCode, data)
            callback.onReceiveValue(results)
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) webView.goBack()
        else super.onBackPressed()
    }
}
