#!/bin/bash
npm i
node index.js @iarna/demo-esm-2
echo
echo "Try loading demo.html when the server is ready"
echo
npx serve -o
