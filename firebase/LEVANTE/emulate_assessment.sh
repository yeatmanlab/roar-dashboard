PREVIOUS_DIR=$(pwd)
cd firebase/LEVANTE/assessment
# firebase use --clear
# firebase use hs-levante-assessment-dev
firebase emulators:start --project hs-levante-assessment-dev --import export-20240315-053501UTC &
cd $PREVIOUS_DIR