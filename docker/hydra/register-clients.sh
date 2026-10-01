#!/bin/sh
# Registers the first-party OAuth2 clients in docker/hydra/clients (C89): for each
# <client-id>.json, create the client if it is missing, or update it to match the
# file. Re-running is safe. The secret is read from the Compose secret
# /run/secrets/hydra_client_<client-id> (C80) and never kept in the JSON files; it
# must contain only letters and digits, since it is placed into JSON as is.
set -eu

endpoint="${HYDRA_ADMIN_URL:-http://hydra:4445}"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

for file in /etc/hydra/clients/*.json; do
	id="$(basename "$file" .json)"
	secret="$(cat "/run/secrets/hydra_client_$id")"
	case "$secret" in
	*[!A-Za-z0-9]*) echo "secret for $id must be letters and digits only" >&2; exit 1 ;;
	esac
	# Add the id and secret to the client's JSON object (its first line is "{").
	sed "1s/^{/{\"client_id\": \"$id\", \"client_secret\": \"$secret\",/" "$file" >"$work/$id.json"

	if hydra get oauth2-client "$id" --endpoint "$endpoint" >/dev/null 2>&1; then
		hydra update oauth2-client "$id" --endpoint "$endpoint" --file "$work/$id.json" >/dev/null
		echo "updated $id"
	else
		{ echo "["; cat "$work/$id.json"; echo "]"; } >"$work/$id-list.json"
		hydra import oauth2-client "$work/$id-list.json" --endpoint "$endpoint" >/dev/null
		echo "created $id"
	fi
done
