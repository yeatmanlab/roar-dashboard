PREVIOUS_DIR=$(pwd)
cd firebase/admin
# firebase use --clear
# firebase use demo-gse-roar-admin
firebase emulators:start --project demo-gse-roar-admin --import export-20230910-122923UTC &
cd $PREVIOUS_DIR
