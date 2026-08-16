#!/usr/bin/env bash
# Full functional smoke test against local Postgres mode.
set -euo pipefail

BASE="${BASE_URL:-http://127.0.0.1:3000}"
COOKIE_JAR="$(mktemp)"
PASS=0
FAIL=0

assert() {
  local name="$1"
  local cond="$2"
  if eval "$cond"; then
    echo "PASS  $name"
    PASS=$((PASS + 1))
  else
    echo "FAIL  $name"
    FAIL=$((FAIL + 1))
  fi
}

json_field() {
  # naive extract: python for reliability
  python3 -c "import json,sys; d=json.load(sys.stdin); print($1)" 2>/dev/null
}

echo "=== 1. Login: wrong password ==="
CODE=$(curl -s -o /tmp/login_bad.json -w "%{http_code}" -X POST "$BASE/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"teacher@test.com","password":"wrong"}')
assert "login rejects bad password" "[[ '$CODE' == '401' ]]"

echo "=== 2. Login: correct ==="
CODE=$(curl -s -c "$COOKIE_JAR" -o /tmp/login_ok.json -w "%{http_code}" -X POST "$BASE/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"teacher@test.com","password":"TestPass123!"}')
EMAIL=$(python3 -c "import json; print(json.load(open('/tmp/login_ok.json'))['email'])")
assert "login success 200" "[[ '$CODE' == '200' ]]"
assert "login returns teacher email" "[[ '$EMAIL' == 'teacher@test.com' ]]"
assert "session cookie set" "grep -q tasksite_session '$COOKIE_JAR'"

echo "=== 3. Auth guard ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/tasks")
assert "tasks without cookie → 401" "[[ '$CODE' == '401' ]]"

echo "=== 4. Empty list ==="
LIST=$(curl -s -b "$COOKIE_JAR" "$BASE/api/tasks")
assert "empty task list is []" "[[ '$LIST' == '[]' ]]"

echo "=== 5. Create task (all field types in HTML) ==="
python3 - <<'PY' > /tmp/create_body.json
import json
html = """<!DOCTYPE html><html><body>
<label>Text <input type="text" name="q_text" /></label>
<label>Textarea <textarea name="q_area"></textarea></label>
<label><input type="radio" name="q_radio" value="a" /> A</label>
<label><input type="radio" name="q_radio" value="b" /> B</label>
<label><input type="checkbox" name="q_check" value="1" /> One</label>
<label><input type="checkbox" name="q_check" value="2" /> Two</label>
<select name="q_select"><option value="x">X</option><option value="y">Y</option></select>
</body></html>"""
print(json.dumps({
  "title": "Lesson Present Simple",
  "student_name": "Ivan",
  "html_content": html,
}))
PY

CODE=$(curl -s -b "$COOKIE_JAR" -c "$COOKIE_JAR" -o /tmp/create.json -w "%{http_code}" \
  -X POST "$BASE/api/tasks" -H 'Content-Type: application/json' -d @/tmp/create_body.json)
TASK_ID=$(python3 -c "import json; print(json.load(open('/tmp/create.json'))['id'])")
SLUG=$(python3 -c "import json; print(json.load(open('/tmp/create.json'))['slug'])")
STATUS=$(python3 -c "import json; print(json.load(open('/tmp/create.json'))['status'])")
assert "create task 201" "[[ '$CODE' == '201' ]]"
assert "task has slug" "[[ ${#SLUG} -eq 12 ]]"
assert "new task not_started" "[[ '$STATUS' == 'not_started' ]]"

echo "=== 6. Teacher list / get ==="
LIST=$(curl -s -b "$COOKIE_JAR" "$BASE/api/tasks")
COUNT=$(python3 -c "import json; print(len(json.load(open('/dev/stdin'))))" <<<"$LIST")
assert "list has 1 task" "[[ '$COUNT' == '1' ]]"

DETAIL=$(curl -s -b "$COOKIE_JAR" "$BASE/api/tasks/$TASK_ID")
TITLE=$(python3 -c "import json; print(json.load(open('/dev/stdin'))['title'])" <<<"$DETAIL")
ANSWERS=$(python3 -c "import json; print(json.load(open('/dev/stdin'))['answers'])" <<<"$DETAIL")
assert "get task title" "[[ '$TITLE' == 'Lesson Present Simple' ]]"
assert "answers start empty {}" "[[ '$ANSWERS' == '{}' ]]"

echo "=== 7. Public get by slug ==="
PUB=$(curl -s "$BASE/api/public/tasks/$SLUG")
PUB_TITLE=$(python3 -c "import json; print(json.load(open('/dev/stdin'))['title'])" <<<"$PUB")
assert "public get title" "[[ '$PUB_TITLE' == 'Lesson Present Simple' ]]"

echo "=== 8. Student autosave all field types ==="
ANS_BODY='{"answers":{"q_text":"goes","q_area":"She goes to school","q_radio":"b","q_check":["1","2"],"q_select":"y"}}'
CODE=$(curl -s -o /tmp/ans.json -w "%{http_code}" -X PATCH "$BASE/api/public/tasks/$SLUG/answers" \
  -H 'Content-Type: application/json' -d "$ANS_BODY")
NEW_STATUS=$(python3 -c "import json; print(json.load(open('/tmp/ans.json'))['status'])")
assert "student save answers 200" "[[ '$CODE' == '200' ]]"
assert "status → in_progress" "[[ '$NEW_STATUS' == 'in_progress' ]]"

curl -s "$BASE/api/public/tasks/$SLUG" > /tmp/pub_after_ans.json
python3 - <<'PY'
import json
d=json.load(open("/tmp/pub_after_ans.json"))
a=d["answers"]
checks=[
  a.get("q_text")=="goes",
  a.get("q_area")=="She goes to school",
  a.get("q_radio")=="b",
  a.get("q_check")==["1","2"],
  a.get("q_select")=="y",
  d.get("status")=="in_progress",
]
open("/tmp/ans_check.txt","w").write("ok" if all(checks) else "bad:"+json.dumps(a, ensure_ascii=False))
PY
CHECK=$(cat /tmp/ans_check.txt)
assert "all field types persisted" "[[ '$CHECK' == 'ok' ]]"

echo "=== 9. Teacher can read/edit answers ==="
DETAIL=$(curl -s -b "$COOKIE_JAR" "$BASE/api/tasks/$TASK_ID")
T_TEXT=$(python3 -c "import json; print(json.load(open('/dev/stdin'))['answers']['q_text'])" <<<"$DETAIL")
assert "teacher sees student answer" "[[ '$T_TEXT' == 'goes' ]]"

CODE=$(curl -s -b "$COOKIE_JAR" -o /tmp/teacher_ans.json -w "%{http_code}" \
  -X PATCH "$BASE/api/tasks/$TASK_ID/answers" \
  -H 'Content-Type: application/json' \
  -d '{"answers":{"q_text":"goes!","q_area":"edited","q_radio":"a","q_check":["1"],"q_select":"x"}}')
assert "teacher edit answers 200" "[[ '$CODE' == '200' ]]"

DETAIL=$(curl -s -b "$COOKIE_JAR" "$BASE/api/tasks/$TASK_ID")
T_TEXT=$(python3 -c "import json; print(json.load(open('/dev/stdin'))['answers']['q_text'])" <<<"$DETAIL")
assert "teacher edit persisted" "[[ '$T_TEXT' == 'goes!' ]]"

echo "=== 10. Complete / reopen ==="
CODE=$(curl -s -o /tmp/complete.json -w "%{http_code}" -X PATCH "$BASE/api/public/tasks/$SLUG/complete")
ST=$(python3 -c "import json; print(json.load(open('/tmp/complete.json'))['status'])")
assert "complete 200" "[[ '$CODE' == '200' ]]"
assert "status completed" "[[ '$ST' == 'completed' ]]"

CODE=$(curl -s -o /tmp/block.json -w "%{http_code}" -X PATCH "$BASE/api/public/tasks/$SLUG/answers" \
  -H 'Content-Type: application/json' -d '{"answers":{"q_text":"nope"}}')
assert "answers blocked when completed" "[[ '$CODE' == '403' ]]"

CODE=$(curl -s -o /tmp/reopen.json -w "%{http_code}" -X PATCH "$BASE/api/public/tasks/$SLUG/reopen")
ST=$(python3 -c "import json; print(json.load(open('/tmp/reopen.json'))['status'])")
assert "reopen 200" "[[ '$CODE' == '200' ]]"
assert "reopen → in_progress" "[[ '$ST' == 'in_progress' ]]"

echo "=== 11. Duplicate ==="
CODE=$(curl -s -b "$COOKIE_JAR" -o /tmp/dup.json -w "%{http_code}" \
  -X POST "$BASE/api/tasks/$TASK_ID/duplicate" \
  -H 'Content-Type: application/json' \
  -d '{"student_name":"Maria"}')
DUP_STATUS=$(python3 -c "import json; print(json.load(open('/tmp/dup.json'))['status'])")
DUP_STUDENT=$(python3 -c "import json; print(json.load(open('/tmp/dup.json'))['student_name'])")
assert "duplicate 201" "[[ '$CODE' == '201' ]]"
assert "duplicate not_started" "[[ '$DUP_STATUS' == 'not_started' ]]"
assert "duplicate student Maria" "[[ '$DUP_STUDENT' == 'Maria' ]]"

echo "=== 12. Delete ==="
DUP_ID=$(python3 -c "import json; print(json.load(open('/tmp/dup.json'))['id'])")
CODE=$(curl -s -b "$COOKIE_JAR" -o /tmp/del.json -w "%{http_code}" -X DELETE "$BASE/api/tasks/$DUP_ID")
assert "delete 200" "[[ '$CODE' == '200' ]]"
LIST=$(curl -s -b "$COOKIE_JAR" "$BASE/api/tasks")
COUNT=$(python3 -c "import json; print(len(json.load(open('/dev/stdin'))))" <<<"$LIST")
assert "one task left after delete" "[[ '$COUNT' == '1' ]]"

echo "=== 13. Logout ==="
CODE=$(curl -s -b "$COOKIE_JAR" -c "$COOKIE_JAR" -o /tmp/logout.json -w "%{http_code}" -X POST "$BASE/api/auth/logout")
assert "logout 200" "[[ '$CODE' == '200' ]]"
CODE=$(curl -s -b "$COOKIE_JAR" -o /dev/null -w "%{http_code}" "$BASE/api/tasks")
assert "after logout tasks 401" "[[ '$CODE' == '401' ]]"

echo "=== 14. Pages render ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/login")
assert "login page 200" "[[ '$CODE' == '200' ]]"
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/task/$SLUG")
assert "student task page 200" "[[ '$CODE' == '200' ]]"

echo "=== 15. Middleware guards ==="
CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/dashboard")
assert "dashboard without auth redirects" "[[ '$CODE' == '307' || '$CODE' == '302' ]]"

# login again for positive checks
curl -s -c "$COOKIE_JAR" -X POST "$BASE/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"teacher@test.com","password":"TestPass123!"}' > /dev/null
CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" "$BASE/dashboard")
assert "dashboard with auth 200" "[[ '$CODE' == '200' ]]"
CODE=$(curl -s -o /dev/null -w "%{http_code}" -b "$COOKIE_JAR" "$BASE/login")
assert "login with auth redirects" "[[ '$CODE' == '307' || '$CODE' == '302' ]]"

echo
echo "======== RESULT: $PASS passed, $FAIL failed ========"
rm -f "$COOKIE_JAR"
[[ "$FAIL" -eq 0 ]]
