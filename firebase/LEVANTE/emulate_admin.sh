PREVIOUS_DIR=$(pwd)
cd firebase/LEVANTE/admin
# firebase use --clear
# firebase use hs-levante-admin-dev
firebase emulators:start --project hs-levante-admin-dev --import export-20240315-054039UTC &
cd $PREVIOUS_DIR