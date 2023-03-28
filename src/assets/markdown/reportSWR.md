# Single Word Recognition Score Report

## Introduction to ROAR - Single Word Recognition

***ROAR - Single Word Recognition*** examines the ability to **quickly and automatically recognize individual words**. Students need to achieve both mastery of decoding and automaticity in word recognition in order to achieve fluency in reading. Research shows that poor word recognition is a barrier to comprehension for many students. Students not receiving support for their foundational reading skills may struggle to catch up in overall reading ability. This assessment is intended to help identify students who need intensive support for decoding individual words.

**This score report** provides information about the distribution of scores across each grade and how each student's skills compare to the national norms for their age group.

**The assessment** provides a measure of orthographic mapping, the automatic use of sound-symbol correspondence. During the test, a word flashes on the screen, and students categorize the word as real or made-up, e.g., *'lake'* is a real word, and *'xop'* is a made-up word. The assessment takes most students fewer than 10 minutes.

## Overview

<div id='viz-distribution-by-grade'></div>

This score report presents information from the recent administration of the ROAR assessment.

- {{ swrStats.numStudents }} students in grades {{ swrStats.gradeMin }} to {{ swrStats.gradeMax }} completed the Single Word Recognition task.

- The average age of the students was {{ swrStats.ageMean }}.

- The average ROAR score was {{ swrStats.roarScoreMean }} on a scale of 100 - 900 
- Scores ranged from {{ swrStats.roarScoreMin }} to {{ swrStats.roarScoreMax }}, with a standard deviation of {{ swrStats.roarScoreStandardDev }}.

## Identifying Students who could Benefit from Support

The Woodcock-Johnson Basic Reading Skills Index WJ is a standardized test that was normed on a representative sample. [By using ROAR scores to estimate WJ scores](https://www.nature.com/articles/s41598-021-85907-x), we show how each student's single word recognition skills relate to national norms.

<div id='viz-normed-percentile-distribution'></div>

The vertical cut scores represent thresholds for classifying students into three categories: *At or Above Average*, *Some Support Needed*, or * Extra Support Needed*
- {{ swrStats.support.High }} students are classified as 'At or Above Average', with word recognition above the 50th percentile.

- {{ swrStats.support.Medium }} students are classified as 'Some Support Needed', word recognition between the 25th and 50th percentile.

- {{ swrStats.support.Low }} students are classified as 'Extra Support Needed', word recognition below the 25th percentile.


<div id='viz-stacked-support-by-grade'></div>

<div v-if="swrStats.hasFirstOrK"> 

### Identifying Automaticity in First Grade

As children's reading skills improve, word recognition becomes automatic: Rather than sounding out words one letter at a time, they develop automaticity in word recognition and can recognize a word at a glance. This ability begins developing around first grade but some children do not begin achieving automaticity until later. In this score report, first grade children are categorized as either having 'limited automaticity' or 'at or above average automaticity.' Students with limited automaticity are likely to benefit from increased instruction and continued monitoring of progress.

<div id='viz-first-grade-percentile-distribution'></div>

According to these classifications:

- {{ swrStats.automaticity.High }} students displayed 'At or Above Average Automaticity.'

- {{ swrStats.automaticity.Low }} students displayed 'Limited Automaticity.'


<div id='viz-automaticity-distributions-first-grade'></div>

</div>

## Student Score Information

Below is an interactive data table of the de-identified students that can be filtered and downloaded. We will provide a list of identified IDs as part of a secure file transfer, separately from this report.

<RoarDataTable :data="scores" :columns="columns" />

### Notes on Interpreting this Score Report

- Results from this rapid screener should be interpreted in the context of other information you have about each student's reading ability. For example, a student who is not fully engaged during the assessment may receive a score that does not reflect their true ability.

- Students who are flagged as needing extra support with single-word recognition need intensive support with decoding skills before they will become fluent with reading.

- For English Language Learners, *ROAR Single Word Recognition* scores should be considered along with knowledge about the student's current level of English vocabulary. Words that are not in their oral vocabulary may be correctly decoded but not recognized as real words.

- The scores on the 10-minute single-word recognition assessment predict students' scores on the Woodcock-Johnson Basic Reading Skills Index with high accuracy, thus, *ROAR Single Word Recognition* provides a highly efficient way to screen a group of students for acute literacy needs and strengths without expending the time and resources to individually administer lengthy assessments. For more information on how ROAR relates to the Woodcock-Johnson Basic Reading Skills Index see [**https://www.nature.com/articles/s41598-021-85907-x**](https://www.nature.com/articles/s41598-021-85907-x).

- Ongoing research continues to refine thresholds for identifying students who may benefit from additional support. Defining thresholds for identifying students who may benefit from additional support is part of our ongoing research. As part of this research collaborative, we invite your feedback about the information you see here.

### Teacher Resources for Reading Support

- The Florida Center for Reading Research offers free, online, age-specific, research-based lessons on phonological awareness and other foundational reading skills designed for pre-K through 5th-grade students [here](https://fcrr.org/student-center-activities/teacher-resource-guide).

### Invitation to Collaborate

Please reach out to [Jasmine Tran](jasetran@stanford.edu) and [Tonya Murray](tonyamur@stanford.edu) for questions or clarification on this score report and/or recommendations for how to improve future score reports.


<script setup>
const props = defineProps({
    scores: {type: Object, default: {}},
    swrStats: {type: Object, default: {}},
    columns: {type: Array, default: []}
});
</script>
