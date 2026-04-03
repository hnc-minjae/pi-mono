#!/usr/bin/env bash
# 한컴 스킬 공통 유틸리티. han-analyze, han-tdd, han-build 등에서 source로 포함.
# 빌드 파일 존재 여부로 프로젝트 타입을 자동 감지하여 출력한다.

detect_project_type() {
  local ROOT="${1:-.}"

  if [ -f "$ROOT/CMakeLists.txt" ] || ls "$ROOT"/*.pro 2>/dev/null | head -1 | grep -q '\.pro'; then
    echo "cpp"
  elif ls "$ROOT"/*.csproj 2>/dev/null | head -1 | grep -q '\.csproj' || ls "$ROOT"/*.sln 2>/dev/null | head -1 | grep -q '\.sln'; then
    echo "csharp"
  elif [ -f "$ROOT/pom.xml" ]; then
    echo "java-maven"
  elif [ -f "$ROOT/build.gradle" ] || [ -f "$ROOT/build.gradle.kts" ]; then
    echo "java-gradle"
  elif [ -f "$ROOT/package.json" ]; then
    echo "nodejs"
  elif [ -f "$ROOT/requirements.txt" ] || [ -f "$ROOT/pyproject.toml" ]; then
    echo "python"
  else
    echo "unknown"
  fi
}
