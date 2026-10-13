import { describe, it, expect } from 'vitest';
import { isEmailValid, isUsernameValid, isPasswordValid, isDobValid } from './userFieldValidators';

describe('isEmailValid', () => {
  describe('valid addresses', () => {
    it.each([
      ['user@example.com', 'ordinary address'],
      ['USER@EXAMPLE.COM', 'uppercase'],
      ['first.last@example.com', 'period in local part'],
      ['user+tag@example.com', 'plus addressing'],
      ['user_name@example.com', 'underscore'],
      ['user-name@example.com', 'hyphen'],
      ["o'brien@example.com", 'apostrophe'],
      ["o'brien.smith@lausd.net", 'apostrophe and period'],
      ['a@b.co', 'shortest realistic address'],
      ['user@sub.domain.example.com', 'multiple subdomains'],
      ['user@my-domain.com', 'hyphen in domain'],
      ['user@my--domain.com', 'consecutive hyphens mid-label'],
      ['user@a.b-c.de', 'hyphen in a middle label'],
      ['student@k12.ca.us', 'multi-part TLD'],
      ['1234567890@example.com', 'all-numeric local part'],
      ['user@123.com', 'numeric domain label'],
      ['user@xn--80ak6aa92e.com', 'punycode domain'],
    ])('accepts %s (%s)', (email) => {
      expect(isEmailValid(email)).toBe(true);
    });
  });

  describe('invalid addresses', () => {
    it.each([
      ['plainaddress', 'no @'],
      ['@example.com', 'no local part'],
      ['user@', 'no domain'],
      ['user@example', 'no period in domain'],
      ['user@.com', 'leading period in domain'],
      ['user@com.', 'trailing period in domain'],
      ['user@-example.com', 'leading hyphen in label'],
      ['user@example-.com', 'trailing hyphen in label'],
      ['user@example..com', 'consecutive periods in domain'],
      ['user@example.c-m', 'hyphen in TLD'],
      ['user@exam_ple.com', 'underscore in domain'],
      ['.user@example.com', 'leading period in local part'],
      ['user.@example.com', 'trailing period in local part'],
      ['us..er@example.com', 'consecutive periods in local part'],
      ['user@@example.com', 'double @'],
      ['user name@example.com', 'space in local part'],
      ['user@exam ple.com', 'space in domain'],
      [' user@example.com', 'leading whitespace'],
      ['user@example.com ', 'trailing whitespace'],
      ['user@example.com\n', 'trailing newline'],
      ['user@exam\nple.com', 'embedded newline'],
      ['user@example.com<script>', 'injection-shaped input'],
      ['"quoted local"@example.com', 'quoted-string local part'],
      ['user@[192.168.1.1]', 'IP-literal domain'],
      ['user(comment)@example.com', 'RFC comment syntax'],
      ['user,a@example.com', 'comma'],
      ['user;a@example.com', 'semicolon'],
      ['user:a@example.com', 'colon'],
      ['user<a>@example.com', 'angle brackets'],
      ['josé@example.com', 'non-ASCII local part'],
      ['user@münchen.de', 'non-ASCII domain'],
    ])('rejects %s (%s)', (email) => {
      expect(isEmailValid(email)).toBe(false);
    });

    it.each([
      ['', 'empty string'],
      [null, 'null'],
      [undefined, 'undefined'],
    ])('rejects %s (%s)', (email) => {
      expect(isEmailValid(email)).toBe(false);
    });
  });

  // These pass today. Locked in so a future change to the pattern is a deliberate decision,
  // not an accident. See the notes in userFieldValidators.js if these should be tightened.
  describe('documented current behaviour (not yet tightened)', () => {
    it.each([
      ['user@192.168.1.1', 'bare IP as domain'],
      ['user@example.123', 'all-numeric TLD'],
      ['user@example.c', 'single-character TLD'],
    ])('currently accepts %s (%s)', (email) => {
      expect(isEmailValid(email)).toBe(true);
    });

    it('does not enforce RFC length limits', () => {
      expect(isEmailValid(`${'a'.repeat(70)}@example.com`)).toBe(true);
      expect(isEmailValid(`a@${'b'.repeat(70)}.com`)).toBe(true);
    });
  });
});

describe('isUsernameValid', () => {
  describe('valid usernames', () => {
    it.each([
      ['student1', 'alphanumeric'],
      ['obrien', 'letters only'],
      ["o'brien", 'apostrophe'],
      ["O'Brien-Smith", 'apostrophe, hyphen and mixed case'],
      ["o'brien.j", 'apostrophe and period'],
      ['jane_doe', 'underscore'],
      ['j.doe', 'period'],
      ['j-doe', 'hyphen'],
      ['12345', 'all numeric'],
      ['j', 'single character'],
    ])('accepts %s (%s)', (username) => {
      expect(isUsernameValid(username)).toBe(true);
    });
  });

  describe('invalid usernames', () => {
    it.each([
      ["o''brien", 'consecutive apostrophes'],
      ["'user", 'leading apostrophe'],
      ["user'", 'trailing apostrophe'],
      ['_user', 'leading underscore'],
      ['user_', 'trailing underscore'],
      ['-user', 'leading hyphen'],
      ['user-', 'trailing hyphen'],
      ['.user', 'leading period'],
      ['user.', 'trailing period'],
      ['+user', 'leading plus'],
      ['user+tag', 'plus is not permitted in usernames'],
      ['a__b', 'consecutive underscores'],
      ['a--b', 'consecutive hyphens'],
      ['a..b', 'consecutive periods'],
      ['a b', 'space'],
      ['user!', 'symbol not on the allow list'],
      ['josé', 'non-ASCII'],
      ['user@x', '@ is not permitted'],
    ])('rejects %s (%s)', (username) => {
      expect(isUsernameValid(username)).toBe(false);
    });

    it.each([
      ['', 'empty string'],
      [null, 'null'],
      [undefined, 'undefined'],
    ])('rejects %s (%s)', (username) => {
      expect(isUsernameValid(username)).toBe(false);
    });
  });

  // Usernames are turned into emails via `${username}@roar-auth.com` in
  // RegisterStudents.vue, useAuth.js, HomeParentStudentView.vue and RegisterChildren.vue.
  // If this invariant breaks, a username passes validation here and then fails at Firebase
  // account creation with an error the user cannot act on.
  describe('username must always produce a valid @roar-auth.com address', () => {
    it.each(["o'brien", "O'Brien-Smith", "o'brien.j", 'jane_doe', 'j.doe', 'j-doe', 'student1', '12345', 'j'])(
      '%s survives being appended to @roar-auth.com',
      (username) => {
        expect(isUsernameValid(username)).toBe(true);
        expect(isEmailValid(`${username}@roar-auth.com`)).toBe(true);
      },
    );

    it('holds exhaustively for every username up to 5 characters', () => {
      const alphabet = ['a', 'B', '1', '+', '_', '-', "'", '.', '!'];
      const violations = [];

      const walk = (prefix, depth) => {
        if (depth === 0) {
          if (isUsernameValid(prefix) && !isEmailValid(`${prefix}@roar-auth.com`)) {
            violations.push(prefix);
          }
          return;
        }
        for (const char of alphabet) walk(prefix + char, depth - 1);
      };
      for (let length = 1; length <= 5; length++) walk('', length);

      expect(violations).toEqual([]);
    });
  });
});

// The original patterns used an optional separator (`-*` in the email domain, `['_.-]?` in
// the username), which let an alphanumeric run split across group iterations exponentially
// many ways. Invalid input then backtracked for seconds to minutes, freezing the browser.
// These assert the separators stayed required. They fail loudly if that regresses.
describe('validators reject invalid input in linear time', () => {
  const withinBudget = (fn) => {
    const start = performance.now();
    fn();
    return performance.now() - start;
  };

  it.each([
    ['parent@losangelesunifiedschooldistrict', 'long domain run, missing TLD'],
    ['parent@losangelesunifiedschools', 'long domain run, missing TLD'],
    [`user@${'a'.repeat(40)}!`, 'unterminated domain'],
    [`user@${'a'.repeat(40)}.${'a'.repeat(40)}!`, 'dotted domain, compounding groups'],
    [`user@${'a'.repeat(2000)}!`, 'long stress input'],
    [`user@${'a-'.repeat(1000)}!`, 'alternating hyphen stress input'],
  ])('isEmailValid rejects %s quickly (%s)', (email) => {
    let result;
    const elapsed = withinBudget(() => {
      result = isEmailValid(email);
    });
    expect(result).toBe(false);
    expect(elapsed).toBeLessThan(100);
  });

  it.each([
    [`${'a'.repeat(40)}!`, 'long run, trailing invalid character'],
    [`${'a'.repeat(2000)}!`, 'long stress input'],
    [`${"a'".repeat(1000)}!`, 'alternating separator stress input'],
  ])('isUsernameValid rejects %s quickly (%s)', (username) => {
    let result;
    const elapsed = withinBudget(() => {
      result = isUsernameValid(username);
    });
    expect(result).toBe(false);
    expect(elapsed).toBeLessThan(100);
  });
});

describe('isPasswordValid', () => {
  it.each([
    ['abcdef', 'six characters with letters'],
    ['abc123', 'letters and numbers'],
    ['a12345', 'single letter with numbers'],
  ])('accepts %s (%s)', (password) => {
    expect(isPasswordValid(password)).toBe(true);
  });

  it.each([
    ['abc12', 'fewer than six characters'],
    ['123456', 'no letter'],
    ['12345', 'too short and no letter'],
    ['', 'empty string'],
  ])('rejects %s (%s)', (password) => {
    expect(isPasswordValid(password)).toBe(false);
  });

  it.each([
    [null, 'null'],
    [undefined, 'undefined'],
  ])('rejects %s (%s)', (password) => {
    expect(isPasswordValid(password)).toBe(false);
  });
});

describe('isDobValid', () => {
  it.each([
    ['2/1/2020', 'single-digit month and day with slashes'],
    ['02/01/2020', 'zero-padded with slashes'],
    ['2-1-2020', 'single-digit with hyphens'],
    ['02-01-2020', 'zero-padded with hyphens'],
    [' 2/1/2020 ', 'surrounding whitespace is trimmed'],
  ])('accepts %s (%s)', (dob) => {
    expect(isDobValid(dob)).toBeInstanceOf(Date);
  });

  it('parses the date correctly', () => {
    const date = isDobValid('2/1/2020');
    expect(date.getFullYear()).toBe(2020);
    expect(date.getMonth()).toBe(1); // February, zero-indexed
    expect(date.getDate()).toBe(1);
  });

  it.each([
    ['2/1/12', 'two-digit year is ambiguous'],
    ['2-1/2020', 'mixed separators'],
    ['2/1-2020', 'mixed separators reversed'],
    ['2//2020', 'missing day'],
    ['2/1/2020extra', 'trailing characters'],
    ['not a date', 'non-numeric'],
    ['', 'empty string'],
  ])('rejects %s (%s)', (dob) => {
    expect(isDobValid(dob)).toBeNull();
  });

  it.each([
    ['2/30/2020', 'day overflows into the next month'],
    ['13/1/2020', 'month out of range'],
    ['13/45/2020', 'month and day out of range'],
    ['2/29/2021', '2021 is not a leap year'],
  ])('rejects %s (%s)', (dob) => {
    expect(isDobValid(dob)).toBeNull();
  });

  it('accepts a valid leap day', () => {
    expect(isDobValid('2/29/2020')).toBeInstanceOf(Date);
  });

  it('rejects a future date', () => {
    const nextYear = new Date().getFullYear() + 1;
    expect(isDobValid(`1/1/${nextYear}`)).toBeNull();
  });
});
