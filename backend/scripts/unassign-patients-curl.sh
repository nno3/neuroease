#!/bin/bash
# Unassign patients from the test caregiver using the API.
# Usage: ./scripts/unassign-patients-curl.sh
#
# 1. Login as test caregiver (test.caregiver@neuroease.test / TestPass123!)
# 2. DELETE each patient assignment
#
# Update API_BASE if your backend runs on a different host/port.

API_BASE="${API_BASE:-http://localhost:5001/api}"
PATIENT_IDS="14 15 16 17 18 19 20 24 25 26 27 28"

# Login and extract token
echo "Logging in..."
RESP=$(curl -s -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"test.caregiver@neuroease.test","password":"TestPass123!"}')

TOKEN=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('token',''))" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "Login failed. Response: $RESP"
  exit 1
fi

echo "Token obtained. Unassigning patients..."

for id in $PATIENT_IDS; do
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$API_BASE/patients/$id" \
    -H "Authorization: Bearer $TOKEN")
  if [ "$HTTP" = "200" ]; then
    echo "  $id: unassigned"
  else
    echo "  $id: HTTP $HTTP (may already be unassigned or not found)"
  fi
done

echo "Done."
