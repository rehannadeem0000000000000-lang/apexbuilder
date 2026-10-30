package dev.apex.apexbuilder.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.Terminate
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import dev.apex.apexbuilder.BuildProgress
import dev.apex.apexbuilder.Stage
import dev.apex.apexbuilder.StageState
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive

private fun fmtElapsed(ms: Long): String {
    val s = (ms / 1000).toInt()
    return "%d:%02d".format(s / 60, s % 60)
}

@Composable
fun Step3ProgressScreen(
    progress: BuildProgress,
    appName: String,
    appId: String,
    platform: String,
    onDownload: () -> Unit,
    onEditAgain: () -> Unit,
) {
    val (t0, baseMs) = remember { Pair(System.currentTimeMillis(), progress.elapsedMs) }
    var now by mutableLongStateOf(t0)
    LaunchedEffect(progress.phase) {
        while (isActive) {
            delay(1000)
            now = System.currentTimeMillis()
        }
    }
    val elapsed = (baseMs + (now - t0)).coerceAtLeast(0L)

    Column(Modifier.fillMaxSize().padding(20.dp).verticalScroll(), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        SectionHeader("03", "Build Progress", "Watch the GitHub Actions runner work")

        // summary
        Card(colors = cardColors(), shape = RoundedCornerShape(14.dp)) {
            Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                when (progress.phase) {
                    BuildProgress.Phase.READY -> Icon(Icons.Outlined.CheckCircle, null, tint = ApexGreen, modifier = Modifier.width(30.dp).height(30.dp))
                    BuildProgress.Phase.FAILED -> Icon(Icons.Outlined.Close, null, tint = Danger, modifier = Modifier.width(30.dp).height(30.dp))
                    else -> CircularProgressIndicator(modifier = Modifier.width(28.dp).height(28.dp), strokeWidth = 2.5f, color = ApexGreen)
                }
                Spacer(Modifier.width(14.dp))
                Column(Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(appName.ifEmpty { "Unnamed app" }, style = MaterialTheme.typography.titleMedium)
                        Text(
                            platform.uppercase(),
                            fontFamily = FontFamily.Monospace,
                            color = ApexGreen,
                            style = MaterialTheme.typography.labelMedium,
                        )
                    }
                    Text(
                        appId + if (progress.runId != null) "  ·  run #${progress.runId}" else "",
                        fontFamily = FontFamily.Monospace,
                        style = MaterialTheme.typography.bodySmall,
                        color = Ink300,
                    )
                }
                Column(horizontalAlignment = Alignment.End) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(5.dp)) {
                        Icon(Icons.Outlined.Schedule, null, tint = Ink300, modifier = Modifier.width(15.dp).height(15.dp))
                        Text(fmtElapsed(elapsed.coerceAtLeast(0)), fontFamily = FontFamily.Monospace, color = Color(0xFFEAF0F6))
                    }
                    Text("elapsed", style = MaterialTheme.typography.labelSmall, color = Ink300)
                }
            }
        }

        // stages
        Card(colors = cardColors(), shape = RoundedCornerShape(14.dp)) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                progress.stages.forEach { stage ->
                    StageRow(stage)
                }
            }
        }

        // banners
        when (progress.phase) {
            BuildProgress.Phase.READY -> Card(
                colors = CardDefaults.cardColors(containerColor = ApexGreen.copy(alpha = 0.09f)),
                shape = RoundedCornerShape(14.dp),
            ) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Build succeeded — ${platform.uppercase()} is ready", style = MaterialTheme.typography.titleSmall)
                    progress.artifactName?.let {
                        Text("artifact: $it", fontFamily = FontFamily.Monospace, style = MaterialTheme.typography.bodySmall, color = Ink300)
                    }
                    progress.downloadMessage?.let {
                        Text(it, style = MaterialTheme.typography.bodySmall, color = if (it.startsWith("Saved")) ApexGreen else Danger)
                    }
                    Button(
                        onClick = onDownload,
                        enabled = !progress.downloading,
                        colors = ButtonDefaults.buttonColors(containerColor = ApexGreen, contentColor = Ink950),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Icon(Icons.Outlined.Refresh, null)
                        Spacer(Modifier.width(8.dp))
                        Text(if (progress.downloading) "Downloading artifact…" else "Download ${platform.uppercase()} to Downloads")
                    }
                    OutlinedButton(onClick = onEditAgain, modifier = Modifier.fillMaxWidth()) {
                        Icon(Icons.Outlined.Refresh, null)
                        Spacer(Modifier.width(8.dp))
                        Text("Build again from this config")
                    }
                }
            }

            BuildProgress.Phase.FAILED -> Card(
                colors = CardDefaults.cardColors(containerColor = Danger.copy(alpha = 0.08f)),
                shape = RoundedCornerShape(14.dp),
            ) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Build failed", style = MaterialTheme.typography.titleSmall, color = Danger)
                    progress.error?.let {
                        Text(it, style = MaterialTheme.typography.bodySmall, color = Color(0xFFCDD6DF))
                    }
                    OutlinedButton(onClick = onEditAgain, modifier = Modifier.fillMaxWidth()) {
                        Text("Edit config & retry")
                    }
                }
            }

            else -> {}
        }

        // live log
        Card(colors = CardDefaults.cardColors(containerColor = Ink950), shape = RoundedCornerShape(14.dp)) {
            Column {
                Row(Modifier.padding(start = 14.dp, top = 10.dp, bottom = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Outlined.Terminate, null, tint = ApexGreen, modifier = Modifier.width(14.dp).height(14.dp))
                    Spacer(Modifier.width(8.dp))
                    Text("Live output — github actions", style = MaterialTheme.typography.labelMedium)
                    Spacer(Modifier.weight(1f))
                    Text("tail · 400 lines", fontFamily = FontFamily.Monospace, style = MaterialTheme.typography.labelSmall, color = Ink300)
                }
                Text(
                    progress.logTail.ifEmpty { "waiting for the first log lines from the runner…" },
                    fontFamily = FontFamily.Monospace,
                    style = MaterialTheme.typography.bodySmall,
                    color = if (progress.logTail.isEmpty()) Ink300 else Color(0xFF9FDDB2),
                    modifier = Modifier.padding(start = 14.dp, end = 14.dp, bottom = 12.dp),
                )
            }
        }
    }
}

@Composable
private fun StageRow(stage: Stage) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        when (stage.state) {
            StageState.DONE -> Icon(Icons.Outlined.CheckCircle, null, tint = ApexGreen, modifier = Modifier.width(20.dp).height(20.dp))
            StageState.ACTIVE -> CircularProgressIndicator(modifier = Modifier.width(18.dp).height(18.dp), strokeWidth = 2f, color = ApexGreen)
            StageState.FAILED -> Icon(Icons.Outlined.Close, null, tint = Danger, modifier = Modifier.width(20.dp).height(20.dp))
            StageState.PENDING -> Icon(Icons.Outlined.Schedule, null, tint = Ink600, modifier = Modifier.width(20.dp).height(20.dp))
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(stage.label, color = if (stage.state == StageState.PENDING) Ink300 else Color(0xFFEAF0F6), style = MaterialTheme.typography.bodyMedium)
        }
        val barColor = when (stage.state) {
            StageState.FAILED -> Danger
            StageState.PENDING -> Ink600
            else -> ApexGreen
        }
        val fill = when (stage.state) {
            StageState.DONE -> 1f
            StageState.ACTIVE -> 0.55f
            StageState.FAILED -> 0.4f
            StageState.PENDING -> 0.06f
        }
        Row(Modifier.fillMaxWidth().height(6.dp).background(Ink700, RoundedCornerShape(3.dp))) {
            Row(Modifier.weight(fill).height(6.dp).background(barColor, RoundedCornerShape(3.dp))) {}
            Row(Modifier.weight(1f - fill).height(6.dp)) {}
        }
    }
}
