#!/usr/bin/env bash
set -euo pipefail

# Setup

base="$1"
slug="$2"
failed=0

expect() {
  local language="$1" url="$2" expected="$3" actual
  actual=$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' -H "Accept-Language: $language" "$base$url")
  if [ "$actual" = "$expected" ]; then
    echo "ok   '$language' $url -> $actual"
  else
    echo "::error::'$language' $url -> $actual, expected $expected"
    failed=1
  fi
}

# Checks

expect "de-DE,de;q=0.9,en;q=0.8" "/$slug/" "302 $base/$slug/de/"
expect "de-AT" "/$slug/index.html" "302 $base/$slug/de/"
expect "fr-FR,fr;q=0.9,de;q=0.8" "/$slug/" "302 $base/$slug/de/"
expect "en-US,en;q=0.9,de;q=0.8" "/$slug/" "302 $base/$slug/en/"
expect "fr-FR,it" "/$slug/" "302 $base/$slug/en/"
expect "" "/$slug/" "302 $base/$slug/en/"
expect "de-DE" "/$slug/en/" "200 "
expect "en-US" "/$slug/de/" "200 "
expect "de-DE" "/$slug/assets/logo.svg" "200 "
expect "de-DE,de;q=0.9,en;q=0.8" "/" "302 $base/de/"
expect "en-US,en;q=0.9,de;q=0.8" "/index.html" "302 $base/en/"
expect "fr-FR" "/" "302 $base/en/"
expect "de-DE" "/en/" "200 "
expect "en-US" "/de/" "200 "
expect "de-DE" "/robots.txt" "200 "
expect "de-DE,de;q=0.9,en;q=0.8" "/imprint/" "302 $base/imprint/de/"
expect "en-US" "/privacy/" "302 $base/privacy/en/"
expect "en-US" "/privacy/de/" "200 "

for url in "/$slug/" "/"; do
  if ! curl -sI -H "Accept-Language: de" "$base$url" | grep -qi '^vary:.*accept-language'; then
    echo "::error::Redirect response for $url has no Vary: Accept-Language"
    failed=1
  fi
done
exit "$failed"
