#!/usr/bin/env python3
"""
Apex Farm · configure_project.py
================================
Reads a project's config.json (pushed by the ApexBuilder client) and rewrites
the Capacitor/WebView wrapper template in place:

  1. capacitor.config.json  — appId, appName, remote URL, https scheme
  2. web/                   — injects the uploaded .html / unzipped project
  3. AndroidManifest.xml    — <uses-permission> tags + App Links intent-filter
  4. res/values/strings.xml — app_name, google_default_client_id
  5. res/values/colors.xml  — apex_accent, apex_splash_bg
  6. app/build.gradle.kts   — applicationId, minify/R8 toggle, google-services
  7. proguard-apex.txt      — R8 full mode / string-protection rules
  8. mipmap icons           — user icon (or generated default) in 5 densities
  9. splash                 — custom image (drawable) or MP4 (assets)
 10. google-services.json   — written when provided
 11. keystore.properties    — owner key overrides (gradle reads it)
 12. build_mode.txt         — assembleRelease | bundleRelease

Usage:
  python configure_project.py <project_dir> <wrapper_dir>

<project_dir> contains config.json plus index.html or project.zip.
Exit code != 0 aborts the GitHub Actions build with a clear ::error::.
"""

import base64
import io
import json
import os
import re
import shutil
import sys
import zipfile
from pathlib import Path

try:
    from PIL import Image
except ImportError:  # pragma: no cover
    Image = None


def err(msg: str) -> None:
    print(f"::error::{msg}")
    print(f"configure_project: {msg}")
    sys.exit(1)


def b64load(data: str) -> bytes:
    return base64.b64decode(data, validate=False)


def read(p: Path) -> str:
    return p.read_text(encoding="utf-8")


def write(p: Path, text: str) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding="utf-8")


def replace_once(text: str, old: str, new: str, where: str) -> str:
    if old not in text:
        err(f"marker not found in {where}: {old[:60]}")
    return text.replace(old, new, 1)


def xml_escape(s: str) -> str:
    return (
        s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )


def log(msg: str) -> None:
    print(f"  · {msg}")


# ─────────────────────────────────────────────────────────────────────────────
# Web source injection
# ─────────────────────────────────────────────────────────────────────────────
def inject_web_source(project: Path, web: Path, cfg: dict) -> None:
    if web.exists():
        shutil.rmtree(web)
    web.mkdir(parents=True)

    if (project / "index.html").exists():
        shutil.copy(project / "index.html", web / "index.html")
        log("web/ ← single index.html")
    elif (project / "project.zip").exists():
        with zipfile.ZipFile(project / "project.zip") as zf:
            zf.extractall(web)
        # If the zip contains exactly one top-level folder, unwrap it so
        # index.html sits at web/ root.
        entries = [e for e in web.iterdir()]
        if len(entries) == 1 and entries[0].is_dir() and (entries[0] / "index.html").exists():
            for child in entries[0].iterdir():
                shutil.move(str(child), str(web / child.name))
            entries[0].rmdir()
        log("web/ ← unzipped project folder")
    elif cfg.get("sourceType") == "website":
        url = cfg.get("url", "")
        write(
            web / "index.html",
            f"<!-- Remote mode: the WebView loads {url} directly (capacitor server.url) -->\n"
            "<!doctype html><html><head><meta charset='utf-8'></head>"
            "<body style='background:#0c0e11;color:#3ddc84;font-family:monospace;display:grid;place-items:center;height:100vh'>"
            f"<div><h2>Loading {url}</h2><p>The app serves this URL over the https scheme.</p></div>"
            "</body></html>\n",
        )
        log(f"web/ ← remote-mode placeholder (server.url = {url})")
    else:
        err("no web source found: expected index.html, project.zip or sourceType=website")


# ─────────────────────────────────────────────────────────────────────────────
# Manifest: permissions + app links
# ─────────────────────────────────────────────────────────────────────────────
def inject_manifest(manifest: Path, cfg: dict) -> None:
    text = read(manifest)

    perms = list(dict.fromkeys(cfg.get("permissions", [])))
    if not perms and cfg.get("offlineCache"):
        perms = ["android.permission.INTERNET"]
    tags = "\n".join(
        f'    <uses-permission android:name="{xml_escape(p)}"/>' for p in perms
    )
    text = replace_once(text, "    <!-- APEX:PERMISSIONS -->", tags, "AndroidManifest.xml")
    log(f"manifest ← {len(perms)} <uses-permission> tags: {', '.join(p.split('.')[-1] for p in perms) or '(none)'}")

    domain = (cfg.get("appLinksDomain") or "").strip()
    if domain and "." in domain:
        d = domain.split("/")[0]
        applinks = (
            "      <intent-filter android:autoVerify=\"true\">\n"
            "        <action android:name=\"android.intent.action.VIEW\"/>\n"
            "        <category android:name=\"android.intent.category.DEFAULT\"/>\n"
            "        <category android:name=\"android.intent.category.BROWSABLE\"/>\n"
            f"        <data android:scheme=\"https\" android:host=\"{xml_escape(d)}\"/>\n"
            "      </intent-filter>\n"
        )
        text = replace_once(text, "      <!-- APEX:APPLINKS -->", applinks, "AndroidManifest.xml")
        log(f"manifest ← App Links intent-filter for https://{d} (autoVerify)")
    else:
        text = replace_once(text, "      <!-- APEX:APPLINKS -->", "", "AndroidManifest.xml")


# ─────────────────────────────────────────────────────────────────────────────
# Gradle: applicationId, minify, google-services
# ─────────────────────────────────────────────────────────────────────────────
def inject_gradle(app: Path, cfg: dict) -> None:
    g = read(app / "build.gradle.kts")
    app_id = f"com.{(cfg.get('packageSuffix') or 'myapp').strip()}"
    g = replace_once(
        g,
        'applicationId = "com.apex.placeholder" // APEX:APP_ID',
        f'applicationId = "{app_id}" // APEX:APP_ID',
        "app/build.gradle.kts",
    )
    protect = bool(cfg.get("dex2c") or cfg.get("stringProtection"))
    g = replace_once(
        g,
        "isMinifyEnabled = false // APEX:MINIFY",
        f"isMinifyEnabled = {'true' if protect else 'false'} // APEX:MINIFY",
        "app/build.gradle.kts",
    )
    if cfg.get("googleEnabled") and (cfg.get("googleServicesJson") or cfg.get("googleClientId")):
        g = replace_once(g, "// APEX:GS_APPLY", "apply(plugin = \"com.google.gms.google-services\")", "app/build.gradle.kts")
    write(app / "build.gradle.kts", g)
    log(f"build.gradle.kts ← applicationId={app_id} minify={'on' if protect else 'off'} gms={'on' if cfg.get('googleServicesJson') else 'off'}")

    # R8 / protection rules
    pro = [
        "# Apex Farm · R8 rules (generated by configure_project.py)",
        "# Keeps the Capacitor bridge fully intact while everything else is",
        "# shrunk and obfuscated according to the client's protection toggles.",
        "-keep class com.getcapacitor.** { *; }",
        "-keepclassmembers class * { @com.getcapacitor.annotation.** *; }",
        "-keepclassmembers class * extends com.getcapacitor.PluginActivity { *; }",
        "-dontwarn com.getcapacitor.**",
        "-keepattributes *Annotation*",
    ]
    if cfg.get("dex2c"):
        pro += [
            "# DEX2C toggle → R8 full mode: aggressive shrink + reoptimize.",
            "-optimizations !field/static",
            "-reoptimize",
        ]
    if cfg.get("stringProtection"):
        pro += [
            "# String protection → obfuscated repackage + renamed sources.",
            "-repackageclasses \"a.apex.obf\"",
            "-renamesourcefileattribute SourceFile",
            "-keepattributes SourceFile,LineNumberTable",
        ]
    write(app / "proguard-apex.txt", "\n".join(pro) + "\n")
    log("proguard-apex.txt ← generated" + (" (dex2c)" if cfg.get("dex2c") else "") + (" (strings)" if cfg.get("stringProtection") else ""))


# ─────────────────────────────────────────────────────────────────────────────
# Resources: strings, colors, icon, splash
# ─────────────────────────────────────────────────────────────────────────────
MIPMAP_SIZES = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}


def default_icon(size: int) -> "Image.Image":
    img = Image.new("RGBA", (size, size), (12, 15, 18, 255))
    # green apex triangle
    pad = size // 8
    tri = [(size // 2, pad), (size - pad, size - pad), (pad, size - pad)]
    from PIL import ImageDraw

    d = ImageDraw.Draw(img)
    d.polygon(tri, fill=(61, 220, 132, 255), outline=(20, 26, 31, 255))
    d.polygon(
        [(size // 2, size // 3), (int(size * 0.72), size - pad), (int(size * 0.28), size - pad)],
        fill=(12, 15, 18, 255),
    )
    return img


def inject_icon(res: Path, cfg: dict) -> None:
    if Image is None:
        err("Pillow is required for icon generation (pip install pillow)")
    data = cfg.get("iconBase64")
    if data:
        try:
            src = Image.open(io.BytesIO(b64load(data))).convert("RGBA")
            log("icon ← user-provided square image")
        except Exception as e:
            err(f"failed to decode icon: {e}")
    else:
        src = None
        log("icon ← generated default apex mark")

    for folder, size in MIPMAP_SIZES.items():
        d = res / folder
        d.mkdir(parents=True, exist_ok=True)
        if src:
            # center-crop to square, then resize
            w, h = src.size
            s = min(w, h)
            src2 = src.crop(((w - s) // 2, (h - s) // 2, (w + s) // 2, (h + s) // 2))
            icon = src2.resize((size, size), Image.LANCZOS)
        else:
            icon = default_icon(size)
        icon.save(d / "ic_launcher.png")
        icon.save(d / "ic_launcher_round.png")
    log("icon → mipmap-{mdpi…xxxhdpi}/ic_launcher.png")


def inject_splash(res: Path, assets: Path, cfg: dict) -> None:
    mode = cfg.get("startupMode", "none")
    data = cfg.get("startupMediaBase64")
    name = (cfg.get("startupMediaName") or "").lower()
    if mode == "custom" and data:
        raw = b64load(data)
        if name.endswith(".mp4") or raw[:3] == b"\x1a\x45\xdf":
            assets.mkdir(parents=True, exist_ok=True)
            (assets / "splash.mp4").write_bytes(raw)
            log(f"splash ← MP4 video ({len(raw) // 1024} KB) → assets/splash.mp4")
        else:
            out_dir = res / "drawable-nodpi"
            out_dir.mkdir(parents=True, exist_ok=True)
            if Image is None:
                err("Pillow is required for splash images")
            img = Image.open(io.BytesIO(raw)).convert("RGB")
            w, h = img.size
            target_w = 720
            img = img.resize((target_w, int(h * target_w / w)), Image.LANCZOS)
            img.save(out_dir / "apex_splash.png")
            log(f"splash ← image ({target_w}x{int(h * target_w // w)}) → drawable-nodpi/apex_splash.png")
    else:
        log(f"splash ← mode '{mode}' (static colors only)")


def inject_values(res: Path, cfg: dict) -> None:
    strings_path = res / "values" / "strings.xml"
    s = read(strings_path)
    s = replace_once(
        s,
        '<string name="app_name">Apex Wrapper</string>',
        f'<string name="app_name">{xml_escape(cfg.get("appName") or "Apex App")}</string>',
        "strings.xml",
    )
    client_id = cfg.get("googleClientId") or ""
    s = replace_once(
        s,
        '<string name="google_default_client_id" translatable="false"></string>',
        f'<string name="google_default_client_id" translatable="false">{xml_escape(client_id)}</string>',
        "strings.xml",
    )
    write(strings_path, s)
    log(f"strings.xml ← app_name='{cfg.get('appName')}' google_client_id={'set' if client_id else 'empty'}")

    write(
        res / "values" / "colors.xml",
        '<?xml version="1.0" encoding="utf-8"?>\n'
        "<resources>\n"
        "    <color name=\"apex_accent\">#3DDC84</color>\n"
        "    <color name=\"apex_splash_bg\">#0C0E11</color>\n"
        "    <color name=\"apex_status\">#0C0E11</color>\n"
        "</resources>\n",
    )
    log("colors.xml ← apex_accent / apex_splash_bg / apex_status")


# ─────────────────────────────────────────────────────────────────────────────
# Capacitor config, google-services, owner key, build mode
# ─────────────────────────────────────────────────────────────────────────────
def inject_capacitor_config(root: Path, cfg: dict) -> None:
    path = root / "capacitor.config.json"
    cap = json.loads(read(path))
    cap["appId"] = f"com.{(cfg.get('packageSuffix') or 'myapp').strip()}"
    cap["appName"] = cfg.get("appName") or "Apex App"
    cap.setdefault("server", {})
    if cfg.get("sourceType") == "website" and cfg.get("url"):
        cap["server"]["url"] = cfg["url"]
    if cfg.get("offlineCache"):
        cap["server"]["androidScheme"] = "https"
    cap["backgroundColor"] = "#0C0E11"
    write(path, json.dumps(cap, indent=2) + "\n")
    log(
        f"capacitor.config.json ← appId={cap['appId']}"
        + (f" server.url={cap['server'].get('url')}" if cfg.get("sourceType") == "website" else "")
        + (" androidScheme=https" if cfg.get("offlineCache") else "")
    )


def inject_google_services(root: Path, cfg: dict) -> None:
    if cfg.get("googleEnabled") and cfg.get("googleServicesJson"):
        (root / "android" / "google-services.json").write_text(cfg["googleServicesJson"], encoding="utf-8")
        log("android/google-services.json ← written")


def inject_owner_key(root: Path, cfg: dict) -> None:
    key = (cfg.get("ownerKey") or "").strip()
    if key and cfg.get("signRelease"):
        write(
            root / "android" / "keystore.properties",
            "# Owner key supplied by the ApexBuilder client (overrides repo secrets)\n"
            f"APEX_KEYSTORE_B64={key}\n"
            "APEX_KEYSTORE_PASS=apex\n"
            "APEX_KEY_ALIAS=apex\n"
            "APEX_KEY_PASS=apex\n",
        )
        log("android/keystore.properties ← owner key")


def main() -> None:
    if len(sys.argv) != 3:
        err("usage: configure_project.py <project_dir> <wrapper_dir>")
    project = Path(sys.argv[1])
    root = Path(sys.argv[2])
    cfg_path = project / "config.json"
    if not cfg_path.exists():
        err(f"{cfg_path} not found")
    cfg = json.loads(read(cfg_path))
    if not cfg.get("packageSuffix"):
        err("config.json: packageSuffix is required")

    android_app = root / "android" / "app"
    res = android_app / "src" / "main" / "res"
    assets = android_app / "src" / "main" / "assets"

    print("::group::configuring wrapper")
    inject_web_source(project, root / "web", cfg)
    inject_capacitor_config(root, cfg)
    inject_manifest(android_app / "src" / "main" / "AndroidManifest.xml", cfg)
    inject_gradle(android_app, cfg)
    inject_values(res, cfg)
    inject_icon(res, cfg)
    inject_splash(res, assets, cfg)
    inject_google_services(root, cfg)
    inject_owner_key(root, cfg)
    write(
        root / "build_mode.txt",
        "bundleRelease\n" if (cfg.get("platform") == "aab") else "assembleRelease\n",
    )
    print("::endgroup::")
    print("configuration complete — ready for gradle.")


if __name__ == "__main__":
    main()
