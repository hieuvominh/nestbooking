package com.bookingcoo.bridge

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothSocket
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.util.Base64
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.ArrayAdapter
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import java.io.OutputStream
import java.util.UUID

class MainActivity : AppCompatActivity() {
  private val REQUEST_PERMS = 1001
  private val REQUEST_ENABLE_BT = 1002
  private lateinit var webView: WebView
  private val adapter: BluetoothAdapter? by lazy { BluetoothAdapter.getDefaultAdapter() }
  private val prefs by lazy { getSharedPreferences("printer_prefs", Context.MODE_PRIVATE) }
  private val deviceMap = linkedMapOf<String, String>()
  private var pendingPrintBytes: ByteArray? = null
  @Volatile private var isPrinting = false
  private val printLock = Any()

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(R.layout.activity_main)

    webView = findViewById(R.id.webview)
    webView.settings.javaScriptEnabled = true
    webView.settings.domStorageEnabled = true
    webView.settings.allowFileAccess = true
    webView.webViewClient = WebViewClient()
    webView.addJavascriptInterface(PrinterBridge(), "NativePrinter")
    webView.loadUrl(BuildConfig.WEB_URL)
  }

  private fun requiredPermissions(): Array<String> {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      arrayOf(
        Manifest.permission.BLUETOOTH_SCAN,
        Manifest.permission.BLUETOOTH_CONNECT
      )
    } else {
      arrayOf(
        Manifest.permission.ACCESS_FINE_LOCATION,
        Manifest.permission.BLUETOOTH,
        Manifest.permission.BLUETOOTH_ADMIN
      )
    }
  }

  private fun hasRequiredPermissions(): Boolean {
    return requiredPermissions().all { perm ->
      ContextCompat.checkSelfPermission(this, perm) == PackageManager.PERMISSION_GRANTED
    }
  }

  private fun requestRequiredPermissions() {
    ActivityCompat.requestPermissions(this, requiredPermissions(), REQUEST_PERMS)
  }

  private fun ensureBluetoothEnabled(): Boolean {
    val bt = adapter ?: return false
    if (!bt.isEnabled) {
      val intent = Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE)
      startActivityForResult(intent, REQUEST_ENABLE_BT)
      return false
    }
    return true
  }

  private fun savePrinter(mac: String, name: String) {
    prefs.edit().putString("printer_mac", mac).putString("printer_name", name).apply()
  }

  private fun getSavedMac(): String? = prefs.getString("printer_mac", null)
  private fun getSavedName(): String? = prefs.getString("printer_name", null)

  private fun showToast(msg: String) {
    runOnUiThread { Toast.makeText(this, msg, Toast.LENGTH_SHORT).show() }
  }

  @SuppressLint("MissingPermission")
  private fun showDevicePicker() {
    val bt = adapter ?: run {
      showToast("Bluetooth not supported")
      return
    }

    if (!hasRequiredPermissions()) {
      requestRequiredPermissions()
      showToast("Please grant Bluetooth permissions")
      return
    }

    if (!ensureBluetoothEnabled()) {
      showToast("Please enable Bluetooth")
      return
    }

    deviceMap.clear()

    bt.bondedDevices?.forEach { device ->
      deviceMap[device.address] = device.name ?: device.address
    }

    val items = ArrayList<String>()
    deviceMap.forEach { (mac, name) ->
      items.add("$name ($mac)")
    }

    val adapterList = ArrayAdapter(this, android.R.layout.simple_list_item_1, items)

    val dialog = AlertDialog.Builder(this)
      .setTitle("Chon may in")
      .setAdapter(adapterList) { _, which ->
        val entry = deviceMap.entries.elementAt(which)
        savePrinter(entry.key, entry.value)
        showToast("Da chon: ${entry.value}")
        pendingPrintBytes?.let { bytes ->
          pendingPrintBytes = null
          connectAndPrint(entry.key, bytes)
        }
      }
      .setNegativeButton("Huy", null)
      .create()

    val receiver = object : BroadcastReceiver() {
      @SuppressLint("MissingPermission")
      override fun onReceive(context: Context, intent: Intent) {
        if (BluetoothDevice.ACTION_FOUND == intent.action) {
          val device: BluetoothDevice? = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE)
          val mac = device?.address ?: return
          val name = device.name ?: mac
          if (!deviceMap.containsKey(mac)) {
            deviceMap[mac] = name
            adapterList.add("$name ($mac)")
            adapterList.notifyDataSetChanged()
          }
        }
      }
    }

    registerReceiver(receiver, IntentFilter(BluetoothDevice.ACTION_FOUND))

    dialog.setOnDismissListener {
      try {
        unregisterReceiver(receiver)
      } catch (_: Exception) {
      }
      if (bt.isDiscovering) {
        bt.cancelDiscovery()
      }
    }

    dialog.show()

    if (!bt.isDiscovering) {
      bt.startDiscovery()
    }
  }

  private fun connectAndPrint(mac: String, bytes: ByteArray) {
    Thread {
      synchronized(printLock) {
        if (isPrinting) {
          showToast("Dang in, vui long doi")
          return@Thread
        }
        isPrinting = true
      }

      val bt = adapter ?: run {
        showToast("Bluetooth not supported")
        isPrinting = false
        return@Thread
      }

      if (!hasRequiredPermissions()) {
        pendingPrintBytes = bytes
        runOnUiThread { requestRequiredPermissions() }
        showToast("Missing Bluetooth permissions")
        isPrinting = false
        return@Thread
      }

      if (!ensureBluetoothEnabled()) {
        pendingPrintBytes = bytes
        showToast("Please enable Bluetooth")
        isPrinting = false
        return@Thread
      }

      var lastErr: Exception? = null
      for (attempt in 1..3) {
        try {
          val device = bt.getRemoteDevice(mac)
          bt.cancelDiscovery()

          val socket = createSocket(device)
          socket.connect()
          try {
            Thread.sleep(300)
          } catch (_: InterruptedException) {
          }
          socket.outputStream.use { out ->
            writeBytes(out, bytes)
          }
          try {
            Thread.sleep(200)
          } catch (_: InterruptedException) {
          }
          socket.close()
          showToast("In thanh cong")
          isPrinting = false
          return@Thread
        } catch (err: Exception) {
          lastErr = err
          try {
            Thread.sleep(350)
          } catch (_: InterruptedException) {
          }
        }
      }
      showToast("In that bai: ${lastErr?.message ?: "Unknown error"}")
      isPrinting = false
    }.start()
  }

  @SuppressLint("MissingPermission")
  private fun createSocket(device: BluetoothDevice): BluetoothSocket {
    val uuid = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")
    return try {
      device.createRfcommSocketToServiceRecord(uuid)
    } catch (_: Exception) {
      device.createInsecureRfcommSocketToServiceRecord(uuid)
    }
  }

  private fun writeBytes(out: OutputStream, bytes: ByteArray) {
    val chunkSize = 512
    var offset = 0
    while (offset < bytes.size) {
      val end = (offset + chunkSize).coerceAtMost(bytes.size)
      out.write(bytes, offset, end - offset)
      out.flush()
      try {
        Thread.sleep(30)
      } catch (_: InterruptedException) {
      }
      offset = end
    }
  }

  inner class PrinterBridge {
    @JavascriptInterface
    fun isReady(): Boolean {
      return adapter != null
    }

    @JavascriptInterface
    fun pickPrinter(): String {
      runOnUiThread { showDevicePicker() }
      return "OK"
    }

    @JavascriptInterface
    fun print(base64: String): String {
      if (!hasRequiredPermissions()) {
        pendingPrintBytes = try {
          Base64.decode(base64, Base64.DEFAULT)
        } catch (_: Exception) {
          null
        }
        requestRequiredPermissions()
        return "OK"
      }

      if (!ensureBluetoothEnabled()) {
        pendingPrintBytes = try {
          Base64.decode(base64, Base64.DEFAULT)
        } catch (_: Exception) {
          null
        }
        return "ERROR: Bluetooth disabled"
      }

      val bytes = try {
        Base64.decode(base64, Base64.DEFAULT)
      } catch (err: Exception) {
        return "ERROR: Invalid base64 payload"
      }

      val mac = getSavedMac()
      if (mac.isNullOrBlank()) {
        pendingPrintBytes = bytes
        runOnUiThread { showDevicePicker() }
        return "OK"
      }

      connectAndPrint(mac, bytes)
      return "OK"
    }

    @JavascriptInterface
    fun getPrinterInfo(): String {
      val mac = getSavedMac()
      val name = getSavedName()
      if (mac.isNullOrBlank() && name.isNullOrBlank()) {
        return "EMPTY"
      }
      val safeName = name ?: ""
      val safeMac = mac ?: ""
      return "$safeName|$safeMac"
    }
  }

  override fun onRequestPermissionsResult(
    requestCode: Int,
    permissions: Array<out String>,
    grantResults: IntArray
  ) {
    super.onRequestPermissionsResult(requestCode, permissions, grantResults)
    if (requestCode != REQUEST_PERMS) return
    if (grantResults.all { it == PackageManager.PERMISSION_GRANTED }) {
      val bytes = pendingPrintBytes ?: return
      val mac = getSavedMac()
      if (mac.isNullOrBlank()) {
        runOnUiThread { showDevicePicker() }
      } else {
        connectAndPrint(mac, bytes)
      }
      pendingPrintBytes = null
    } else {
      showToast("Bluetooth permissions denied")
    }
  }

  override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
    super.onActivityResult(requestCode, resultCode, data)
    if (requestCode != REQUEST_ENABLE_BT) return
    if (adapter?.isEnabled == true) {
      val bytes = pendingPrintBytes ?: return
      val mac = getSavedMac()
      if (mac.isNullOrBlank()) {
        runOnUiThread { showDevicePicker() }
      } else {
        connectAndPrint(mac, bytes)
      }
      pendingPrintBytes = null
    } else {
      showToast("Bluetooth is still disabled")
    }
  }
}
