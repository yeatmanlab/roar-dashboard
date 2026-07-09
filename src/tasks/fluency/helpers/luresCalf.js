import { getDigit, getRandomValues } from "../../shared/helpers";

export const lures_calf_addition = (operand1, operand2, difficulty) => {
  let lures_correction = {
    A1: [
      ["ones1+ones2>=8", 4, -5],
      ["ones1+ones2==9", 3, -5],
    ],
    A2: [
      ["ones1+ones2>=8", 4, -5],
      ["ones1+ones2==9", 3, -5],
    ],
    A3: [
      ["ones1+ones2==18", 4, -5],
      ["ones1+ones2<=11", 0, 10],
      ["ones1+ones2==10", 1, 10],
    ],
    A4: [
      ["ones1+ones2==18", 4, -5],
      ["ones1+ones2<=11", 0, 10],
      ["ones1+ones2==10", 1, 10],
    ],
  };

  let ones1 = getDigit(operand1, 1);
  let tens1 = getDigit(operand1, 10);
  let ones2 = getDigit(operand2, 1);
  let tens2 = getDigit(operand2, 10);

  let lure_list = new Array();

  for (var i = -2; i < 3; i++) {
    lure_list.push([]);
    for (var j = -2; j < 3; j++) {
      lure_list[i + 2][j + 2] = 10 * (tens1 + tens2 + i) + ones1 + ones2 + j;
    }
  }

  if (difficulty == "A2" || difficulty == "A4") {
    lure_list.push([]);
    for (var i = 0; i < 5; i++) {
      lure_list[5][i] = lure_list[2][i] - 100;
    }
  }

  for (var i = 0; i < lures_correction[difficulty].length; i++) {
    if (eval(lures_correction[difficulty][i][0])) {
      for (var j = 0; j < lure_list.length; j++) {
        lure_list[j][lures_correction[difficulty][i][1]] +=
          lures_correction[difficulty][i][2];
      }
    }
  }

  // colors refer to distractors as per table, refer to the calf lures generating key (a grid around the target of +/- 2 for each place value)
  // blue -> differs only in tens place
  // yellow -> differs only in ones place
  // pink -> differs both in tens and ones place
  // select 1 from yellow, 1 from blue, and 3 from pink
  // non-overlapping lures are ensured as the pink lures will come from different pairs of rows and columns

  let [blue, pinkYellow] = getRandomValues([0, 1, 3, 4], 2);
  let [pinkBlue, yellow] = getRandomValues([0, 1, 3, 4], 2);

  //Each index refers to cumulative probability of type of lure with/without carry in the blue band
  //0: any type of lure
  //1: carry error in ones place
  //2: carry error in tens place
  let lures_carry_error = {
    A1: [1, 0, 0],
    A2: [0.5, 0, 1],
    A3: [0, 1, 0],
    A4: [0, 0.75, 1],
  };

  let carry_prob = Math.random();

  if (carry_prob < lures_carry_error[difficulty][0]) {
    //do nothing
  } else if (carry_prob < lures_carry_error[difficulty][1]) {
    blue = 1;
    pinkYellow = getRandomValues([0, 3, 4], 1)[0];
  } else if (carry_prob < lures_carry_error[difficulty][2]) {
    blue = 5;
  }

  let final_lures = [
    lure_list[blue][2],
    lure_list[blue][pinkBlue],
    lure_list[2][yellow],
    lure_list[pinkYellow][yellow],
    lure_list[pinkYellow][pinkBlue],
  ];
  return final_lures;
};

export const lures_calf_subtraction = (operand1, operand2, difficulty) => {
  let lures_correction = {
    S1: [
      ["ones1-ones2==8", 4, -5],
      ["ones1-ones2<=1", 0, 10],
      ["ones1-ones2==0", 1, 10],
    ],
    S2: [
      ["ones1-ones2+10>=8", 4, -5],
      ["ones1-ones2+10==9", 3, -5],
      ["ones1-ones2+10==1", 0, 10],
    ],
  };

  let ones1 = getDigit(operand1, 1);
  let tens1 = getDigit(operand1, 10);
  let ones2 = getDigit(operand2, 1);
  let tens2 = getDigit(operand2, 10);
  let lure_list = new Array();

  //generate lures
  for (var i = -2; i < 3; i++) {
    lure_list.push([]);
    for (var j = -2; j < 3; j++) {
      lure_list[i + 2][j + 2] = 10 * (tens1 - tens2 + i) + ones1 - ones2 + j;
    }
  }

  //inversion error
  if (difficulty == "S2") {
    for (var i = 0; i < 5; i++) {
      lure_list[i][5] = 10 * (tens1 - tens2 + i - 2) + ones2 - ones1 - 10;
    }
  }

  //correction for fixing tens place
  for (var i = 0; i < lures_correction[difficulty].length; i++) {
    if (eval(lures_correction[difficulty][i][0])) {
      for (var j = 0; j < lure_list.length; j++) {
        lure_list[j][lures_correction[difficulty][i][1]] +=
          lures_correction[difficulty][i][2];
      }
    }
  }

  // colors refer to distractors as per table, refer to the calf lures generating key (make a grid around the target of +/- 2 for each place value)
  // blue -> differs only in tens place
  // yellow -> differs only in ones place
  // pink -> differs both in tens and ones place
  // select 1 from yellow, 1 from blue, and 3 from pink
  // non-overlapping lures are ensured as the pink lures will come from different pairs of rows and columns

  let blue, pinkYellow, pinkBlue, yellow;

  //get lures indices
  if (difficulty == "S1") {
    let blue_list = [0, 1, 3, 4];
    //remove the ten1-tens2-1 index (2nd row in this array)
    if (tens1 - tens2 == 0) {
      blue_list = blue_list.filter((value) => value !== 1);
    }
    //remove the a-c-2 index (1st row in this array)
    if (tens1 - tens2 <= 1) {
      blue_list = blue_list.filter((value) => value !== 0);
    }
    [blue, pinkYellow] = getRandomValues(blue_list, 2);
    [pinkBlue, yellow] = getRandomValues([0, 1, 3, 4], 2); // stays the same
  }

  if (difficulty == "S2") {
    let yellow_list = [0, 1, 3, 4];
    blue = 3; //borrow error
    if (lure_list[3][2] != lure_list[3][5]) {
      pinkBlue = 5;
    } else {
      pinkBlue = getRandomValues([0, 1, 3, 4], 1)[0];
      yellow_list = yellow_list.filter((value) => value !== pinkBlue);
    }

    let yellow_rows = [0, 1, 3, 4];
    for (i = 0; i < yellow_rows.length; i++) {
      if (lure_list[2][5] == lure_list[2][yellow_rows[i]]) {
        yellow_list = yellow_list.filter((value) => value !== yellow_rows[i]);
      }
    }
    yellow = getRandomValues(yellow_list, 1)[0];

    let pinkYellow_columns = [0, 1, 4];

    //remove the a-c-1 index (2nd row in this array)
    if (tens1 - tens2 == 1) {
      pinkYellow_columns = pinkYellow_columns.filter((value) => value !== 1);
    }
    //remove the a-c-2 index (1st row in this array)
    if (tens1 - tens2 <= 2) {
      pinkYellow_columns = pinkYellow_columns.filter((value) => value !== 0);
    }

    pinkYellow = getRandomValues(pinkYellow_columns, 1)[0];
  }

  let final_lures = [
    lure_list[blue][2],
    lure_list[blue][pinkBlue],
    lure_list[2][yellow],
    lure_list[pinkYellow][yellow],
    lure_list[pinkYellow][pinkBlue],
  ];

  return final_lures;
};

export const lures_calf_multiplication = (operand1, operand2) => {
  let ones1 = getDigit(operand1, 1);
  let tens1 = getDigit(operand1, 10);
  let lure_list = new Array();
  let inc_list = [
    [-1, 0],
    [1, 0],
    [0, 0],
    [0, -1],
    [0, 1],
  ];

  for (var i = 0; i < 5; i++) {
    lure_list.push([]);
    for (var j = 0; j < 5; j++) {
      lure_list[i][j] =
        10 * (tens1 + inc_list[i][0]) * (operand2 + inc_list[i][1]) +
        (ones1 + inc_list[j][0]) * (operand2 + inc_list[j][1]);
    }
  }

  if (ones1 == operand2) {
    for (var i = 0; i < 5; i++) {
      lure_list[i][3] =
        10 * (tens1 + inc_list[i][0]) * (operand2 + inc_list[i][1]) +
        (ones1 - 2) * operand2;
      lure_list[i][4] =
        10 * (tens1 + inc_list[i][0]) * (operand2 + inc_list[i][1]) +
        (ones1 + 2) * operand2;
    }
  }

  // colors refer to distractors as per table, refer to the calf lures generating key (make a grid around the target of +/- 2 for each place value)
  // blue -> differs only in tens place
  // yellow -> differs only in ones place
  // pink -> differs both in tens and ones place
  // select 1 from yellow, 1 from blue, and 3 from pink
  // non-overlapping lures are ensured as the pink lures will come from different pairs of rows and columns

  let [blue, pinkYellow] = getRandomValues([0, 1, 3, 4], 2);
  let [pinkBlue, yellow] = getRandomValues([0, 1, 3, 4], 2);

  let final_lures = [
    lure_list[blue][2],
    lure_list[blue][pinkBlue],
    lure_list[2][yellow],
    lure_list[pinkYellow][yellow],
    lure_list[pinkYellow][pinkBlue],
  ];
  return final_lures;
};

export const lures_calf_division = (operand1, operand2) => {
  let negative_correction = [
    [23, 0, 50],
    [13, 1, 50],
  ];

  let lures_correction = [
    ["lure_list[2][2] % 10 == 1", 0, 5],
    ["lure_list[2][2] % 10 >= 8", 4, -5],
    ["lure_list[2][2] % 10 >= 9", 3, -5],
  ];

  let lure_list = new Array();
  let answer = Math.floor(operand1 / operand2);

  for (var i = -2; i < 3; i++) {
    lure_list.push([]);
    for (var j = -2; j < 3; j++) {
      lure_list[i + 2][j + 2] = answer + (i * 10 + j);
    }
  }

  // correct negative lures
  for (var i = 0; i < negative_correction.length; i++) {
    if (answer < negative_correction[i][0]) {
      for (var j = 0; j < lure_list[0].length; j++) {
        lure_list[negative_correction[i][1]][j] += negative_correction[i][2];
      }
    }
  }

  // correct tens place
  for (var i = 0; i < lures_correction.length; i++) {
    if (eval(lures_correction[i][0])) {
      for (var j = 0; j < lure_list.length; j++) {
        lure_list[j][lures_correction[i][1]] += lures_correction[i][2];
      }
    }
  }

  // colors refer to distractors as per table, refer to the calf lures generating key (make a grid around the target of +/- 2 for each place value)
  // blue -> differs only in tens place
  // yellow -> differs only in ones place
  // pink -> differs both in tens and ones place
  // select 1 from yellow, 1 from blue, and 3 from pink
  // non-overlapping lures are ensured as the pink lures will come from different pairs of rows and columns

  let [blue, pinkYellow] = getRandomValues([0, 1, 3, 4], 2);
  let [pinkBlue, yellow] = getRandomValues([0, 1, 3, 4], 2);

  let final_lures = [
    lure_list[blue][2],
    lure_list[blue][pinkBlue],
    lure_list[2][yellow],
    lure_list[pinkYellow][yellow],
    lure_list[pinkYellow][pinkBlue],
  ];
  return final_lures;
};
