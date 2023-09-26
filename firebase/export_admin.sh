PREVIOUS_DIR=$(pwd)
cd firebase/admin
# firebase use --clear
# firebase use demo-gse-roar-admin
EXPORT_DIR="export-$(date -u '+%Y%m%d-%H%M%SUTC')"
firebase emulators:export --project demo-gse-roar-admin $EXPORT_DIR &
cd $PREVIOUS_DIR
