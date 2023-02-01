<template>
  <div id="phonological-awareness-score-report" class="section level1">
    <h1>Phonological Awareness Score Report</h1>
    <div id="introduction-to-the-phonological-awareness-score-report" class="section level2">
      <h2>Introduction to the Phonological Awareness Score Report</h2>
      <p>
        <strong><em>ROAR - Phonological Awareness</em></strong> measures
        <strong>elision and sound matching</strong> to assess a student's
        phonological awareness. Students need to achieve mastery of phonological
        awareness in order to achieve fluency in reading. Research shows that
        these foundational pre-reading skills are a barrier to learning for many
        students. Students not receiving support for their foundational reading
        skills may struggle to catch up in overall reading ability. This
        assessment is intended to help identify target skills for students who
        need extra support.
      </p>
      <p>
        <strong>This score report</strong> provides information about the
        distribution of scores across each grade, the skills each student has
        mastered, and how each student's skills compare to the national norms
        for their age group.
      </p>
      <p>
        <strong>The assessment</strong> provides a window into three specific
        phonological subskills where students may need support: first-sound
        matching, last-sound matching, and deletion. Students flagged as needing
        support in one of these subskills will likely benefit from direct
        instruction and practice with the flagged subskill and related
        phonological skills. The test is composed of three sections:
      </p>
      <ul>
        <li>
          <p>
            <strong>First Sound Matching:</strong> A picture is shown, and the
            narrator says the word associated with the picture, e.g.
            <em>“bat.”</em> Next, three more pictures are shown and narrated,
            e.g. <em>“car, ball, fox.”</em> To answer correctly, the student
            clicks on the picture that shares the same first sound, e.g.
            <em>“ball.”</em>
          </p>
        </li>
        <li>
          <p>
            <strong>Last Sound Matching:</strong> A picture is shown, and the
            narrator says the word associated with the picture,
            e.g. <em>“mat.”</em> Next, three more pictures are shown and
            narrated, e.g. <em>““mouse, hat, ball”</em>. To answer correctly,
            the student clicks on the picture that shares the same first sound,
            e.g. <em>“hat.”</em>
          </p>
        </li>
        <li>
          <p>
            <strong>Deletion:</strong> Three pictures are shown, and the
            narrator asks the student to choose the picture that corresponds to
            the word described by a deletion, e.g. <em>“What is rainbow without
            bow?”</em> To answer correctly, the student would choose the picture
            of rain. In this test, the narrator does not narrate the answer
            pictures.
          </p>
        </li>
      </ul>
      <p>The entire assessment takes most students 15-20 minutes.</p>
    </div>
    <div id="overview" class="section level2">
      <h2>Overview</h2>
      <p>
        This score report presents information from the recent administration of
        the ROAR assessment to students in x during x.
      </p>
      <ul>
        <li>59 students completed the Phonological Awareness task.</li>
        <li>The average age of the student was 9.4.</li>
        <li>The grades ranged from grade 1 to grade 6.</li>
        <li>
          The average ROAR score was 38 (out of 57) (min = 9, max = 56 , sd = 12.46).
        </li>
      </ul>
      <div id="viz-distribution-by-grade"></div>
    </div>

    <div id="supporting-students-in-developing-phonological-awareness" class="section level2">
      <h2>Supporting students in developing phonological awareness</h2>
      <p>
        This task is comprised of three skills related to phonological
        awareness: <strong>First Sound Matching (FSM)</strong>, <strong>Last
        Sound Matching (LSM)</strong>, and <strong>Deletion (DEL).</strong>
      </p>
      <p>
        We have classified students into three categories, based on whether
        they have <em>Full Mastery</em>, <em>Began to Exhibit Full Mastery</em>,
        <em>Some Mastery,</em> or <em>No Mastery</em> of these skills.
      </p>
      <p>More Specifically:</p>
      <ul>
        <li>
          <p>
            <em>Full Mastery</em>: Students who have exhibited mastery of all
            three of these skills.
          </p>
        </li>
        <li>
          <p>
            <em>Beginning to Exhibit Full Mastery</em>: Students who are
            beginning to exhibit mastery of all three skills.
          </p>
        </li>
        <li>
          <p>
            <em>Some Mastery</em>: Students who who have demonstrated mastery of
            one or two of these skills
          </p>
        </li>
        <li>
          <p>
            <em>No Mastery</em>: Students who have not yet demonstrated mastery
            of any of these skills.
          </p>
        </li>
      </ul>
      <div id="viz-normed-percentile-distribution"></div>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import embed from 'vega-embed';
import { useScoreStore } from "@/store/scores";

const scoreStore = useScoreStore();
const globalChartConfig = {
  $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
  data: {
    values: scoreStore.scores,
  },
}

const distributionByGrade = {
  ...globalChartConfig,
  description: 'ROAR Score Distribution by Grade Level',
  mark: 'bar',
  encoding: {
    row: { field: "grade" },
    // thetaEstimate should be changed to ROAR score
    x: { bin: true, field: 'thetaEstimate' },
    y: { aggregate: 'count' },
    color: { field: 'grade' },
  },
};

const normedPercentileDistribution = {
  ...globalChartConfig,
  description: 'Distribution of Normed Percentiles (all grades)',
  mark: 'bar',
  encoding: {
    // thetaEstimate should be changed to percentile
    x: { bin: true, field: 'thetaEstimate'},
    y: { aggregate: 'count' },
  },
}

const draw = async () => {
  await embed('#viz-distribution-by-grade', distributionByGrade);
  await embed('#viz-normed-percentile-distribution', normedPercentileDistribution);
};

onMounted(() => {
  draw()
})
</script>

<style>
</style>