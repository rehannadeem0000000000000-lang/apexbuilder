import java.util.Properties

plugins {
  id("com.android.application")
  id("org.jetbrains.kotlin.android")
}

// APEX:GS_APPLY

// Owner key supplied by the client (keystore.properties) or farm repo secrets (env).
val apexProps = Properties().apply {
  file("keystore.properties").takeIf { it.exists() }?.let { load(InputStreamReader(it.inputStream(), "utf-8")) }
}
fun kp(name: String): String = System.getenv(name) ?: apexProps.getProperty(name) ?: ""
val hasReleaseKeystore = file("apex-release.keystore").exists() && kp("APEX_KEYSTORE_B64").isNotBlank()

android {
  namespace = "com.apex.wrapper"
  compileSdk = 34

  defaultConfig {
    applicationId = "com.apex.placeholder" // APEX:APP_ID
    minSdk = 23
    targetSdk = 34
    versionCode = 1
    versionName = "1.0"
  }

  signingConfigs {
    create("apexRelease") {
      storeFile = file("apex-release.keystore")
      storePassword = kp("APEX_KEYSTORE_PASS").ifEmpty { "apex" }
      keyAlias = kp("APEX_KEY_ALIAS").ifEmpty { "apex" }
      keyPassword = kp("APEX_KEY_PASS").ifEmpty { "apex" }
    }
  }

  buildTypes {
    release {
      isMinifyEnabled = false // APEX:MINIFY
      isShrinkResources = false
      proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-apex.txt")
      // Release signing: farm/owner keystore when available, otherwise the
      // auto-generated debug keystore keeps the build signed & installable.
      signingConfig = if (hasReleaseKeystore) signingConfigs.getByName("apexRelease") else signingConfigs.getByName("debug")
    }
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }
  kotlinOptions {
    jvmTarget = "17"
  }
  lint {
    abortOnError = false
  }
}

dependencies {
  implementation("org.capacitorjs:capacitor:6.1.2")
  implementation("org.jetbrains.kotlin:kotlin-stdlib:1.9.24")
  implementation("androidx.core:core-ktx:1.13.1")
  implementation("androidx.appcompat:appcompat:1.7.0")
}
