#!/usr/bin/env bash
# gh-pages 브랜치로 정적 사이트를 배포한다.
# 사용: ./deploy/deploy.sh
set -euo pipefail

cd "$(dirname "$0")/.."

REMOTE="${REMOTE:-https://github.com/littleyeona7/saju-ai-app.git}"

npm run verify
npm run build

WORK="$(mktemp -d)"
cp -r dist/. "$WORK"/
touch "$WORK/.nojekyll"

cd "$WORK"
git init -q
git checkout -q -b gh-pages
git add -A
git -c user.name="${GIT_AUTHOR_NAME:-littleyeona7}" \
    -c user.email="${GIT_AUTHOR_EMAIL:-littleyeona7@users.noreply.github.com}" \
    commit -q -m "deploy: $(date +%Y-%m-%dT%H:%M)"
git remote add origin "$REMOTE"
git push origin gh-pages --force

echo "배포 완료 → https://littleyeona7.github.io/saju-ai-app/"
