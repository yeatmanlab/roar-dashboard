import { expect, test } from 'vitest';
import * as scoreUtils from '@/helpers/scores.js'


test('Square Root (control)', () => {
  expect(Math.sqrt(4)).toBe(2)
})

test('thetaToRoarScore', () => {
  expect(scoreUtils.thetaToRoarScore(4)).toBe(900)
  expect(scoreUtils.thetaToRoarScore(0)).toBe(500)
  expect(scoreUtils.thetaToRoarScore(-4)).toBe(100)
  expect(scoreUtils.thetaToRoarScore(2.217717213)).toBe(722)
  expect(scoreUtils.thetaToRoarScore(-0.773948376)).toBe(423)
})

test('differenceInMonths', () => {
  const values = [
    {
      date1: new Date('1/1/2023'),
      date2: new Date('5/1/2023'),
      expected: 4
    },
    {
      date1: new Date('1/1/2023'),
      date2: new Date('1/1/2023'),
      expected: 0
    },
    {
      date1: new Date('1/1/2022'),
      date2: new Date('5/1/2023'),
      expected: 16
    },
    {
      date1: new Date('1/1/2022'),
      date2: new Date('1/1/2023'),
      expected: 12
    },
    {
      date1: new Date('1/1/2023'),
      date2: new Date('1/1/2022'),
      expected: 12
    }
  ]
  values.forEach(val => {
    expect(scoreUtils.differenceInMonths(val.date1, val.date2)).toBe(val.expected)
  })
})

test('computeAges', () => {
  const values = [
    {
      dob: new Date('1/1/2009'),
      timeStarted: new Date('1/2/2023'),
      expected: {
        ageMonths: 168,
        ageYears: 14
      }
    },
    {
      dob: new Date('1/1/1999'),
      timeStarted: new Date('1/2/2023'),
      expected: {
        ageMonths: 288,
        ageYears: 24
      }
    },
    {
      dob: new Date('1/1/2015'),
      timeStarted: new Date('1/2/2023'),
      expected: {
        ageMonths: 96,
        ageYears: 8
      }
    },
  ]
  values.forEach(val => {
    expect(scoreUtils.computeAges(val.dob, val.timeStarted)).toStrictEqual(val.expected)
  })
})

test('parseGrade', () => {
  const values = [
    { grade: '', expected: 'NA' },
    { grade: null, expected: 'NA' },
    { grade: undefined, expected: 'NA' },
    { grade: '5', expected: '5' },
    { grade: '5th', expected: '5' },
    { grade: 'k', expected: 'k' },
    { grade: 'kindergarten', expected: 'k' },
    { grade: 'tkindergarten', expected: 'tk' },
    { grade: 'pre-kindergarten', expected: 'pk' },
    { grade: 'j', expected: 'jk' },
    { grade: '13', expected: 'adult' },
    { grade: 'not-a-grade', expected: 'not-a-grade' },
    { grade: '-2', expected: 'pk' },
    { grade: '0', expected: 'k' },
  ]
  values.forEach(val => {
    expect(scoreUtils.parseGrade(val.grade)).toBe(val.expected)
  })
})

test('thetaToSupportSWR', () => {
  expect(scoreUtils.thetaToSupportSWR(25, 'k')).toBe('Limited')
  expect(scoreUtils.thetaToSupportSWR(50, '1')).toBe('Average or Above Average')
  expect(scoreUtils.thetaToSupportSWR(75, '1')).toBe('Average or Above Average')

  expect(scoreUtils.thetaToSupportSWR(24, '6')).toBe('Extra Support Needed')
  expect(scoreUtils.thetaToSupportSWR(49, '6')).toBe('Some Support Needed')
  expect(scoreUtils.thetaToSupportSWR(75, '6')).toBe('Average or Above Average')
})

test('percentileToSupportClassification', () => {
  expect(scoreUtils.percentileToSupportClassification('pa', 24, 'K')).toBe('Extra Support Needed')
  expect(scoreUtils.percentileToSupportClassification('pa', 49, 'K')).toBe('Some Support Needed')
  expect(scoreUtils.percentileToSupportClassification('pa', 51, 'K')).toBe('Average or Above Average')

  expect(scoreUtils.percentileToSupportClassification('pa', 14, '5')).toBe('Extra Support Needed')
  expect(scoreUtils.percentileToSupportClassification('pa', 29, '5')).toBe('Some Support Needed')
  expect(scoreUtils.percentileToSupportClassification('pa', 31, '5')).toBe('Average or Above Average')

  expect(scoreUtils.percentileToSupportClassification('swr', 49, 'K')).toBe('Limited')
  expect(scoreUtils.percentileToSupportClassification('swr', 51, 'K')).toBe('Average or Above Average')

  expect(scoreUtils.percentileToSupportClassification('swr', 24, '5')).toBe('Extra Support Needed')
  expect(scoreUtils.percentileToSupportClassification('swr', 49, '5')).toBe('Some Support Needed')
  expect(scoreUtils.percentileToSupportClassification('swr', 51, '5')).toBe('Average or Above Average')
})

test('gradeComparator', () => {
  expect(scoreUtils.gradeComparator('1', '1')).toBe(0)
  expect(scoreUtils.gradeComparator('1', '2')).toBe(-1)
  expect(scoreUtils.gradeComparator('12', 'adult')).toBe(-1)
  expect(scoreUtils.gradeComparator('adult', '12')).toBe(1)
  expect(scoreUtils.gradeComparator('k', '1')).toBe(-1)
  expect(scoreUtils.gradeComparator('pk', 'k')).toBe(-1)
})

test('getSchools', () => {
  const data = [
    {
      school_name: 'school1'
    },
    {
      school_name: 'school1'
    },
    {
      school_name: 'school4'
    },
    {
      school_name: 'school1'
    },
    {
      school_name: 'school3'
    },
    {
      school_name: 'school2'
    },
    {
      school_name: 'school2'
    },
    {
      school_name: undefined
    }
  ]
  const expected = ['school1', 'school4', 'school3', 'school2']
  expect(scoreUtils.getSchools(data)).toStrictEqual(expected)
})

test('getAges', () => {
  const data1 = [
    { 
      dob: '1/1/2015', 
      timeStarted: '1/1/2023', 
    },
    { 
      dob: '3/5/2013', 
      timeStarted: '1/1/2023', 
    },
    { 
      dob: '10/2/2011', 
      timeStarted: '1/1/2023', 
    },
    { 
      dob: '5/3/2012', 
      timeStarted: '1/1/2023', 
    },
    { 
      dob: '1/1/2017', 
      timeStarted: '1/1/2023', 
    }
  ]
  const expected1 = {
    ageMin: 6,
    ageMax: 11.3,
    ageMean: '8.8'
  }
  expect(scoreUtils.getAges(data1)).toStrictEqual(expected1)

  const data2 = [
    { 
      dob: '1/1/2015', 
      timeStarted: '1/1/2023', 
    },
    { 
      dob: '3/5/2013', 
      timeStarted: '1/1/2023', 
    },
    { 
      dob: null, 
      timeStarted: null, 
    },
    { 
      dob: '5/3/2012', 
      timeStarted: '1/1/2023', 
    },
    { 
      dob: '1/1/2017', 
      timeStarted: '1/1/2023', 
    }
  ]
  const expected2 = {
    ageMin: 6,
    ageMax: 10.7,
    ageMean: '8.3'
  }
  expect(scoreUtils.getAges(data2)).toStrictEqual(expected2)
})

test('getGrades', () => {
  const data1 = [
    { grade: 4 },
    { grade: 6 },
    { grade: 4 },
    { grade: 2 },
    { grade: 'K' },
    { grade: 3 },
    { grade: 4 },
  ]
  const expected1 = {
    gradeMin: 'k',
    gradeMax: '6',
    hasFirstOrK: true
  }
  expect(scoreUtils.getGrades(data1)).toStrictEqual(expected1)

  const data2 = [
    { grade: 4 },
    { grade: 6 },
    { grade: 4 },
    { grade: 2 },
    { grade: 12 },
    { grade: 3 },
    { grade: 4 },
  ]
  const expected2 = {
    gradeMin: '2',
    gradeMax: '12',
    hasFirstOrK: false
  }
  expect(scoreUtils.getGrades(data2)).toStrictEqual(expected2)
})

test('getRoarScoreStats', () => {
  const data = [
    { thetaEstimate: 4 },
    { thetaEstimate: -4 },
    { thetaEstimate: 0 },
    { thetaEstimate: -1 },
    { thetaEstimate: 1 },
    { thetaEstimate: 2.217717213 },
    { thetaEstimate: -0.773948376 },
  ]
  const expected = {
    roarScoreMin: 100,
    roarScoreMax: 900,
    roarScoreMean: 521,
    roarScoreStandardDev: '256'
  }
  expect(scoreUtils.getRoarScoreStats(data)).toStrictEqual(expected)
})

test('swrSupportStats', () => {
  const data1 = [
    { runInfo: { supportLevel: 'Average or Above Average' } },
    { runInfo: { supportLevel: 'Extra Support Needed' } },
    { runInfo: { supportLevel: 'Average or Above Average' } },
    { runInfo: { supportLevel: 'Some Support Needed' } },
    { runInfo: { supportLevel: 'Some Support Needed' } },
    { runInfo: { supportLevel: 'Extra Support Needed' } },
    { runInfo: { supportLevel: 'Limited' } },
    { runInfo: { supportLevel: 'Average or Above Average' } },
    { runInfo: { supportLevel: 'Limited' } },
  ]
  const expected1 = {
    averageSupport: 3,
    someSupport: 2,
    extraSupport: 2,
    limitedAutomaticity: 2,
    averageAutomaticity: 3
  }
  expect(scoreUtils.swrSupportStats(data1)).toStrictEqual(expected1)

  const data2 = []
  const expected2 = {
    averageSupport: null,
    someSupport: null,
    extraSupport: null,
    limitedAutomaticity: null,
    averageAutomaticity: null
  }
  expect(scoreUtils.swrSupportStats(data2)).toStrictEqual(expected2)
})

test('paSupportStats', () => {
  const data1 = [
    { runInfo: { supportLevel: 'Average or Above Average' } },
    { runInfo: { supportLevel: 'Extra Support Needed' } },
    { runInfo: { supportLevel: 'Average or Above Average' } },
    { runInfo: { supportLevel: 'Some Support Needed' } },
    { runInfo: { supportLevel: 'Some Support Needed' } },
    { runInfo: { supportLevel: 'Extra Support Needed' } },
    { runInfo: { supportLevel: 'Extra Support Needed' } },
    { runInfo: { supportLevel: 'Average or Above Average' } },
    { runInfo: { supportLevel: 'Average of Above Average' } },
  ]
  const expected1 = {
    averageSupport: 3,
    someSupport: 2,
    extraSupport: 3,
  }
  expect(scoreUtils.paSupportStats(data1)).toStrictEqual(expected1)

  const data2 = []
  const expected2 = {
    averageSupport: null,
    someSupport: null,
    extraSupport: null,
  }
  expect(scoreUtils.paSupportStats(data2)).toStrictEqual(expected2)
})

test('paSkillCounts', () => {
  const data1 = [
    { blockId: 'LSM' },
    { blockId: 'FSM' },
    { blockId: 'LSM' },
    { blockId: 'FSM' },
    { blockId: 'FSM' },
    { blockId: 'DEL' },
    { blockId: 'DEL' },
    { blockId: 'DEL' },
    { blockId: 'LSM' },
    { blockId: 'LSM' },
    { blockId: 'FSM' },
    { blockId: 'DEL' },
  ]
  const expected1 = {
    LSM: 4,
    FSM: 4,
    DEL: 4
  }
  expect(scoreUtils.paSkillCounts(data1)).toStrictEqual(expected1)

  const data2 = []
  const expected2 = {
    LSM: null,
    FSM: null,
    DEL: null
  }
  expect(scoreUtils.paSkillCounts(data2)).toStrictEqual(expected2)
})