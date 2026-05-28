#!/usr/bin/env bash
set -euo pipefail
cred_file="/opt/slimy/sbuild/.sbuild-login-credentials.txt"
if [ ! -t 1 ] || [ ! -t 0 ]; then
  echo "Run this script from an interactive local terminal only."
  exit 1
fi
if [ ! -f "$cred_file" ]; then
  echo "Credential file not found: $cred_file"
  exit 1
fi
printf "This prints local sBuild login credentials from %s\n" "$cred_file"
printf "Press Enter to continue or Ctrl+C to cancel..."
read -r _
cat "$cred_file"
