# Notes for ROAR-SRE Maintainers

One of this repository's GitHub actions uses a Firebase Admin SDK Service account set up the Firebase emulator suite, with which to run Cypress end-to-end tests. The public key ID of this service account key is `4bcf8a9f1c56dfe04e989bde05bdb5ae70f1e1b2`. It is only used for this GitHub action in the ROAR-SWR and ROAR-SRE repositories. It is not stored locally on any device.
