PREVIOUS_DIR=$(pwd)
cd firebase/assessment
# firebase use --clear
# firebase use demo-gse-roar-assessment
EXPORT_DIR="export-$(date -u '+%Y%m%d-%H%M%SUTC')"
firebase emulators:export --project demo-gse-roar-assessment $EXPORT_DIR &
cd $PREVIOUS_DIR