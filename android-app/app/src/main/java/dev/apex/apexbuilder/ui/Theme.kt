package dev.apex.apexbuilder.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val ApexGreen = Color(0xFF3DDC84)
val ApexGreenDim = Color(0xFF1E4A33)
val Ink950 = Color(0xFF06080A)
val Ink900 = Color(0xFF0A0D10)
val Ink850 = Color(0xFF0E1216)
val Ink800 = Color(0xFF13181E)
val Ink700 = Color(0xFF1D242D)
val Ink600 = Color(0xFF28313C)
val Ink300 = Color(0xFF7B8A9B)
val Ink100 = Color(0xFFCDD6DF)
val Ink50 = Color(0xFFEAF0F6)
val Danger = Color(0xFFFF5C5C)
val Amber = Color(0xFFF5A524)

private val ApexScheme = darkColorScheme(
    primary = ApexGreen,
    onPrimary = Ink950,
    secondary = ApexGreen,
    background = Ink950,
    onBackground = Ink100,
    surface = Ink900,
    onSurface = Ink100,
    surfaceVariant = Ink800,
    onSurfaceVariant = Ink300,
    outline = Ink600,
    error = Danger,
)

@Composable
fun ApexTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = ApexScheme, content = content)
}
