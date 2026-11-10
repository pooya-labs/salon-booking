package com.pooyalabs.salonmanager

import com.pooyalabs.salonmanager.BuildConfig
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

class ApiException(message: String, val status: Int = 0) : IOException(message)

/** Direct native client for the same Apps Script proxy envelope used by the website. */
class SalonApi(
    private val relayUrl: String = BuildConfig.RELAY_URL,
    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(25, TimeUnit.SECONDS)
        .writeTimeout(15, TimeUnit.SECONDS)
        .followRedirects(true)
        .followSslRedirects(true)
        .build()
) {
    fun call(sessionId: String, path: String, method: String = "GET", payload: JSONObject? = null): JSONObject {
        require(path.startsWith("/api/")) { "مسیر درخواست معتبر نیست." }
        if (relayUrl.isBlank()) throw ApiException("آدرس وب‌اپ Google Apps Script تنظیم نشده است.")
        val headers = JSONObject().put("accept", "application/json")
        if (payload != null) headers.put("content-type", "application/json")
        val envelope = JSONObject()
            .put("path", path)
            .put("method", method.uppercase())
            .put("headers", headers)
            .put("body", payload?.toString() ?: JSONObject.NULL)
            .put("sessionId", sessionId)
        val request = Request.Builder()
            .url(relayUrl)
            .post(envelope.toString().toRequestBody("application/json; charset=utf-8".toMediaType()))
            .header("Accept", "application/json")
            .build()

        client.newCall(request).execute().use { response ->
            val responseText = response.body?.string().orEmpty()
            if (!response.isSuccessful) throw ApiException("ارتباط با سرور برقرار نشد (HTTP " + response.code + ").", response.code)
            val outer = try { JSONObject(responseText) } catch (_: Exception) {
                throw ApiException("پاسخ سرور قابل خواندن نیست؛ نسخه Apps Script را به ۱.۵.۵ ارتقا دهید.")
            }
            val status = outer.optInt("status", 502)
            val body = try { JSONObject(outer.optString("body", "{}")) } catch (_: Exception) {
                throw ApiException("ساختار پاسخ سرور معتبر نیست.", status)
            }
            if (status !in 200..299 || body.optBoolean("ok") == false) {
                throw ApiException(body.optString("message").ifBlank { "درخواست انجام نشد." }, status)
            }
            return body
        }
    }

    fun get(session: String, path: String) = call(session, path)
    fun post(session: String, path: String, body: JSONObject) = call(session, path, "POST", body)
    fun put(session: String, path: String, body: JSONObject) = call(session, path, "PUT", body)
    fun patch(session: String, path: String, body: JSONObject) = call(session, path, "PATCH", body)
    fun delete(session: String, path: String) = call(session, path, "DELETE")
}
