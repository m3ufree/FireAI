#!/usr/bin/env bash
set -euo pipefail

SDK=${SDK:-/workspace/android-build/sdk}
BUILD=${BUILD:-/workspace/android-build/apk}
JAVA_HOME=${JAVA_HOME:-/workspace/android-build/jdk17}
export PATH="$JAVA_HOME/bin:$SDK/build-tools/34.0.0:$PATH"

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"
rm -rf "$BUILD"
mkdir -p "$BUILD/assets" "$BUILD/classes" "$BUILD/dex"

node tools/gen-icon.js
node tools/build-assets.js --out "$BUILD/assets/index.html"

cd "$BUILD"
aapt2 compile --dir "$ROOT/res" -o res.zip
aapt2 link -o base.apk \
  -I "$SDK/platforms/android-34/android.jar" \
  --manifest "$ROOT/AndroidManifest.xml" \
  -A assets \
  --min-sdk-version 24 --target-sdk-version 34 \
  --auto-add-overlay \
  res.zip

javac -source 8 -target 8 -nowarn \
  -classpath "$SDK/platforms/android-34/android.jar" \
  -d classes \
  "$ROOT/java/com/m3ufree/fireai/MainActivity.java" 2>/dev/null

d8 --release --min-api 24 --lib "$SDK/platforms/android-34/android.jar" \
  --output dex classes/com/m3ufree/fireai/*.class

(cd dex && zip -q -u ../base.apk classes.dex)
zipalign -f 4 base.apk aligned.apk

if [ ! -f keystore.jks ]; then
  keytool -genkeypair -v -keystore keystore.jks -alias fireai \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass fireai123 -keypass fireai123 \
    -dname "CN=FireAI, OU=FireAI, O=m3ufree, C=RU" >/dev/null 2>&1
fi

apksigner sign --ks keystore.jks --ks-pass pass:fireai123 --key-pass pass:fireai123 \
  --out FireAI.apk aligned.apk

echo "OK: $BUILD/FireAI.apk"
