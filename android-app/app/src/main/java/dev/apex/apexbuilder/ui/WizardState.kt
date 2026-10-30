package dev.apex.apexbuilder.ui

import android.net.Uri

/**
 * Mutable form state shared by the three wizard steps.
 * URIs are resolved to bytes in MainActivity when the build starts.
 */
data class WizardState(
    // step 1 — source
    var sourceMode: String = "upload",          // upload | website
    var uploadType: String = "html",            // html | zip
    var sourceUri: Uri? = null,
    var sourceName: String = "",
    var sourceSize: Long = 0L,
    var url: String = "",
    var platform: String = "apk",               // apk | aab
    // step 2 — details
    var iconUri: Uri? = null,
    var appName: String = "",
    var packageSuffix: String = "",
    var appLinksDomain: String = "",
    var googleEnabled: Boolean = false,
    var googleServicesText: String = "",
    var googleClientId: String = "",
    var permissionOn: Map<String, Boolean> = mapOf("internet" to true),
    var dex2c: Boolean = false,
    var stringProtection: Boolean = false,
    var offlineCache: Boolean = false,
    var startupMode: String = "none",           // off | none | custom
    var startupUri: Uri? = null,
    var startupName: String = "",
    var signRelease: Boolean = true,
    var ownerKey: String = "",
) {
    val permissionCount: Int get() = permissionOn.values.count { it }

    fun togglePermission(key: String) {
        permissionOn = permissionOn + (key to !permissionOn[key])
    }

    fun sourceValid(): Boolean =
        sourceMode == "website" && url.isNotBlank() || sourceUri != null
}
