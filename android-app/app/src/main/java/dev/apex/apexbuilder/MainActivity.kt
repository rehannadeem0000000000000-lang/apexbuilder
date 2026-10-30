package dev.apex.apexbuilder

import android.os.Bundle
import android.util.Base64
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import dev.apex.apexbuilder.model.BuildConfig
import dev.apex.apexbuilder.model.Permissions
import dev.apex.apexbuilder.network.FarmSettings
import dev.apex.apexbuilder.network.GithubClient
import dev.apex.apexbuilder.ui.ApexTheme
import dev.apex.apexbuilder.ui.Ink950
import dev.apex.apexbuilder.ui.Ink900
import dev.apex.apexbuilder.ui.Ink300
import dev.apex.apexbuilder.ui.Step1SourceScreen
import dev.apex.apexbuilder.ui.Step2ConfigScreen
import dev.apex.apexbuilder.ui.Step3ProgressScreen
import dev.apex.apexbuilder.ui.WizardState
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {

    private lateinit var vm: ApexBuilderViewModel
    private lateinit var github: GithubClient

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        github = GithubClient(applicationContext)
        vm = ApexBuilderViewModel(applicationContext, github)

        setContent {
            ApexTheme { MainScreen(vm) }
        }
    }
}

@Composable
fun MainScreen(vm: ApexBuilderViewModel) {
    val app = androidx.compose.ui.platform.LocalContext.current
    var step by remember { mutableStateOf(1) }
    var wizard by remember { mutableStateOf(WizardState()) }
    var buildError by remember { mutableStateOf<String?>(null) }
    val progress by vm.progress.collectAsState()
    val scope = rememberCoroutineScope()
    val snackbar = remember { SnackbarHostState() }

    BackHandler(enabled = step == 2) { step = 1 }

    Scaffold(
        containerColor = Ink950,
        snackbarHost = { SnackbarHost(snackbar) },
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(
                            "APEXBUILDER",
                            style = MaterialTheme.typography.titleMedium,
                            color = Color(0xFFEAF0F6),
                        )
                        Text(
                            "cloud apk forge",
                            style = MaterialTheme.typography.labelSmall,
                            color = Ink300,
                            fontFamily = FontFamily.Monospace,
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Ink900),
                actions = {
                    // step indicator
                    Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        listOf("1 Source", "2 Config", "3 Build").forEachIndexed { i, label ->
                            val active = step == i + 1
                            Text(
                                label,
                                color = if (active) dev.apex.apexbuilder.ui.ApexGreen else Ink300,
                                style = MaterialTheme.typography.labelSmall,
                                fontFamily = FontFamily.Monospace,
                                modifier = Modifier
                                    .padding(horizontal = 8.dp, vertical = 4.dp)
                                    .then(if (active) Modifier.background(dev.apex.apexbuilder.ui.Ink700, RoundedCornerShape(6.dp)) else Modifier),
                            )
                        }
                    }
                    Spacer(Modifier.width(8.dp))
                    FarmSettingsDialog()
                },
            )
        },
    ) { padding ->
        Column(Modifier.padding(padding).fillMaxSize()) {
            when (step) {
                1 -> Step1SourceScreen(
                    state = wizard,
                    onState = { wizard = it },
                    onContinue = {
                        if (wizard.sourceMode == "upload" && wizard.sourceUri == null) {
                            buildError = "Pick a source file first"
                        } else {
                            buildError = null
                            step = 2
                        }
                    },
                )

                2 -> Step2ConfigScreen(
                    state = wizard,
                    onState = { wizard = it },
                    onBack = { step = 1 },
                    buildBusy = progress.phase == dev.apex.apexbuilder.BuildProgress.Phase.UPLOADING,
                    buildError = buildError,
                    onBuild = {
                        scope.launch {
                            buildError = null
                            try {
                                val sourceBytes = if (wizard.sourceMode == "website") {
                                    ByteArray(0)
                                } else {
                                    app.contentResolver.openInputStream(wizard.sourceUri!!).use { it.readBytes() }
                                        ?: error("Could not read the source file")
                                }
                                val iconBytes = wizard.iconUri?.let { app.contentResolver.openInputStream(it).use { s -> s.readBytes() } }
                                val splashBytes = if (wizard.startupMode == "custom")
                                    wizard.startupUri?.let { app.contentResolver.openInputStream(it).use { s -> s.readBytes() } }
                                else null

                                val config = BuildConfig(
                                    name = wizard.appName.trim(),
                                    packageSuffix = wizard.packageSuffix.trim(),
                                    platform = wizard.platform,
                                    iconBase64 = iconBytes?.let { Base64.encodeToString(it, Base64.NO_WRAP) },
                                    iconMime = iconBytes?.let { "image/png" },
                                    appLinksDomain = wizard.appLinksDomain.trim().ifEmpty { null },
                                    googleEnabled = wizard.googleEnabled,
                                    googleServicesJson = wizard.googleServicesText.ifEmpty { null },
                                    googleClientId = wizard.googleClientId.trim().ifEmpty { null },
                                    permissions = Permissions.ALL
                                        .filter { wizard.permissionOn[it.key] == true }
                                        .flatMap { it.android }
                                        .let { perms ->
                                            if (wizard.offlineCache && "android.permission.INTERNET" !in perms)
                                                perms + "android.permission.INTERNET"
                                            else perms
                                        },
                                    dex2c = wizard.dex2c,
                                    stringProtection = wizard.stringProtection,
                                    offlineCache = wizard.offlineCache,
                                    startupMode = wizard.startupMode,
                                    startupMediaBase64 = splashBytes?.let { Base64.encodeToString(it, Base64.NO_WRAP) },
                                    startupMediaName = if (wizard.startupMode == "custom") wizard.startupName else null,
                                    signRelease = wizard.signRelease,
                                    ownerKey = wizard.ownerKey.ifEmpty { null },
                                    url = if (wizard.sourceMode == "website") wizard.url.trim() else null,
                                )
                                vm.startBuild(wizard.sourceName.ifEmpty { "url" }, sourceBytes, config)
                                step = 3
                            } catch (e: Exception) {
                                buildError = e.message
                            }
                        }
                    },
                )

                3 -> Step3ProgressScreen(
                    progress = progress,
                    appName = wizard.appName,
                    appId = "com.${wizard.packageSuffix}",
                    platform = wizard.platform,
                    onDownload = {
                        vm.downloadAndSave(
                            ext = wizard.platform,
                            displayName = "${wizard.appName.ifEmpty { "apex-app" }}-release.${wizard.platform}",
                        )
                    },
                    onEditAgain = {
                        buildError = null
                        step = 2
                    },
                )
            }
        }
    }
}

@Composable
private fun FarmSettingsDialog() {
    val prefs = FarmSettings.prefs(androidx.compose.ui.platform.LocalContext.current)
    var open by remember { mutableStateOf(false) }
    var owner by remember { mutableStateOf(FarmSettings.owner(androidx.compose.ui.platform.LocalContext.current)) }
    var repo by remember { mutableStateOf(FarmSettings.repo(androidx.compose.ui.platform.LocalContext.current)) }
    var branch by remember { mutableStateOf(FarmSettings.branch(androidx.compose.ui.platform.LocalContext.current)) }
    var token by remember { mutableStateOf(FarmSettings.token(androidx.compose.ui.platform.LocalContext.current)) }

    IconButton(onClick = { open = true }) {
        Icon(Icons.Outlined.Settings, "Farm settings", tint = Ink300)
    }

    if (open) {
        AlertDialog(
            onDismissRequest = { open = false },
            title = { Text("GitHub Farm settings") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.verticalScroll(rememberScrollState())) {
                    OutlinedTextField(owner, { owner = it }, label = { Text("Owner") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(repo, { repo = it }, label = { Text("Farm repo") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(branch, { branch = it }, label = { Text("Branch") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    OutlinedTextField(token, { token = it }, label = { Text("Personal access token") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    HorizontalDivider()
                    Text(
                        "Token needs Contents read/write + Actions read. Stored only in app prefs.",
                        style = MaterialTheme.typography.labelSmall,
                        color = Ink300,
                    )
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    prefs.edit()
                        .putString("owner", owner.trim())
                        .putString("repo", repo.trim())
                        .putString("branch", branch.trim())
                        .putString("token", token.trim())
                        .apply()
                    open = false
                }) { Text("Save") }
            },
            dismissButton = { TextButton(onClick = { open = false }) { Text("Cancel") } },
        )
    }
}
