import { defineStore } from "pinia";
import { csvFileToJson } from "@/helpers";
import * as scoreUtils from "@/helpers/scores.js"
import _get from 'lodash/get'
import _map from 'lodash/map'
import _forEach from 'lodash/forEach'

export const useScoreStore = () => {
  return defineStore({
    id: "scoreStore",
    state: () => {
      return {
        appScores: [], // TODO: Delete when all paths are moved to new values
        rawScores: [],
        identifiers: [], // TODO: Delete when all paths are moved to new values
        rawIdentifiers: [],
        sections: [],
        selectedStudentId: null,
      };
    },

    getters: {
      // Boolean indicating whether runs have been populated
      areScoresReady: (state) => {
        if(!state.newRuns) return false
        let isReady = false
        _forEach(state.newRuns, task => {
          if(task.length) isReady = true
        })
        return isReady
      },
      // An array of task ids currently in the dataset
      uniqueTasks: (state) => {
        return [...new Set(state.rawScores.map(item => item.taskId))];
      },

      // Raw rows from csv, rows representing blocks, organized by task id
      mergedRaw: (state) => {
        let returnScore = {}
        _forEach(state.uniqueTasks, option => {
          returnScore[option] = []
        })
        // Merge runs together with identifier
        if(state.rawIdentifiers.length === 0 || state.rawScores.length === 0){
          console.log('Either No Identifiers or Scores yet!')
        } else {
          let merged = _map(state.rawScores, run => {
            const matchingIdentifier = state.rawIdentifiers.filter((participant) => 
              participant.pid === run.pid
            )
            const taskId = scoreUtils.standardizeTaskId(run.taskId)
            if(matchingIdentifier.length !== 0){
              const names = scoreUtils.standardizeNames(matchingIdentifier[0])
              returnScore[taskId].push({
                taskId,
                name: names,
                ...run,
                ...matchingIdentifier[0]
              })
            } else {
              console.warn('No matching idenifier found for block %s', _get(run, 'pid') )
            }
          })
        }
        return returnScore
      },

      // Blocks with trimmed info, organized by task id
      newBlocks: (state) => {
        let returnBlocks = {}
        _forEach(state.uniqueTasks, task => {
          returnBlocks[task] = []
          _forEach(state.mergedRaw[task], block => {
            const taskId = _get(block, 'taskId')
            const blockId = _get(block, 'block') ?? _get(block, 'blockId')
            returnBlocks[taskId].push({
              taskId: taskId,
              blockId: blockId,
              attempted: _get(block, 'attempted'),
              correct: _get(block, 'correct'),
              incorrect: _get(block, 'incorrect')
            })
          })
        })
        return returnBlocks
      },

      // Group blocks into runs, organized by task id
      newRuns: (state) => {
        let returnRuns = {}
        _forEach(state.uniqueTasks, task => {
          returnRuns[task] = []
          const uniqueRunIds = [...new Set(state.mergedRaw[task].map((block) => block.runId))];
          returnRuns[task] = uniqueRunIds.map((runId) => {
            const runBlocks = state.mergedRaw[task].filter((block) => block.runId === runId);
            const mergedRun = {...scoreUtils.getRunScores(runBlocks)}
            return {
              ...mergedRun,
              runInfo: scoreUtils.getRunInfoCommon(mergedRun)
            }
          })
        })
        return returnRuns
      },

      reportStats: (state) => {
        let returnStats = {}
        _forEach(state.uniqueTasks, task => {
          returnStats[task] = {
            numStudents: state.newRuns[task].length,
            school_name: scoreUtils.getSchools(state.mergedRaw[task]),
            ages: scoreUtils.getAges(state.newRuns[task]),
            grades: scoreUtils.getGrades(state.newRuns[task]),
          }
          switch(task){
            case 'swr':
              returnStats[task]['roarScore'] = scoreUtils.getRoarScoreStats(state.newRuns[task])
              returnStats[task]['support'] = scoreUtils.swrSupportStats(state.newRuns[task])
              break;
            case 'pa':
              returnStats[task]['totalCorrect'] = scoreUtils.getTotalCorrect(state.newBlocks[task])
              returnStats[task]['support'] = scoreUtils.paSupportStats(state.newRuns[task])
              returnStats[task]['skillCounts'] = scoreUtils.paSkillCounts(state.newBlocks[task])
              break;
            case 'sre':
              returnStats[task]['support'] = scoreUtils.sreSupportStats(state.newRuns[task])
              break;
            case 'vocab':
              returnStats[task]['support'] = scoreUtils.vocabSupportStats(state.newRuns[task])
              break;
          }
        })
        return returnStats
      }
    },
    
    actions: {
      scoresFromJSON(raw) {
        _forEach(raw, block => {
          block['taskId'] = scoreUtils.standardizeTaskId(block['taskId'])
        }) 
        this.rawScores.push(...raw)
      },
      identifiersFromJSON(raw) {
        this.rawIdentifiers.push(...raw)
      },
      mergeSectionsWithIdentifiers: async (csvFile) => {
        const sectionsData = await csvFileToJson(csvFile);
        console.log(sectionsData);
        this.sections = sectionsData;
        // Do stuff to sectionsData
        // merge with this.identifiers
      },
      // assignRiskCategories: (scoreField, cutoffs) => {
      //   // Expect that cutoff is an array of objects with structure
      //   // { category: string, lowerBound: number, upperBound: number}
      //   this.scores = this.scores.map((run) => {
      //     ...run,
      //     cutoffs.filter((category) => category.lowerBound <= run[scoreField] && category.upperBound > run[scoreField])
      //   })
      // }
    },
  })();
};
