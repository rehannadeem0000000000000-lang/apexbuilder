package dev.apex.apexbuilder.ui

import android.graphics.BitmapFactory
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Android
import androidx.compose.material.icons.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Bolt
import androidx.compose.material.icons.outlined.Camera
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.CloudQueue
import androidx.compose.material.icons.outlined.CropSquare
import androidx.compose.material.icons.outlined.Key
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Mic
import androidx.compose.material.icons.outlined.People
import androidx.compose.material.icons.outlined.PlayArrow
import androidx.compose.material.icons.outlined.Public
import androidx.compose.material.icons.outlined.RocketLaunch
import androidx.compose.material.icons.outlined.SdCard
import androidx.compose.material.icons.outlined.Shield
import androidx.compose.material.icons.outlined.Sms
import androidx.compose.material.icons.outlined.Bluetooth
import androidx.compose.material.icons.outlined.LocationOn
import androidx.compose.material.icons.outlined.Vibration
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import dev.apex.apexbuilder.model.Permissions

@Composable
fun Step2ConfigScreen(
    state: WizardState,
    onState: (WizardState) -> Unit,
    onBack: () -> Unit,
    onBuild: () -> Unit,
    buildBusy: Boolean,
    buildError: String?,
) {
    val context = LocalContext.current

    val pickIcon = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) onState(state.copy(iconUri = uri))
    }
    val pickGoogleServices = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) {
            val text = runCatching {
                context.contentResolver.openInputStream(uri)?.bufferedReader()?.use { it.readText() }
            }.getOrNull()
            if (text != null) onState(state.copy(googleEnabled = true, googleServicesText = text))
        }
    }
    val pickSplash = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) {
            val name = context.uriQueryName(uri) ?: "splash"
            onState(state.copy(startupMode = "custom", startupUri = uri, startupName = name))
        }
    }

    var iconBitmap by remember { mutableStateOf<android.graphics.Bitmap?>(null) }
    LaunchedEffect(state.iconUri) {
        val uri = state.iconUri
        iconBitmap = uri?.let {
            runCatching { context.contentResolver.openInputStream(it)?.use { s -> BitmapFactory.decodeStream(s) } }
                .getOrNull()
        }
    }

    Column(Modifier.fillMaxSize().verticalScroll(), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        SectionHeader("02", "App Details & Options", "Serialized into config.json for the farm")

        // identity
        Card(colors = cardColors(), shape = RoundedCornerShape(14.dp)) {
            Row(Modifier.padding(16.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                Box(
                    modifier = Modifier
                        .size(84.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(Ink900)
                        .border(1.dp, Ink600, RoundedCornerShape(12.dp))
                        .clickable { pickIcon.launch("image/*") },
                    contentAlignment = Alignment.Center,
                ) {
                    val bmp = iconBitmap
                    if (bmp != null) {
                        Image(bmp.asImageBitmap(), "icon", modifier = Modifier.clip(RoundedCornerShape(12.dp)))
                    } else {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Icon(Icons.Outlined.CropSquare, null, tint = Ink300)
                            Text("Upload\nsquare icon", color = Ink300, style = MaterialTheme.typography.labelSmall)
                        }
                    }
                }
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(
                        value = state.appName,
                        onValueChange = { onState(state.copy(appName = it)) },
                        label = { Text("App Name") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        colors = textFieldColors(),
                    )
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .height(56.dp)
                                .background(Ink700, RoundedCornerShape(topStart = 10.dp, bottomStart = 10.dp))
                                .border(1.dp, Ink600, RoundedCornerShape(topStart = 10.dp, bottomStart = 10.dp)),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text("com.", fontFamily = FontFamily.Monospace, color = Ink300, modifier = Modifier.padding(horizontal = 12.dp))
                        }
                        OutlinedTextField(
                            value = state.packageSuffix,
                            onValueChange = { onState(state.copy(packageSuffix = it.lowercase().filter { c -> c.isLetterOrDigit() || c == '_' })) },
                            label = { Text("Package suffix") },
                            placeholder = { Text("myapp") },
                            singleLine = true,
                            modifier = Modifier.weight(1f),
                            colors = textFieldColors(),
                        )
                    }
                    Text(
                        "applicationId → com.${state.packageSuffix.ifEmpty { "myapp" }}",
                        fontFamily = FontFamily.Monospace,
                        style = MaterialTheme.typography.labelSmall,
                        color = Ink300,
                    )
                }
            }
        }

        // advanced
        CollapsibleCard(
            title = "Advanced",
            icon = { Icon(Icons.Outlined.CloudQueue, null) },
            badge = if (state.googleEnabled) "GSI" else null,
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = state.appLinksDomain,
                    onValueChange = { onState(state.copy(appLinksDomain = it)) },
                    label = { Text("App Links domain (optional)") },
                    placeholder = { Text("app.example.com") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    colors = textFieldColors(),
                )
                PermissionRow(
                    label = "Google Sign-In",
                    icon = { Icon(Icons.Outlined.Public, null) },
                    checked = state.googleEnabled,
                    onChecked = { onState(state.copy(googleEnabled = it)) },
                )
                if (state.googleEnabled) {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Button(
                            onClick = { pickGoogleServices.launch("application/json") },
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.buttonColors(containerColor = Ink700, contentColor = Color(0xFFCDD6DF)),
                        ) {
                            Icon(Icons.Outlined.CheckCircle, null)
                            Spacer(Modifier.width(8.dp))
                            Text(
                                if (state.googleServicesText.isNotEmpty()) "google-services.json loaded — replace" else "Upload google-services.json",
                            )
                        }
                        OutlinedTextField(
                            value = state.googleClientId,
                            onValueChange = { onState(state.copy(googleClientId = it)) },
                            label = { Text("…or paste Web Client ID") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            colors = textFieldColors(),
                        )
                    }
                }
            }
        }

        // permissions
        CollapsibleCard(
            title = "Permissions",
            icon = { Icon(Icons.Outlined.Shield, null) },
            defaultOpen = true,
            badge = "${state.permissionCount}/10",
        ) {
            Column {
                Permissions.ALL.forEach { p ->
                    PermissionRow(
                        label = p.label,
                        mono = p.mono,
                        icon = when (p.key) {
                            "internet" -> { Icon(Icons.Outlined.Public, null) }
                            "camera" -> { Icon(Icons.Outlined.Camera, null) }
                            "mic" -> { Icon(Icons.Outlined.Mic, null) }
                            "location" -> { Icon(Icons.Outlined.LocationOn, null) }
                            "storage" -> { Icon(Icons.Outlined.SdCard, null) }
                            "contacts" -> { Icon(Icons.Outlined.People, null) }
                            "sms" -> { Icon(Icons.Outlined.Sms, null) }
                            "bluetooth" -> { Icon(Icons.Outlined.Bluetooth, null) }
                            "vibrate" -> { Icon(Icons.Outlined.Vibration, null) }
                            else -> { Icon(Icons.Outlined.Android, null) }
                        },
                        checked = state.permissionOn[p.key] ?: false,
                        onChecked = { v ->
                            onState(state.copy(permissionOn = state.permissionOn + (p.key to v)))
                        },
                    )
                }
            }
        }

        // protection
        CollapsibleCard(title = "Protection", icon = { Icon(Icons.Outlined.Lock, null) }) {
            Column {
                PermissionRow(
                    label = "Dex2C protection",
                    mono = "r8 fullmode",
                    icon = { Icon(Icons.Outlined.Lock, null) },
                    checked = state.dex2c,
                    onChecked = { onState(state.copy(dex2c = it)) },
                )
                PermissionRow(
                    label = "String protection",
                    mono = "-repackageclasses",
                    icon = { Icon(Icons.Outlined.Lock, null) },
                    checked = state.stringProtection,
                    onChecked = { onState(state.copy(stringProtection = it)) },
                )
            }
        }

        // performance
        Card(colors = cardColors(), shape = RoundedCornerShape(14.dp)) {
            Column(Modifier.padding(16.dp)) {
                Text("Performance", style = MaterialTheme.typography.titleSmall)
                PermissionRow(
                    label = "Cache pages offline",
                    mono = "androidScheme=https",
                    icon = { Icon(Icons.Outlined.Bolt, null) },
                    checked = state.offlineCache,
                    onChecked = { onState(state.copy(offlineCache = it)) },
                )
            }
        }

        // startup
        Card(colors = cardColors(), shape = RoundedCornerShape(14.dp)) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Startup loading", style = MaterialTheme.typography.titleSmall)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("off" to "Off", "none" to "None", "custom" to "Custom").forEach { (v, l) ->
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(10.dp))
                                .background(if (state.startupMode == v) Ink700 else Color.Transparent)
                                .border(1.dp, if (state.startupMode == v) Ink600 else Ink600.copy(alpha = 0.6f), RoundedCornerShape(10.dp))
                                .clickable { onState(state.copy(startupMode = v)) }
                                .padding(vertical = 8.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(l, color = if (state.startupMode == v) ApexGreen else Ink300, style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
                if (state.startupMode == "custom") {
                    Button(
                        onClick = { pickSplash.launch(arrayOf("image/*", "video/mp4")) },
                        modifier = Modifier.fillMaxWidth(),
                        colors = ButtonDefaults.buttonColors(containerColor = Ink700, contentColor = Color(0xFFCDD6DF)),
                    ) {
                        Icon(Icons.Outlined.RocketLaunch, null)
                        Spacer(Modifier.width(8.dp))
                        Text(if (state.startupName.isNotEmpty()) "Replace media — ${state.startupName}" else "Upload MP4 / image")
                    }
                }
            }
        }

        // signing
        Card(colors = cardColors(), shape = RoundedCornerShape(14.dp)) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Signing", style = MaterialTheme.typography.titleSmall)
                PermissionRow(
                    label = "Sign as release build",
                    icon = { Icon(Icons.Outlined.Key, null) },
                    checked = state.signRelease,
                    onChecked = { onState(state.copy(signRelease = it, ownerKey = if (it) state.ownerKey else "")) },
                )
                if (state.signRelease) {
                    OutlinedTextField(
                        value = state.ownerKey,
                        onValueChange = { onState(state.copy(ownerKey = it)) },
                        label = { Text("Owner key") },
                        placeholder = { Text("leave blank → use APEX_KEYSTORE_B64 secret") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        colors = textFieldColors(),
                    )
                }
            }
        }

        buildError?.let {
            Text("⚠ $it", color = Danger, style = MaterialTheme.typography.bodySmall)
        }

        Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Button(
                onClick = onBack,
                modifier = Modifier.weight(1f).height(52.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = Ink700, contentColor = Color(0xFFCDD6DF)),
            ) {
                Icon(Icons.Outlined.ArrowBack, null)
                Spacer(Modifier.width(6.dp))
                Text("Back")
            }
            Button(
                onClick = onBuild,
                enabled = !buildBusy && state.appName.isNotBlank() && state.packageSuffix.isNotBlank(),
                modifier = Modifier.weight(2f).height(52.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(containerColor = ApexGreen, contentColor = Ink950),
            ) {
                Icon(Icons.Outlined.PlayArrow, null)
                Spacer(Modifier.width(8.dp))
                Text(if (buildBusy) "Dispatching…" else "Start Cloud Build", style = MaterialTheme.typography.titleMedium)
            }
        }
        Spacer(Modifier.height(8.dp))
    }
}

@Composable
fun PermissionRow(
    label: String,
    icon: @Composable () -> Unit,
    checked: Boolean,
    onChecked: (Boolean) -> Unit,
    mono: String? = null,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .clickable { onChecked(!checked) }
            .padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon(), null, tint = if (checked) ApexGreen else Ink300, modifier = Modifier.size(18.dp))
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f)) {
            Text(label, style = MaterialTheme.typography.bodyMedium, color = if (checked) Color(0xFFEAF0F6) else Color(0xFFCDD6DF))
            mono?.let {
                Text(
                    it,
                    fontFamily = FontFamily.Monospace,
                    style = MaterialTheme.typography.labelSmall,
                    color = Ink300,
                )
            }
        }
        Switch(
            checked = checked,
            onCheckedChange = onChecked,
            colors = SwitchDefaults.colors(
                checkedTrackColor = ApexGreen,
                checkedThumbColor = Ink950,
                uncheckedTrackColor = Ink600,
                uncheckedThumbColor = Ink300,
            ),
        )
    }
}
