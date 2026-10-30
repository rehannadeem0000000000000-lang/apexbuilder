# ApexBuilder client — keep the serialization/Retrofit surface
-keepattributes *Annotation*, Signature, InnerClasses, EnclosingMethod
-keepclassmembers class dev.apex.apexbuilder.** {
    @kotlinx.serialization.Serializable <fields>;
}
-keep,includedescriptorclasses class dev.apex.apexbuilder.model.** { *; }
-keepclassmembers class dev.apex.apexbuilder.network.** { *; }
-dontwarn okhttp3.**
-dontwarn okio.**
