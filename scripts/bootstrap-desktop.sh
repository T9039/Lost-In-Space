#!/usr/bin/env bash
# Bootstrap Lost in Space on a new machine.
#
# Usage:
#   bash scripts/bootstrap-desktop.sh
#   PROJECT_DIR=~/Projects/lost-in-space bash scripts/bootstrap-desktop.sh
#
# It clones the public repository, installs the Python and Node dependencies,
# runs the tests and builds the app and the documentation. It does not create a
# database; set DATABASE_URL and apply the schema separately.

set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/T9039/Lost-In-Space.git}"
PROJECT_DIR="${PROJECT_DIR:-$HOME/Projects/lost-in-space}"

say() { printf '\n== %s ==\n' "$*"; }
have() { command -v "$1" >/dev/null 2>&1; }

say "Tools"
missing=()
for tool in git node npm python3; do
  if have "$tool"; then
    printf '  %-8s %s\n' "$tool" "$("$tool" --version 2>/dev/null | head -1)"
  else
    printf '  %-8s MISSING\n' "$tool"
    missing+=("$tool")
  fi
done
if have typst; then
  printf '  %-8s %s\n' typst "$(typst --version 2>/dev/null | head -1)"
else
  printf '  %-8s optional, missing (documentation build will be skipped)\n' typst
fi

if ((${#missing[@]})); then
  cat <<'EOF'

Missing tools. Install them with your package manager, then re-run:

  Arch / Omarchy:  sudo pacman -S git nodejs npm python typst
  Debian/Ubuntu:   sudo apt install git nodejs npm python3
  Typst:           https://github.com/typst/typst#installation

Nothing has been changed yet.
EOF
  exit 1
fi

if [[ ! -d "$PROJECT_DIR/.git" ]]; then
  say "Clone into $PROJECT_DIR"
  mkdir -p "$(dirname "$PROJECT_DIR")"
  git clone "$REPO_URL" "$PROJECT_DIR"
else
  say "Update $PROJECT_DIR"
  git -C "$PROJECT_DIR" pull --ff-only
fi

cd "$PROJECT_DIR"

say "Python environment"
python3 -m venv .venv
.venv/bin/pip install -q --upgrade pip
.venv/bin/pip install -q -r etl/requirements.txt -r etl/requirements-dev.txt
.venv/bin/python -m pytest etl/tests -q

say "Node dependencies"
npm ci

say "Typecheck"
npm run typecheck

say "Build"
npm run build

if have typst; then
  say "Documentation"
  (cd docs/technical && typst compile main.typ)
else
  say "Documentation skipped (typst is not installed)"
fi

cat <<EOF

Done. The project is at:
  $PROJECT_DIR

Next:
  1. Set DATABASE_URL (managed Postgres for development, Render for production)
     and apply the schema:
       .venv/bin/python scripts/apply_sql.py \
         db/schema.sql db/seed/001_lookups.sql db/staging.sql
  2. Run the ETL:
       .venv/bin/python -m etl.download_gcat
       .venv/bin/python -m etl.load_staging
       .venv/bin/python -m etl.transform
       .venv/bin/python -m etl.curate
       .venv/bin/python -m etl.validate
  3. Start the app:
       npm run dev
  4. Read SESSION_CONTEXT.md and ROADMAP.md before changing code.
EOF
