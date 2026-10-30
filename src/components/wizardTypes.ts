export interface MediaRef {
  dataUrl: string;
  name: string;
}

export interface WizardForm {
  sourceType: "upload" | "website";
  fileType: "html" | "zip";
  file: File | null;
  url: string;
  platform: "apk" | "aab";
  icon: MediaRef | null;
  name: string;
  packageSuffix: string;
  appLinksDomain: string;
  googleEnabled: boolean;
  googleServices: string;
  googleClientId: string;
  permissions: Record<string, boolean>;
  dex2c: boolean;
  stringProtection: boolean;
  offlineCache: boolean;
  startupMode: "off" | "none" | "custom";
  startupMedia: MediaRef | null;
  signRelease: boolean;
  ownerKey: string;
}

export const PERMISSION_DEFS: { key: string; label: string; mono: string; icon: string; android: string[] }[] = [
  { key: "internet", label: "Internet", icon: "globe", mono: "INTERNET", android: ["android.permission.INTERNET"] },
  { key: "camera", label: "Camera", icon: "camera", mono: "CAMERA", android: ["android.permission.CAMERA"] },
  { key: "mic", label: "Microphone", icon: "mic", mono: "RECORD_AUDIO", android: ["android.permission.RECORD_AUDIO"] },
  {
    key: "location",
    label: "Location",
    icon: "mappin",
    mono: "ACCESS_FINE_LOCATION",
    android: ["android.permission.ACCESS_FINE_LOCATION", "android.permission.ACCESS_COARSE_LOCATION"],
  },
  {
    key: "storage",
    label: "Storage",
    icon: "storage",
    mono: "READ/WRITE_EXTERNAL_STORAGE",
    android: ["android.permission.READ_EXTERNAL_STORAGE", "android.permission.WRITE_EXTERNAL_STORAGE"],
  },
  { key: "contacts", label: "Contacts", icon: "contacts", mono: "READ_CONTACTS", android: ["android.permission.READ_CONTACTS"] },
  { key: "sms", label: "SMS", icon: "sms", mono: "SEND_SMS", android: ["android.permission.SEND_SMS"] },
  {
    key: "bluetooth",
    label: "Bluetooth",
    icon: "bluetooth",
    mono: "BLUETOOTH_CONNECT",
    android: ["android.permission.BLUETOOTH_CONNECT", "android.permission.BLUETOOTH_SCAN"],
  },
  { key: "vibrate", label: "Vibrate", icon: "vibrate", mono: "VIBRATE", android: ["android.permission.VIBRATE"] },
  {
    key: "install",
    label: "Install Unknown Apps",
    icon: "android",
    mono: "REQUEST_INSTALL_PACKAGES",
    android: ["android.permission.REQUEST_INSTALL_PACKAGES"],
  },
];

export const DEFAULT_FORM: WizardForm = {
  sourceType: "upload",
  fileType: "html",
  file: null,
  url: "",
  platform: "apk",
  icon: null,
  name: "",
  packageSuffix: "",
  appLinksDomain: "",
  googleEnabled: false,
  googleServices: "",
  googleClientId: "",
  permissions: { internet: true },
  dex2c: false,
  stringProtection: false,
  offlineCache: false,
  startupMode: "none",
  startupMedia: null,
  signRelease: true,
  ownerKey: "",
};

export interface BuildConfig {
  name: string;
  packageSuffix: string;
  platform: "apk" | "aab";
  iconBase64: string | null;
  iconMime: string | null;
  appLinksDomain: string | null;
  googleEnabled: boolean;
  googleServicesJson: string | null;
  googleClientId: string | null;
  permissions: string[];
  dex2c: boolean;
  stringProtection: boolean;
  offlineCache: boolean;
  startupMode: "off" | "none" | "custom";
  startupMediaBase64: string | null;
  startupMediaName: string | null;
  signRelease: boolean;
  ownerKey: string | null;
  url: string | null;
}

export function formToConfig(f: WizardForm): BuildConfig {
  const perms = PERMISSION_DEFS.filter((p) => f.permissions[p.key]).flatMap((p) => p.android);
  if (f.offlineCache && !perms.includes("android.permission.INTERNET")) perms.push("android.permission.INTERNET");
  const iconBase64 = f.icon?.dataUrl.split(",")[1] ?? null;
  const mediaBase64 = f.startupMedia?.dataUrl.split(",")[1] ?? null;
  return {
    name: f.name,
    packageSuffix: f.packageSuffix.replace(/^com\./, ""),
    platform: f.platform,
    iconBase64,
    iconMime: f.icon?.dataUrl.slice(0, f.icon.dataUrl.indexOf(";")) ?? null,
    appLinksDomain: f.appLinksDomain.trim() || null,
    googleEnabled: f.googleEnabled,
    googleServicesJson: f.googleServices.trim() || null,
    googleClientId: f.googleClientId.trim() || null,
    permissions: [...new Set(perms)],
    dex2c: f.dex2c,
    stringProtection: f.stringProtection,
    offlineCache: f.offlineCache,
    startupMode: f.startupMode,
    startupMediaBase64: f.startupMode === "custom" ? mediaBase64 : null,
    startupMediaName: f.startupMode === "custom" ? f.startupMedia?.name ?? null : null,
    signRelease: f.signRelease,
    ownerKey: f.ownerKey.trim() || null,
    url: f.sourceType === "website" ? f.url.trim() : null,
  };
}

export function fileToMedia(file: File): Promise<MediaRef> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve({ dataUrl: String(r.result), name: file.name });
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export function sanitizePackage(s: string): string {
  return s.toLowerCase().replace(/^com\./, "").replace(/[^a-z0-9_]/g, "");
}
