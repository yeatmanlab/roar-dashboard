# ROAR-SWR (v3.x)

Development for jsPsych version of ROAR-Single Word Recognition.
Versions and their dependencies are packaged within
folders to ensure continued functionality as new test versions are deployed.

## Links

- Deployed experiment available https://roar-word.web.app
- Staging environment available at https://roar-word-staging.web.app

## Instructions for Testing

- To run tests use the command npx playwright test

  - Optionally add --trace on flag to get detailed logs (flags go at the end of the command)
  - To pass in arguments (env variables) use all caps and prefix before the command
    Ex. MODE=demo npx playwright test

- To change the values being tested, you can change the variable values in testHelperFunctions.js located in the **tests**/e2e folder

- To change what modes are being tested, comment them in or out in the testHelperFunctions.js file. Any tests that are commented in or out must also be commented in or out in the github action file located in .github/workflows/firebase-preview.yml
  - For example, if you want to test the fullRandom mode, you can comment it in in the the test helpers, and do the same in the github workflows file.

NOTE: You may need to install some things from playwright for the test to run (it will tell when you run the command)
