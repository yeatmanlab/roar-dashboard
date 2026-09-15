# ROAR-Multichoice

ROAR-MultiChoice is a template for running a number of different multiple choice assessments and surveys. Which multiple choice assessment is run is considered a _variant_ of ROAR-MultiChoice. Use the `task` parameter to set the variant. The default is ROAR-Morphology: `morphology`

`https://roar-multichoice.web.app/?task=morphology`

To run the Core Vocabulary Assessment (CVA), use: 'cva'

`https://roar-multichoice.web.app/?task=cva`

**Description of the Core Vocabulary Assessment**

- Dr. Elfrieda Hiebert and Dr. Midian Kurland developed the CVA, which includes representative
  words from the 2500 words that account for the majority of all words in books from grades K to
  The current CVA consists of two levels, one each for Grades 3-4 and Grades 5-6. There are
  two forms for each level (i.e., 4 test forms altogether).

**Goal of the ROAR/TextProject Collaboration**

- The goal of the ROAR/TextProject (https://textproject.org/) Collaboration is to develop an online version of the CVA to be
  administered at scale and to use it in research on student language and literacy development.
  To do so, the collaborators will work together to build an online app using the CVA item bank
  and work on establishing the reliability and validity of the online measure through pilot research
  in grades 3-5.

## Staging Environment

- https://roar-multichoice-staging.web.app/

## Configuration

Multichoice, like all ROAR apps, has parts of the game that you can control. The word in parentheses is the actual query string that you can pass parameter values into. For example: https://roar-multichoice.web.app/?mode=fullRandom&audioFeedback=neutral. Any parameter that has a default means that you do not need to explicitly define it. Here are the parameters and what they do:

-**User mode (mode)**: Controls certain things like number of trials and which trials the user will see. Defaults to fullAdaptive.

Options

- fullAdaptive
- testRandom
- fullRandom
- demo

-**Recruitment (recruitment)**: What the recruitment is. For data logging.

-**Assessment PID**: A unique identifier for data logging.

-**Audio Feedback (audioFeedback)**: What feedback the user will here.

Options:

- neutral

-**Birth Year (birthYear)**: The birth year of the user. Helps in showing age related trials like the story.

-**Birth Month (birthMonth)**: The birth month of the user. Helps in showing age related trials like the story.

-**Age (age)**: The age of the user. Helps in showing age related trials like the story.

-**Age in Months (ageMonths)**: The age in months of the user. Helps in showing age related trials like the story.

-**Skip Instructions (skip)**: Whether the instructions are allowed to be skipped or not.

Options:

- true
- false

-**Consent (consent)**: _Description goes here_

Options

- true
- false

-**Practice Corpus (practiceCorpus)**: The name of the CSV file to use for practice trials. Currently the location is hard coded so any new corpuses must be added in the exact folder of the Google bucket. The google bucket location is linked below. Go to roar-survey bucket -> en -> CSV. Defaults to morphology-surveyPractice.

-**Stimulus Corpus (stimulusCorpus)**: The name of the CSV file to use for stimulus trials. Currently the location is hard coded so any new corpuses must be added in the exact folder of the Google bucket. The google bucket location is linked below. Go to roar-survey bucket -> en -> CSV. Defaults to morphology-items.

-**Button Layout (buttonLayout)**: How the buttons should be layed out. The current options are linear, in a column, or in a 2x2 grid. The default is linear (default).
Options

- default
- column
- grid

-**Number of Trials (trials)**: How many stimulus trials should be shown to the user. This parameter takes precedence over User Mode. If both are defined, trials will be the number of trials shown. The minimum is 9 and the maximum is dictated by whatever corpus is used.

-**Prompt Width (width)**: The width of the stimulus prompt as a percentage of its parent container, where 100 is the full width of the container. Lower values will compress the text of the stimulus prompt into a smaller area. Default value is 75, and can take any value as desired (do not append % to the end of the url parameter). Text will wrap to a new line when its width percentage has been reached.

-**Sequential Practice Items (sequentialPractice)**: Determines whether the items from the practice corpus are administered randomly; defaults to true.

-**Sequential Stimulus Items (sequentialStimulus)**: Determines whether the items from the stimulus corpus are administered randomly; defaults to false.
**NOTE**: Items administered during the cva task are always randomized, and so this URL param will have no effect.

Options:

- true
- false

**Specs for ROAR-CVA**

- If grade is passed into the app, then select the appropriate grade level form. If grade is greater than 6, choose Grade 5-6 form. If grade is less than 3, choose 3-4 form. If grade is NA, then choose a form at random
- Form A/B parameter: If form A/B is defined, then choose that form. Default: randomly choose form A/B
- One a form has been selected, all the items from that form should be administered in a random order
- numRand parameter: to equate the different test forms we also want to make sure participants see some items from the other forms. nrand parameter should control the number of items that are randomly sampled from each of the forms that were not selected. For example, if nrand=3, grade=3, form=A, then the participant should see all the items from grade3-4 form A and then see 3 items randomly sampled from grade3-4 form B, 3 items from grade5-6 form A, 3 items from grade 5-6 form B. All the item ordering should be random. default nrand=3

## Resources

[Google bucket with assets (images, audio, CSV)](https://console.cloud.google.com/storage/browser/roar-survey;tab=objects?forceOnBucketsSortingFiltering=true&authuser=1&project=gse-roar-assessment&prefix=&forceOnObjectsSortingFiltering=false)
