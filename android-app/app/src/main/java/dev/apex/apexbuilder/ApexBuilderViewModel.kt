package dev.apex.apexbuilder

import android.content.ContentValues
import android.content.Context
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.apex.apexbuilder.model.BuildConfig
import dev.apex.apexbuilder.model.ConfigPayload
import dev.apex.apexbuilder.model.JobInfo
import dev.apex.apexbuilder.model.RunInfo
import dev.apex.apexbuilder.network.GithubClient
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json

enum class StageState { PENDING, ACTIVE, DONE, FAILED }

data class Stage(
    val key: String,
    val label: String,
    val state: StageState = StageState.PENDING,
)

data class BuildProgress(
    val phase: Phase = Phase.IDLE,
    val stages: List<Stage> = listOf(
        Stage("upload", "Upload"),
        Stage("prepare", "Prepare"),
        Stage("build", "Build"),
        Stage("ready", "Ready"),
    ),
    val elapsedMs: Long = 0L,
    val logTail: String = "",
    val error: String? = null,
    val artifactName: String? = null,
    val artifactId: Long? = null,
    val runId: Long? = null,
    val downloading: Boolean = false,
    val downloadMessage: String? = null,
) {
    enum class Phase { IDLE, UPLOADING, POLLING, READY, FAILED }
}

class ApexBuilderViewModel(
    private val context: Context,
    private val github: GithubClient,
) : ViewModel() {

    private val _progress = MutableStateFlow(BuildProgress())
    val progress: StateFlow<BuildProgress> = _progress.asStateFlow()

    private var pollJob: Job? = null
    private var runId: Long? = null
    private var currentProjectId: String? = null
    private var startedAtEpoch: Long = System.currentTimeMillis()
    private var lastStepSignature: String = ""

    private val json = Json { ignoreUnknownKeys = true }

    fun startBuild(sourceName: String, sourceBytes: ByteArray, config: BuildConfig) {
        if (pollJob?.isActive == true) return
        _progress.value = BuildProgress(phase = BuildProgress.Phase.UPLOADING)
        startedAtEpoch = System.currentTimeMillis()
        runId = null
        lastStepSignature = ""

        pollJob = viewModelScope.launch {
            try {
                // 1 · push source + config.json to the farm repo
                val projectId = java.util.UUID.randomUUID().toString()
                currentProjectId = projectId
                val base = "projects/$projectId"
                val isZip = sourceName.lowercase().endsWith(".zip")
                if (config.url == null) {
                    val targetPath = if (isZip) "$base/project.zip" else "$base/index.html"
                    github.uploadFile(targetPath, sourceBytes, "source ${config.name}")
                }

                val payload = ConfigPayload.create(projectId, if (config.url != null) "url" else if (isZip) "zip" else "html", config)
                github.uploadFile("$base/config.json", json.encodeToString(ConfigPayload.serializer(), payload).encodeToByteArray(), "config ${config.name}")

                // 2 · trigger workflow_dispatch
                github.dispatchWorkflow(projectId, config.platform)
                _progress.value = _progress.value.copy(
                    phase = BuildProgress.Phase.POLLING,
                    stages = _progress.value.stages.map { if (it.key == "upload") it.copy(state = StageState.DONE) else it },
                )
                poll(projectId)
            } catch (e: Exception) {
                _progress.value = _progress.value.copy(phase = BuildProgress.Phase.FAILED, error = e.message ?: "Build failed")
            }
        }
    }

    private fun poll(projectId: String) {
        pollJob = viewModelScope.launch {
            while (isActive) {
                delay(4_000)
                try {
                    val run: RunInfo? = runId?.let { github.getRun(it) } ?: run {
                        val found = github.findRunAfter(
                            java.time.OffsetDateTime.ofInstant(
                                java.time.Instant.ofEpochMilli(startedAtEpoch - 5_000),
                                java.time.ZoneOffset.UTC,
                            ).toString(),
                        )
                        if (found != null) {
                            runId = found.id
                            _progress.value = _progress.value.copy(runId = found.id)
                        }
                        found
                    }
                    if (run != null) {
                        val jobs = github.getJobs(run.id)
                        applyStages(jobs)
                        val sig = jobs.map { it.steps.map { s -> s.status + s.conclusion } }.toString()
                        if (sig != lastStepSignature) {
                            lastStepSignature = sig
                            _progress.value = _progress.value.copy(logTail = github.tailLogs(run.id))
                        }
                        _progress.value = _progress.value.copy(
                            elapsedMs = System.currentTimeMillis() - startedAtEpoch,
                        )
                        if (run.status == "completed") {
                            if (run.conclusion == "success") {
                                val artifacts = github.listArtifacts(run.id)
                                val artifact = artifacts.firstOrNull { it.name.contains(projectId) } ?: artifacts.firstOrNull()
                                _progress.value = _progress.value.copy(
                                    phase = BuildProgress.Phase.READY,
                                    artifactName = artifact?.name,
                                    artifactId = artifact?.id,
                                    stages = _progress.value.stages.map { it.copy(state = StageState.DONE) },
                                )
                            } else {
                                _progress.value = _progress.value.copy(
                                    phase = BuildProgress.Phase.FAILED,
                                    error = "Workflow finished: ${run.conclusion}",
                                )
                            }
                            return@launch
                        }
                    }
                } catch (e: Exception) {
                    _progress.value = _progress.value.copy(error = e.message)
                }
            }
        }
    }

    private fun applyStages(jobs: List<JobInfo>) {
        val findStep = { pred: (String) -> Boolean ->
            jobs.asSequence().flatMap { it.steps.asSequence() }.firstOrNull { pred(it.name.lowercase()) }
        }
        val state = { status: String, conclusion: String? ->
            when {
                status == "completed" -> if (conclusion == "success") StageState.DONE else StageState.FAILED
                status == "in_progress" -> StageState.ACTIVE
                else -> StageState.PENDING
            }
        }
        val mapped = _progress.value.stages.map { stage ->
            val step = when (stage.key) {
                "upload" -> findStep { it.contains("stage sources") }
                "prepare" -> findStep { it.contains("configure") }
                "build" -> findStep { it.contains("build release") }
                else -> findStep { it.contains("sign") || it.contains("artifact") }
            }
            if (step == null) stage else stage.copy(state = state(step.status, step.conclusion))
        }
        _progress.value = _progress.value.copy(stages = mapped)
    }

    /** Fetches the finished artifact from GitHub and saves it to /sdcard/Download/. */
    fun downloadAndSave(ext: String, displayName: String) {
        viewModelScope.launch {
            val p = _progress.value
            if (p.runId == null) {
                _progress.value = p.copy(downloadMessage = "No completed run to download from.")
                return@launch
            }
            _progress.value = p.copy(downloading = true, downloadMessage = null)
            runCatching {
                val artifactId = p.artifactId ?: run {
                    val artifacts = github.listArtifacts(p.runId ?: 0L)
                    (artifacts.firstOrNull { it.name.contains(currentProjectId ?: "apex") } ?: artifacts.firstOrNull())
                        ?.id ?: throw IllegalStateException("No artifact on this run")
                }
                val bytes = github.artifactBytes(artifactId, ext)
                val ok = saveArtifact(displayName, bytes)
                _progress.value = _progress.value.copy(
                    downloadMessage = if (ok)
                        "Saved ${displayName} to ${Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)}"
                    else "Save failed — check storage permissions.",
                )
            }.onFailure {
                _progress.value = _progress.value.copy(downloadMessage = it.message ?: "Download failed")
            }
            _progress.value = _progress.value.copy(downloading = false)
        }
    }

    /** Saves the downloaded APK/AAB to /sdcard/Download/ via MediaStore. */
    fun saveArtifact(fileName: String, bytes: ByteArray): Boolean = runCatching {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val values = ContentValues().apply {
                put(MediaStore.Downloads.DISPLAY_NAME, fileName)
                put(MediaStore.Downloads.MIME_TYPE, "application/vnd.android.package-archive")
                put(MediaStore.Downloads.IS_PENDING, 1)
            }
            val resolver = context.contentResolver
            val uri: Uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                ?: return false
            resolver.openOutputStream(uri)?.use { it.write(bytes) }
            values.clear()
            values.put(MediaStore.Downloads.IS_PENDING, 0)
            resolver.update(uri, values, null, null)
        } else {
            @Suppress("DEPRECATION")
            val dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
            dir.mkdirs()
            java.io.File(dir, fileName).writeBytes(bytes)
        }
        true
    }.getOrDefault(false)
}
