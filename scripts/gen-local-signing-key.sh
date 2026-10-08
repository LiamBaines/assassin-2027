#!/usr/bin/env bash
# Generates the local ES256 JWT signing key used by `supabase start`,
# so local tokens are signed the same way as production (asymmetric, JWKS).
# The CLI writes to [auth] signing_keys_path itself and needs an existing JSON array.
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -s supabase/signing_keys.json ]] && grep -q '"kty"' supabase/signing_keys.json; then
  echo "supabase/signing_keys.json already has a key; leaving it alone."
  exit 0
fi
echo '[]' > supabase/signing_keys.json
supabase gen signing-key --algorithm ES256 --append < /dev/null
