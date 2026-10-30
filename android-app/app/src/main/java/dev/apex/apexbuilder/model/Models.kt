package dev.apex.apexbuilder.model

import androidx.compose.ui.graphics.vector.ImageVector
import kotlinx.serialization.Serializable

/* ──────────────── UI permission definitions ──────────────── */

data class PermissionDef(
    val key: String,
    val label: String,
    val mono: String,
    val android: List<String>,
)

object Permissions {
    val INTERNET = PermissionDef("internet", "Internet", "INTERNET", listOf("android.permission.INTERNET"))
    val CAMERA = PermissionDef("camera", "Camera", "CAMERA", listOf("android.permission.CAMERA"))
    val MICROPHONE = PermissionDef("mic", "Microphone", "RECORD_AUDIO", listOf("android.permission.RECORD_AUDIO"))
    val LOCATION = PermissionDef(
        "location", "Location", "ACCESS_FINE_LOCATION",
        listOf("android.permission.ACCESS_FINE_LOCATION", "android.permission.ACCESS_COARSE_LOCATION"),
    )
    val STORAGE = PermissionDef(
        "storage", "Storage", "READ/WRITE_EXTERNAL_STORAGE",
        listOf("android.permission.READ_EXTERNAL_STORAGE", "android.permission.WRITE_EXTERNAL_STORAGE"),
    )
    val CONTACTS = PermissionDef("contacts", "Contacts", "READ_CONTACTS", listOf("android.permission.READ_CONTACTS"))
    val SMS = PermissionDef("sms", "SMS", "SEND_SMS", listOf("android.permission.SEND_SMS"))
    val BLUETOOTH = PermissionDef(
        "bluetooth", "Bluetooth", "BLUETOOTH_CONNECT",
        listOf("android.permission.BLUETOOTH_CONNECT", "android.permission.BLUETOOTH_SCAN"),
    )
    val VIBRATE = PermissionDef("vibrate", "Vibrate", "VIBRATE", listOf("android.permission.VIBRATE"))
    val INSTALL = PermissionDef("install", "Install Unknown Apps", "REQUEST_INSTALL_PACKAGES", listOf("android.permission.REQUEST_INSTALL_PACKAGES"))

    val ALL: List<PermissionDef> = listOf(
        INTERNET, CAMERA, MICROPHONE, LOCATION, STORAGE, CONTACTS, SMS, BLUETOOTH, VIBRATE, INSTALL,
    )
}

/* ──────────────── Build configuration (→ config.json) ──────────────── */

@Serializable
data class BuildConfig(
    val name: String,
    val packageSuffix: String,
    val platform: String = "apk",                       // apk | aab
    val iconBase64: String? = null,
    val iconMime: String? = null,
    val appLinksDomain: String? = null,
    val googleEnabled: Boolean = false,
    val googleServicesJson: String? = null,
    val googleClientId: String? = null,
    val permissions: List<String> = emptyList(),        // full android.permission.* names
    val dex2c: Boolean = false,
    val stringProtection: Boolean = false,
    val offlineCache: Boolean = false,
    val startupMode: String = "none",                   // off | none | custom
    val startupMediaBase64: String? = null,
    val startupMediaName: String? = null,
    val signRelease: Boolean = true,
    val ownerKey: String? = null,
    val url: String? = null,                            // website mode
)

/** What the client pushes to the farm as projects/<id>/config.json */
@Serializable
data class ConfigPayload(
    val project: String,
    val sourceType: String,
    val fileType: String,
    val platform: String,
    val appName: String,
    val appId: String,
    val name: String,
    val packageSuffix: String,
    val iconBase64: String?,
    val iconMime: String?,
    val appLinksDomain: String?,
    val googleEnabled: Boolean,
    val googleServicesJson: String?,
    val googleClientId: String?,
    val permissions: List<String>,
    val dex2c: Boolean,
    val stringProtection: Boolean,
    val offlineCache: Boolean,
    val startupMode: String,
    val startupMediaBase64: String?,
    val startupMediaName: String?,
    val signRelease: Boolean,
    val ownerKey: String?,
    val url: String?,
) {
    companion object {
        fun create(projectId: String, fileType: String, cfg: BuildConfig) = ConfigPayload(
            project = projectId,
            sourceType = if (cfg.url != null) "website" else "upload",
            fileType = fileType,
            platform = cfg.platform,
            appName = cfg.name,
            appId = "com.${cfg.packageSuffix}",
            name = cfg.name,
            packageSuffix = cfg.packageSuffix,
            iconBase64 = cfg.iconBase64,
            iconMime = cfg.iconMime,
            appLinksDomain = cfg.appLinksDomain,
            googleEnabled = cfg.googleEnabled,
            googleServicesJson = cfg.googleServicesJson,
            googleClientId = cfg.googleClientId,
            permissions = cfg.permissions,
            dex2c = cfg.dex2c,
            stringProtection = cfg.stringProtection,
            offlineCache = cfg.offlineCache,
            startupMode = cfg.startupMode,
            startupMediaBase64 = cfg.startupMediaBase64,
            startupMediaName = cfg.startupMediaName,
            signRelease = cfg.signRelease,
            ownerKey = cfg.ownerKey,
            url = cfg.url,
        )
    }
}

/* ──────────────── GitHub REST DTOs ──────────────── */

@Serializable data class RepoInfo(val default_branch: String = "main")

@Serializable data class ContentInfo(val sha: String? = null)

@Serializable
data class UploadBody(
    val message: String,
    val content: String,   // base64
    val branch: String,
    val sha: String? = null,
)

@Serializable
data class DispatchBody(val ref: String, val inputs: Map<String, String>)

@Serializable
data class RunInfo(
    val id: Long,
    val status: String,
    val conclusion: String? = null,
    val run_started_at: String? = null,
    val created_at: String = "",
    val html_url: String = "",
)

@Serializable data class RunList(val workflow_runs: List<RunInfo> = emptyList())

@Serializable data class StepInfo(val name: String, val status: String, val conclusion: String? = null)

@Serializable
data class JobInfo(
    val id: Long,
    val name: String,
    val status: String,
    val conclusion: String? = null,
    val steps: List<StepInfo> = emptyList(),
)

@Serializable data class JobList(val jobs: List<JobInfo> = emptyList())

@Serializable
data class ArtifactInfo(
    val id: Long,
    val name: String,
    val size_in_bytes: Long,
    val archive_download_url: String = "",
)

@Serializable data class ArtifactList(val artifacts: List<ArtifactInfo> = emptyList())

@Serializable data class WhoAmI(val login: String)
