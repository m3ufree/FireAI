#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
DIST=build
mkdir -p "$DIST"

npx esbuild server/index.js --bundle --platform=node --target=node22 \
  --outfile="$DIST/fireai-bundle.js" --log-level=warning

cat > "$DIST/sea-config.json" <<'JSON'
{
  "main": "fireai-bundle.js",
  "output": "sea-prep.blob",
  "disableExperimentalSEAWarning": true,
  "useSnapshot": false,
  "useCodeCache": false,
  "assets": {
    "public/index.html": "public/index.html",
    "public/style.css": "public/style.css",
    "public/app.js": "public/app.js",
    "public/api.html": "public/api.html"
  }
}
JSON

node --experimental-sea-config "$DIST/sea-config.json"

node -e '
  const {pipeline}=require("stream/promises"); const {createWriteStream}=require("fs");
  async function dl(url,out){const r=await fetch(url,{redirect:"follow"}); if(!r.ok) throw new Error(url+" "+r.status); await pipeline(r.body, createWriteStream(out)); console.log("downloaded", out);}
  (async()=>{
    await dl("https://nodejs.org/dist/v22.23.5/node-v22.23.5-linux-x64.tar.gz","build/node-linux.tar.gz");
    await dl("https://nodejs.org/dist/v22.23.5/win-x64/node.exe","build/node-win.exe");
  })()
'

( cd "$DIST" && tar -xzf node-linux.tar.gz node-v22.23.5-linux-x64/bin/node )
mv "$DIST/node-v22.23.5-linux-x64/bin/node" "$DIST/FireAI-linux-x64"
cp "$DIST/node-win.exe" "$DIST/FireAI-win-x64.exe"
rm -rf "$DIST/node-linux.tar.gz" "$DIST/node-win.exe" "$DIST/node-v22.23.5-linux-x64"

npx postject "$DIST/FireAI-linux-x64" NODE_SEA_BLOB "$DIST/sea-prep.blob" \
  --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2
npx postject "$DIST/FireAI-win-x64.exe" NODE_SEA_BLOB "$DIST/sea-prep.blob" \
  --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2
chmod +x "$DIST/FireAI-linux-x64"

echo "OK: build/FireAI-win-x64.exe, build/FireAI-linux-x64"
