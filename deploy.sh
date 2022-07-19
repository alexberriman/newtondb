#!/bin/bash

npm run build \
  && cp package.json README.md LICENSE .build \
  && mkdir -p .build/static \
  && cp -R ./static/ .build/static/

dot-json .build/package.json devDependencies --delete \
  && dot-json .build/package.json scripts --delete \
  && dot-json .build/package.json lint-staged --delete
