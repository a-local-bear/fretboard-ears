#!/usr/bin/env bash
# Issues on the project board (https://github.com/users/a-local-bear/projects/1), via the gh CLI.
#
#   tools/issue.sh new "Title" woozy,ui ["Body"]   open an issue with these labels, on the board as Todo
#   tools/issue.sh start 61                        move issue 61 to In Progress
#   tools/issue.sh todo 61 | done 61               move it to Todo or Done
#
# Labels: one app (ear-training, fretwise, woozy, site) and a kind (logic, audio, ui, pwa, verify, setup, idea, bug).
# An issue closes by itself when a commit with "Fixes #61" reaches main.
set -euo pipefail

OWNER=a-local-bear
PROJECT=1

status() { # status <issue number> <Status name>
  local url item project field option
  url="$(gh issue view "$1" --json url --jq .url)"
  item="$(gh project item-add "$PROJECT" --owner "$OWNER" --url "$url" --format json --jq .id)" # also finds an item already there
  project="$(gh project view "$PROJECT" --owner "$OWNER" --format json --jq .id)"
  field="$(gh project field-list "$PROJECT" --owner "$OWNER" --format json --jq '.fields[] | select(.name == "Status")')"
  option="$(jq -r --arg name "$2" '.options[] | select(.name == $name) | .id' <<<"$field")"
  gh project item-edit --project-id "$project" --id "$item" --field-id "$(jq -r .id <<<"$field")" --single-select-option-id "$option" >/dev/null
  echo "#$1: $2"
}

case "${1:-}" in
  new)
    [[ $# -ge 3 ]] || { echo 'usage: tools/issue.sh new "Title" label,label ["Body"]'; exit 1; }
    url="$(gh issue create --title "$2" --label "$3" --body "${4:-}" | tail -n 1)"
    echo "$url"
    status "${url##*/}" Todo
    ;;
  start) status "$2" 'In Progress' ;;
  todo) status "$2" Todo ;;
  done) status "$2" Done ;;
  *) sed -n '2,9p' "$0" | sed 's/^# \{0,1\}//'; exit 1 ;;
esac
