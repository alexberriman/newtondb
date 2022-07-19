#!/bin/bash

npm run build \
  && cp package.json README.md logo.png LICENSE .build \
  && mkdir -p .build/docs/images \
  && cp -R ./docs/ .build/docs/

dot-json .build/package.json devDependencies --delete \
  && dot-json .build/package.json scripts --delete \
  && dot-json .build/package.json lint-staged --delete
