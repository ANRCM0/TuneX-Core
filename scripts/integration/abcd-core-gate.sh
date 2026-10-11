#!/usr/bin/env bash
# Real core acceptance, on the existing disposable topology (no production DB).
set -euo pipefail
REPO=${REPO:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}
HERE="$REPO/scripts/integration"
export TUNEX_TST_ENABLED=true
export TUNEX_LINK_MAINTENANCE_ENABLED=true
export FORWARD_NATIVE_BOTH_ENABLED=true
export TUNEX_ROUTING_ENABLED=true
export TUNEX_ROUTING_PROBES_ENABLED=true
export TUNEX_IT_AGENT_VERSION=${TUNEX_IT_AGENT_VERSION:-0.0.0-it}
bash "$HERE/setup.sh"
python3 "$HERE/tst-forward.py"
python3 "$HERE/native-both.py"
python3 "$HERE/routing-probe.py"
echo "Evidence: $HERE/evidence/tst-forward-result.txt"
echo "Evidence: $HERE/evidence/native-both-result.txt"
echo "Evidence: $HERE/evidence/routing-probe-result.txt"
echo "The existing current-protocol and A00 gates remain required release checks."
