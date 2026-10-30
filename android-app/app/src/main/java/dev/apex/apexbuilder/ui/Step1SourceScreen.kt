package dev.apex.apexbuilder.ui

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Description
import androidx.compose.material.icons.outlined.FileUpload
import androidx.compose.material.icons.outlined.Public
import androidx.compose.material.icons.outlined.Zip
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.material.icons.outlined.KeyboardArrowDown

@Composable
fun Step1SourceScreen(
    state: WizardState,
    onState: (WizardState) -> Unit,
    onContinue: () -> Unit,
) {
    val context = LocalContext.current
    var platformMenu by remember { mutableStateOf(false) }
    var pickedError by remember { mutableStateOf<String?>(null) }

    val pickFile = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        pickedError = null
        if (uri == null) return@rememberLauncherForActivityResult
        val name = context.uriQueryName(uri) ?: "selection.bin"
        onState(
            state.copy(
                sourceUri = uri,
                sourceName = name,
                sourceSize = context.uriQuerySize(uri),
                uploadType = if (name.lowercase().endsWith(".zip")) "zip" else "html",
            ),
        )
    }

    Column(Modifier.fillMaxSize().padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        SectionHeader("01", "Source Selection", "Where does the web project come from?")

        Card(colors = cardColors(), shape = RoundedCornerShape(14.dp)) {
            Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                Text("Source", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    SegmentedOption(
                        selected = state.sourceMode == "upload",
                        label = "Upload",
                        icon = { Icon(Icons.Outlined.FileUpload, null) },
                        onClick = { onState(state.copy(sourceMode = "upload")) },
                    )
                    SegmentedOption(
                        selected = state.sourceMode == "website",
                        label = "Website",
                        icon = { Icon(Icons.Outlined.Public, null) },
                        onClick = { onState(state.copy(sourceMode = "website")) },
                    )
                }

                if (state.sourceMode == "upload") {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        SegmentedOption(
                            selected = state.uploadType == "html",
                            label = "HTML file",
                            icon = { Icon(Icons.Outlined.Description, null) },
                            onClick = { onState(state.copy(uploadType = "html", sourceUri = null, sourceName = "")) },
                        )
                        SegmentedOption(
                            selected = state.uploadType == "zip",
                            label = "ZIP project",
                            icon = { Icon(Icons.Outlined.Zip, null) },
                            onClick = { onState(state.copy(uploadType = "zip", sourceUri = null, sourceName = "")) },
                        )
                    }

                    if (state.sourceUri != null) {
                        Card(
                            colors = CardDefaults.cardColors(containerColor = ApexGreen.copy(alpha = 0.08f)),
                            border = BorderStroke(1.dp, ApexGreen.copy(alpha = 0.4f)),
                            shape = RoundedCornerShape(10.dp),
                        ) {
                            Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    if (state.uploadType == "zip") Icons.Outlined.Zip else Icons.Outlined.Description,
                                    null,
                                    tint = ApexGreen,
                                )
                                Spacer(Modifier.width(12.dp))
                                Column {
                                    Text(state.sourceName, style = MaterialTheme.typography.bodyMedium)
                                    Text(
                                        "${formatBytes(state.sourceSize)} · Storage Access Framework",
                                        style = MaterialTheme.typography.bodySmall,
                                        color = Ink300,
                                        fontFamily = FontFamily.Monospace,
                                    )
                                }
                            }
                        }
                    }
                    pickedError?.let { Text(it, color = Danger, style = MaterialTheme.typography.bodySmall) }

                    OutlinedButton(
                        onClick = {
                            val mimes = if (state.uploadType == "zip") listOf("application/zip")
                            else listOf("text/html", "application/xhtml+xml")
                            pickFile.launch(mimes)
                        },
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Icon(Icons.Outlined.FileUpload, null)
                        Spacer(Modifier.width(8.dp))
                        Text("Choose ${if (state.uploadType == "zip") "ZIP" else "HTML"} file")
                    }
                } else {
                    OutlinedTextField(
                        value = state.url,
                        onValueChange = { onState(state.copy(url = it)) },
                        label = { Text("Website URL") },
                        placeholder = { Text("https://example.com") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        colors = textFieldColors(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                    )
                    Text(
                        "The wrapper loads this URL inside the WebView. Enable “Cache pages offline” next.",
                        style = MaterialTheme.typography.bodySmall,
                        color = Ink300,
                    )
                }
            }
        }

        Card(colors = cardColors(), shape = RoundedCornerShape(14.dp)) {
            Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Platform", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    OutlinedTextField(
                        value = if (state.platform == "apk") "Android — APK (installable)" else "Android — AAB (Play Store)",
                        onValueChange = {},
                        readOnly = true,
                        trailingIcon = {
                            IconButton(onClick = { platformMenu = true }) {
                                Icon(Icons.Outlined.KeyboardArrowDown, null, tint = Ink300)
                            }
                        },
                        modifier = Modifier.weight(1f),
                        colors = textFieldColors(),
                    )
                    DropdownMenu(expanded = platformMenu, onDismissRequest = { platformMenu = false }) {
                        DropdownMenuItem(
                            text = { Text("Android — APK (installable)") },
                            onClick = { onState(state.copy(platform = "apk")); platformMenu = false },
                        )
                        DropdownMenuItem(
                            text = { Text("Android — AAB (Play Store bundle)") },
                            onClick = { onState(state.copy(platform = "aab")); platformMenu = false },
                        )
                    }
                }
            }
        }

        Spacer(Modifier.weight(1f))

        Button(
            onClick = onContinue,
            enabled = state.sourceMode == "website" || state.sourceUri != null,
            modifier = Modifier.fillMaxWidth().height(52.dp),
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(containerColor = ApexGreen, contentColor = Ink950),
        ) {
            Text("Continue to App Details", style = MaterialTheme.typography.titleMedium)
        }
        Text(
            "Nothing is compiled on this device — the build runs on a GitHub Actions runner.",
            style = MaterialTheme.typography.bodySmall,
            color = Ink300,
            fontFamily = FontFamily.Monospace,
        )
    }
}
