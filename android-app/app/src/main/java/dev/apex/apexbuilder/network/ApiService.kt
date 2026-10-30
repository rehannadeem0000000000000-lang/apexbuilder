@file:OptIn(ExperimentalSerializationApi::class)

package dev.apex.apexbuilder.network

import android.content.Context
import android.content.SharedPreferences
import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import dev.apex.apexbuilder.model.ArtifactList
import dev.apex.apexbuilder.model.ContentInfo
import dev.apex.apexbuilder.model.DispatchBody
import dev.apex.apexbuilder.model.JobList
import dev.apex.apexbuilder.model.RepoInfo
import dev.apex.apexbuilder.model.RunInfo
import dev.apex.apexbuilder.model.RunList
import dev.apex.apexbuilder.model.UploadBody
import dev.apex.apexbuilder.model.WhoAmI
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.ResponseBody
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Response
import retrofit2.Retrofit
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query
import java.util.Base64
import java.util.zip.ZipInputStream

/**
 * Farm coordinates. Defaults point at the public apex farm repo;
 * users can override them in the in-app settings (SharedPreferences).
 */
object FarmSettings {
    const val PREFS = "apex_farm"
    const val DEFAULT_OWNER = "apex-farm"
    const val DEFAULT_REPO = "apex-farm"
    const val DEFAULT_BRANCH = "main"
    const val WORKFLOW = "build-apk.yml"

    fun prefs(context: Context): SharedPreferences =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun owner(ctx: Context) = prefs(ctx).getString("owner", DEFAULT_OWNER) ?: DEFAULT_OWNER
    fun repo(ctx: Context) = prefs(ctx).getString("repo", DEFAULT_REPO) ?: DEFAULT_REPO
    fun branch(ctx: Context) = prefs(ctx).getString("branch", DEFAULT_BRANCH) ?: DEFAULT_BRANCH
    fun token(ctx: Context) = prefs(ctx).getString("token", "") ?: ""
}

interface GithubApi {
    @GET("user")
    suspend fun whoAmI(): WhoAmI

    @GET("repos/{owner}/{repo}")
    suspend fun repo(@Path("owner") owner: String, @Path("repo") repo: String): RepoInfo

    @GET("repos/{owner}/{repo}/contents/{path}")
    suspend fun content(
        @Path("owner") owner: String,
        @Path("repo") repo: String,
        @Path("path", encoded = true) path: String,
        @Query("ref") ref: String,
    ): ContentInfo

    @PUT("repos/{owner}/{repo}/contents/{path}")
    suspend fun putContent(
        @Path("owner") owner: String,
        @Path("repo") repo: String,
        @Path("path", encoded = true) path: String,
        @Body body: UploadBody,
    ): ContentInfo

    @POST("repos/{owner}/{repo}/actions/workflows/{workflow}/dispatches")
    suspend fun dispatch(
        @Path("owner") owner: String,
        @Path("repo") repo: String,
        @Path("workflow") workflow: String,
        @Body body: DispatchBody,
    ): Response<Unit>

    @GET("repos/{owner}/{repo}/actions/workflows/{workflow}/runs")
    suspend fun runs(
        @Path("owner") owner: String,
        @Path("repo") repo: String,
        @Path("workflow") workflow: String,
        @Query("per_page") perPage: Int,
    ): RunList

    @GET("repos/{owner}/{repo}/actions/runs/{runId}")
    suspend fun run(@Path("owner") owner: String, @Path("repo") repo: String, @Path("runId") runId: Long): RunInfo

    @GET("repos/{owner}/{repo}/actions/runs/{runId}/jobs")
    suspend fun jobs(@Path("owner") owner: String, @Path("repo") repo: String, @Path("runId") runId: Long): JobList

    @GET("repos/{owner}/{repo}/actions/jobs/{jobId}/logs")
    suspend fun jobLogs(@Path("owner") owner: String, @Path("repo") repo: String, @Path("jobId") jobId: Long): Response<ResponseBody>

    @GET("repos/{owner}/{repo}/actions/runs/{runId}/artifacts")
    suspend fun artifacts(@Path("owner") owner: String, @Path("repo") repo: String, @Path("runId") runId: Long): ArtifactList
}

/**
 * Thin coroutine facade over the GitHub REST API. All network work runs on IO.
 * The PAT is sent as a bearer token and never leaves the process.
 */
class GithubClient(private val context: Context) {

    private val api: GithubApi by lazy {
        val logging = HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.NONE }
        val client = OkHttpClient.Builder()
            .addInterceptor { chain ->
                val token = FarmSettings.token(context)
                val req = chain.request().newBuilder()
                    .header("User-Agent", "ApexBuilder-Android")
                    .header("Accept", "application/vnd.github+json")
                    .header("X-GitHub-Api-Version", "2022-11-28")
                    .apply { if (token.isNotBlank()) header("Authorization", "Bearer $token") }
                    .build()
                chain.proceed(req)
            }
            .addInterceptor(logging)
            .build()
        Retrofit.Builder()
            .baseUrl("https://api.github.com/")
            .client(client)
            .addConverterFactory(json.asConverterFactory("application/vnd.github+json".toMediaType()))
            .build()
            .create(GithubApi::class.java)
    }

    private val json = Json {
        ignoreUnknownKeys = true
        encodeDefaults = true
    }

    private val owner get() = FarmSettings.owner(context)
    private val repo get() = FarmSettings.repo(context)
    private val branch get() = FarmSettings.branch(context)

    suspend fun whoAmI(): String = withContext(Dispatchers.IO) { api.whoAmI().login }

    suspend fun defaultBranch(): String = withContext(Dispatchers.IO) {
        try {
            api.repo(owner, repo).default_branch
        } catch (e: Exception) {
            branch
        }
    }

    /** Uploads raw bytes via the contents API (base64 body). Handles sha refresh on 409. */
    suspend fun uploadFile(path: String, bytes: ByteArray, message: String): Unit =
        withContext(Dispatchers.IO) {
            val b64 = Base64.getEncoder().encodeToString(bytes)
            try {
                api.putContent(owner, repo, path, UploadBody(message = "[apex] $message", content = b64, branch = branch))
            } catch (e: retrofit2.HttpException) {
                if (e.code() == 409) {
                    val sha = api.content(owner, repo, path, ref = branch).sha
                        ?: throw IllegalStateException("Cannot resolve sha for $path")
                    api.putContent(owner, repo, path, UploadBody(message = "[apex] $message", content = b64, branch = branch, sha = sha))
                } else throw e
            }
        }

    suspend fun dispatchWorkflow(projectId: String, platform: String): Unit =
        withContext(Dispatchers.IO) {
            val ref = defaultBranch()
            api.dispatch(owner, repo, FarmSettings.WORKFLOW, DispatchBody(ref, mapOf("project" to projectId, "platform" to platform)))
        }

    suspend fun findRunAfter(sinceIso: String): RunInfo? = withContext(Dispatchers.IO) {
        api.runs(owner, repo, FarmSettings.WORKFLOW, 10).workflow_runs.firstOrNull { it.created_at >= sinceIso }
    }

    suspend fun getRun(runId: Long): RunInfo = withContext(Dispatchers.IO) { api.run(owner, repo, runId) }

    suspend fun getJobs(runId: Long): List<dev.apex.apexbuilder.model.JobInfo> =
        withContext(Dispatchers.IO) { api.jobs(owner, repo, runId).jobs }

    /** Downloads the zip of step logs for every job and returns the last 400 lines. */
    suspend fun tailLogs(runId: Long, maxLines: Int = 400): String = withContext(Dispatchers.IO) {
        val sb = StringBuilder()
        for (job in api.jobs(owner, repo, runId).jobs) {
            val resp = api.jobLogs(owner, repo, job.id)
            val body = resp.body() ?: continue
            ZipInputStream(body.byteStream()).use { zis ->
                var entry = zis.nextEntry
                while (entry != null) {
                    if (!entry.isDirectory && entry.name.endsWith(".log")) {
                        sb.append(zis.readBytes().decodeToString())
                    }
                    zis.closeEntry()
                    entry = zis.nextEntry
                }
            }
        }
        val lines = sb.lineSequence().filter { it.isNotBlank() }.toList()
        lines.takeLast(maxLines).joinToString("\n")
    }

    suspend fun listArtifacts(runId: Long): List<dev.apex.apexbuilder.model.ArtifactInfo> =
        withContext(Dispatchers.IO) { api.artifacts(owner, repo, runId).artifacts }

    /** Streams the artifact archive and returns the first .apk/.aab entry as bytes. */
    suspend fun artifactBytes(artifactId: Long, ext: String): ByteArray = withContext(Dispatchers.IO) {
        val url = "repos/$owner/$repo/actions/artifacts/$artifactId/zip"
        val token = FarmSettings.token(context)
        val client = OkHttpClient()
        val request = okhttp3.Request.Builder()
            .url("https://api.github.com/$url")
            .header("Authorization", "Bearer $token")
            .header("Accept", "application/vnd.github+json")
            .header("X-GitHub-Api-Version", "2022-11-28")
            .header("User-Agent", "ApexBuilder-Android")
            .build()
        client.newCall(request).execute().use { resp ->
            if (!resp.isSuccessful) throw IllegalStateException("Artifact download failed: ${resp.code}")
            val body = resp.body() ?: throw IllegalStateException("Empty artifact body")
            ZipInputStream(body.byteStream()).use { zis ->
                var entry = zis.nextEntry
                while (entry != null) {
                    if (!entry.isDirectory && entry.name.lowercase().endsWith ".$ext")) {
                        return@withContext zis.readBytes()
                    }
                    zis.closeEntry()
                    entry = zis.nextEntry
                }
                throw IllegalStateException("No .$ext file found in the artifact archive")
            }
        }
    }
}
