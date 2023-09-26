PREVIOUS_DIR=$(pwd)
cd firebase/assessment
# firebase use --clear
# firebase use demo-gse-roar-assessment
firebase emulators:start --project demo-gse-roar-assessment --import export-20230922-111607UTC &
cd $PREVIOUS_DIR