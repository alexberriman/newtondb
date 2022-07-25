#!/bin/bash

npm run benchmark > /dev/null

echo ""
echo "<details>"
echo "<summary>View benchmarks</summary>"
echo ""

find .benchmark -type f -name "*.json" -print0 | xargs -0 jq -r '("- "+.name+": "),(.results[] | "  - "+(.name)+": "+(.ops|tostring)+" ops/s")'

echo ""
echo "</details>"
echo ""