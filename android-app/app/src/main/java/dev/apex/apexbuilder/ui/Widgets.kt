package dev.apex.apexbuilder.ui

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.graphicsLayer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.KeyboardArrowDown
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp

@Composable
fun cardColors() = CardDefaults.cardColors(containerColor = Ink850)

@Composable
fun textFieldColors() = TextFieldDefaults.colors(
    focusedContainerColor = Ink900,
    unfocusedContainerColor = Ink900,
    focusedBorderColor = ApexGreen.copy(alpha = 0.7f),
    unfocusedBorderColor = Ink600,
    cursorColor = ApexGreen,
)

@Composable
fun SectionHeader(index: String, title: String, sub: String) {
    Column {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(index, color = ApexGreen, fontFamily = FontFamily.Monospace, style = MaterialTheme.typography.labelMedium)
            Text(title, style = MaterialTheme.typography.titleMedium)
        }
        Text(sub, style = MaterialTheme.typography.bodySmall, color = Ink300)
    }
}

@Composable
fun SegmentedOption(
    selected: Boolean,
    label: String,
    icon: @Composable () -> Unit,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .weight(1f)
            .clickable(onClick = onClick)
            .background(if (selected) Ink700 else Color.Transparent, RoundedCornerShape(10.dp))
            .border(1.dp, if (selected) Ink600 else Ink600.copy(alpha = 0.6f), RoundedCornerShape(10.dp))
            .padding(horizontal = 14.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Icon(icon(), null, tint = if (selected) ApexGreen else Ink300, modifier = Modifier.size(16.dp))
        Text(label, color = if (selected) Color(0xFFEAF0F6) else Ink300, style = MaterialTheme.typography.bodyMedium)
    }
}

/** Collapsible section card used across step 2. */
@Composable
fun CollapsibleCard(
    title: String,
    icon: @Composable () -> Unit,
    defaultOpen: Boolean = false,
    badge: String? = null,
    content: @Composable () -> Unit,
) {
    var open by remember { mutableStateOf(defaultOpen) }
    Card(colors = cardColors(), shape = RoundedCornerShape(14.dp)) {
        Column {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { open = !open }
                    .padding(horizontal = 16.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(icon(), null, tint = if (open) ApexGreen else Ink300, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(12.dp))
                Text(title, style = MaterialTheme.typography.titleSmall, modifier = Modifier.weight(1f))
                if (badge != null) {
                    Text(badge, fontFamily = FontFamily.Monospace, style = MaterialTheme.typography.labelSmall, color = Ink300)
                    Spacer(Modifier.width(8.dp))
                }
                Icon(
                    Icons.Outlined.KeyboardArrowDown,
                    null,
                    tint = Ink300,
                    modifier = Modifier
                        .size(20.dp)
                        .graphicsLayer { rotationZ = if (open) 180f else 0f },
                )
            }
            AnimatedVisibility(visible = open, enter = expandVertically(), exit = shrinkVertically()) {
                Column(Modifier.padding(start = 16.dp, end = 16.dp, bottom = 16.dp)) {
                    content()
                }
            }
        }
    }
}

fun formatBytes(bytes: Long): String = when {
    bytes >= 1024 * 1024 -> "%.2f MB".format(bytes / 1024f / 1024f)
    bytes >= 1024 -> "%.1f KB".format(bytes / 1024f)
    else -> "$bytes B"
}

fun Context.uriQueryName(uri: Uri): String? = runCatching {
    contentResolver.query(uri, null, null, null, null)?.use { c ->
        val idx = c.getColumnIndex(OpenableColumns.DISPLAY_NAME)
        if (idx >= 0 && c.moveToFirst()) c.getString(idx) else null
    }
}.getOrNull()

fun Context.uriQuerySize(uri: Uri): Long = runCatching {
    contentResolver.query(uri, null, null, null, null)?.use { c ->
        val idx = c.getColumnIndex(OpenableColumns.SIZE)
        if (idx >= 0 && c.moveToFirst()) c.getLong(idx) else 0L
    } ?: 0L
}.getOrDefault(0L)
