package mx.est60.grupo1d

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebSettings
import android.view.ViewGroup
import android.graphics.Color
import android.util.Base64
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import com.google.firebase.messaging.FirebaseMessaging
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

class MainActivity : Activity() {
    private lateinit var webView: WebView
    private val prefs by lazy { getSharedPreferences("admin_biometric", MODE_PRIVATE) }
    private val keyAlias = "est60_admin_biometric_key"

    @Suppress("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = Color.rgb(13, 26, 42)
        window.navigationBarColor = Color.rgb(13, 26, 42)

        requestNotificationPermissionIfNeeded()
        FirebaseMessaging.getInstance().subscribeToTopic("1d-est60-all")

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
        webView.webChromeClient = WebChromeClient()
        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView, url: String) {
                super.onPageFinished(view, url)
                view.evaluateJavascript(
                    "(function(){var b=document.getElementById('installAppButton');if(b)b.remove();var h=document.getElementById('installAppHelp');if(h)h.remove();})();",
                    null
                )
                if (url == "file:///android_asset/www/acceso.html") {
                    injectBiometricButton(view)
                }
            }
        }
        setContentView(webView)
        webView.loadUrl("file:///android_asset/www/index.html")
    }

    private fun injectBiometricButton(view: WebView) {
        val script = """
            (function() {
              if (!window.AndroidAdminBiometrics || document.getElementById('adminBiometricButton')) return;
              if (!window.AndroidAdminBiometrics.isBiometricAvailable()) return;
              var form = document.getElementById('programmerLogin');
              if (!form) return;
              var button = document.createElement('button');
              button.type = 'button';
              button.id = 'adminBiometricButton';
              button.textContent = 'Ingresar con huella digital';
              button.style.cssText = 'width:100%;margin-top:12px;padding:13px 16px;border:1px solid #2b5b83;border-radius:10px;background:#102a43;color:#fff;font-weight:700;font-size:15px;cursor:pointer;';
              button.onclick = function() {
                button.disabled = true;
                button.textContent = 'Esperando verificación biométrica…';
                window.AndroidAdminBiometrics.authenticateAdmin();
              };
              form.appendChild(button);
              window.onAdminBiometricResult = function(status, value) {
                button.disabled = false;
                button.textContent = 'Ingresar con huella digital';
                var error = document.getElementById('loginError');
                if (status !== 'success') {
                  if (error) error.textContent = value || 'No se pudo validar la huella. Usa tu contraseña.';
                  return;
                }
                var input = document.getElementById('programmerPassword');
                input.value = value;
                form.requestSubmit();
              };
            })();
        """.trimIndent()
        view.evaluateJavascript(script, null)
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
    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) webView.goBack()
        else super.onBackPressed()
    }
}
