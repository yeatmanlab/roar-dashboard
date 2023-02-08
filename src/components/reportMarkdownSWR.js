export const introduction = ({}) => `
# Single Word Recognition Score Report

## Introduction to ROAR - Single Word Recognition

***ROAR - Single Word Recognition*** examines the ability to **quickly
and automatically recognize individual words**. Students need to achieve
both mastery of decoding and automaticity in word recognition in order
to achieve fluency in reading. Research shows that poor word recognition
is a barrier to comprehension for many students. Students not receiving
support for their foundational reading skills may struggle to catch up
in overall reading ability. This assessment is intended to help identify
students who need intensive support for decoding individual words.

**This score report** provides information about the distribution of
scores across each grade and how each student's skills compare to the
national norms for their age group.

**The assessment** provides a measure of orthographic mapping, the
automatic use of sound-symbol correspondence. During the test, a word
flashes on the screen, and students categorize the word as real or
made-up, e.g., *“bake”* is a real word, and *“xop”* is a made-up word.

The entire assessment takes most students fewer than 10 minutes.
`;

export const overviewStats = ({ adminSeason, numStudents, ageMean, gradeMin, gradeMax, roarScoreMean, roarScoreMin, roarScoreMax, roarScoreSD }) => `
## Overview

This score report presents information from the recent administration of
the ROAR assessment to students during ${adminSeason}.

-   ${numStudents} students completed the Single Word Recognition task.

-   The average age of the student was ${ageMean}.

-   The grades ranged from grade ${gradeMin} to grade ${gradeMax}.

-   The average ROAR score was ${roarScoreMean} on a scale of 100 - 900 (min =
    ${roarScoreMin}, max = ${roarScoreMax} , sd = ${roarScoreSD}).
`;

export const supportSection1 = ({}) => `
## Identifying Students who could Benefit from Support

The Woodcock-Johnson Basic Reading Skills Index WJ is a standardized
test that was normed on a representative sample. [By using ROAR scores
to estimate WJ
scores](https://www.nature.com/articles/s41598-021-85907-x), we show how
each student's single word recognition skills relate to national norms.

The vertical cut scores represent thresholds for classifying students
into three different categories: *At or Above Average*, *Needs Some
Support*, or *Needs Extra Support*.

-   At or Above Average: Students whose word recognition is above the
    50th percentile.

-   Needs Some Support: Students whose word recognition is between the
    25th and 50th percentile.

-   Needs Extra Support: Students whose word recognition is below the
    25th percentile.
`;

export const supportSection2 = ({ numStudentsAboveAverage, numStudentsNeedSomeSupport, numStudentsNeedExtraSupport }) => `
According to these classifications:

-   ${numStudentsAboveAverage} students are classified as "At or Above Average."

-   ${numStudentsNeedSomeSupport} students are classified as "Need Some Support."

-   ${numStudentsNeedExtraSupport} students are classified as "Need Extra Support."
`;

export const automaticity1 = ({}) => `
### Identifying Automaticity in First Grade

As children's reading skills improve, word recognition becomes
automatic: Rather than sounding out words one letter at a time, they
develop automaticity in word recognition and can recognize a word at a
glance. This ability begins developing around first grade but some
children do not begin achieving automaticity until later. In this score
report, first grade children are categorized as either having "limited
automaticity" or "at or above average automaticity". Students with
limited automaticity are likely to benefit from increased instruction
and continued monitoring of progress.
`

export const automaticity2 = ({ numStudentsAboveAverageAutomaticity, numStudentsLimitedAutomaticity }) => `
According to these classifications:

- ${numStudentsAboveAverageAutomaticity} students displayed "At or Above Average Automaticity."

- ${numStudentsLimitedAutomaticity} students displayed "Limited Automaticity."
`;

export const supportClassificationDistributions = ({}) => `
### Distribution of Support Classifications by Grade
`;

export const automaticityDistributionsFirstGrade = ({}) => `
### Distribution of Automaticity in First Grade
`;

export const studentScoreInformation = ({}) => `
## Student Score Information

Below is an interactive data table of the de-identified students that
can be filtered and downloaded. We will provide a list of identified IDs
as part of a secure file transfer, separately from this report.
`;

export const interpretation = ({}) => `
### Notes on Interpreting this Score Report

-   Results from this rapid screener should be interpreted in the
    context of other information you have about each student's reading
    ability. For example, a student who is not fully engaged during the
    assessment may receive a score that does not reflect their true
    ability.

-   Students who are flagged as needing extra support with single-word
    recognition need intensive support with decoding skills before they
    will become fluent with reading.

-   For English Language Learners, *ROAR Single Word Recognition* scores
    should be considered along with knowledge about the student's
    current level of English vocabulary. Words that are not in their
    oral vocabulary may be correctly decoded but not recognized as real
    words.

-   The scores on the 10-minute single-word recognition assessment
    predict students' scores on the Woodcock-Johnson Basic Reading
    Skills Index with high accuracy, thus, *ROAR Single Word
    Recognition* provides a highly efficient way to screen a group of
    students for acute literacy needs and strengths without expending
    the time and resources to individually administer lengthy
    assessments. For more information on how ROAR relates to the
    Woodcock-Johnson Basic Reading Skills Index see:
    <a href="https://www.nature.com/articles/s41598-021-85907-x"
    class="uri"><strong>https://www.nature.com/articles/s41598-021-85907-x</strong></a>**.**

-   Ongoing research continues to refine thresholds for identifying
    students who may benefit from additional support. Defining
    thresholds for identifying students who may benefit from additional
    support is part of our ongoing research. As part of this research
    collaborative, we invite your feedback about the information you see
    here.

### Teacher Resources for Reading Support

-   The Florida Center for Reading Research offers free, online,
    age-specific, research-based lessons on phonological awareness and
    other foundational reading skills designed for pre-K through
    5th-grade students
    [here](https://fcrr.org/student-center-activities/teacher-resource-guide).

### Invitation to Collaborate!

Please reach out to [Jasmine Tran](jasetran@stanford.edu) and [Tonya
Murray](tonyamur@stanford.edu) for questions or clarification on this
score report and/or recommendations for how to improve future score
reports.
`;
