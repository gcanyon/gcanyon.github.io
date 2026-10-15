#!/bin/sh
# Stitch src/ into a single readable index.html
cd "$(dirname "$0")"
{
  cat src/head.html
  echo '<script type="module">'
  echo '// Tap & Read — a tap-to-hear children'"'"'s reader. Built from src/ by build.sh.'
  for f in stories core speech learn ui games recog importer parent main; do echo; cat src/$f.js; done
  echo '</script>'
  echo '</body>'
  echo '</html>'
} > index.html
echo "built index.html ($(wc -c < index.html) bytes)"
