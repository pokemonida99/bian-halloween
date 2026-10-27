#!/bin/zsh
# gen.sh <out.png> <prompt> [ref]
# stdin 一定要接 /dev/null：在背景跑時 codex 會一直等輸入卡住
# 圖從這次 codex 的 session 資料夾拿（不能用「最新的檔」：別的專案同時在生圖會拿錯）
out=$1; prompt=$2; ref=$3
CODEX=/Applications/ChatGPT.app/Contents/Resources/codex-cli/bin/codex
if [ -n "$ref" ]; then
  $CODEX exec --skip-git-repo-check "Generate one image with your image generation tool: $prompt. Do not run any shell commands." -i "$ref" < /dev/null > "$out.log" 2>&1
else
  $CODEX exec --skip-git-repo-check "Generate one image with your image generation tool: $prompt. Do not run any shell commands." < /dev/null > "$out.log" 2>&1
fi
sid=$(grep -m1 -o 'session id: [0-9a-f-]*' "$out.log" | awk '{print $3}')
img=$(ls -t ~/.codex/generated_images/$sid/*.png 2>/dev/null | head -1)
if [ -n "$img" ]; then cp "$img" "$out"; echo "ok $out"; else echo "FAIL $out"; fi
