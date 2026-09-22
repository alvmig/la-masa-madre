#!/usr/bin/env bash
# Ejecuta las consultas de sql/ contra el dataset público y guarda los
# resultados en sql/resultados/. Sirve para dos cosas: comprobar que las
# consultas funcionan antes de la formación y tener los números a mano para
# comentarlos en clase sin depender de la red.
#
#   ./scripts/run-sql.sh                 # todas
#   ./scripts/run-sql.sh 04              # solo la 04
set -uo pipefail
cd "$(dirname "$0")/.."
export PATH=/opt/homebrew/bin:$PATH
mkdir -p sql/resultados
filter="${1:-}"
fail=0
for f in sql/*.sql; do
  name=$(basename "$f" .sql)
  [ -n "$filter" ] && [[ "$name" != "$filter"* ]] && continue
  echo "── $name"
  # --dry_run primero: dice cuántos bytes escanearía, sin gastar cuota.
  bytes=$(bq query --use_legacy_sql=false --dry_run --format=json < "$f" 2>/dev/null \
          | python3 -c "import sys,json;print(json.load(sys.stdin)['statistics']['query']['totalBytesProcessed'])" 2>/dev/null || echo "?")
  [ "$bytes" != "?" ] && echo "   escanea $(python3 -c "print(f'{int($bytes)/1e9:.2f} GB')")"
  if bq query --use_legacy_sql=false --format=prettyjson --max_rows=30 < "$f" > "sql/resultados/$name.json" 2> "sql/resultados/$name.err"; then
    rows=$(python3 -c "import json;print(len(json.load(open('sql/resultados/$name.json'))))" 2>/dev/null || echo '?')
    echo "   OK · $rows filas → sql/resultados/$name.json"
  else
    echo "   FALLO:"; sed 's/^/     /' "sql/resultados/$name.err" | head -5; fail=1
  fi
done
exit $fail
