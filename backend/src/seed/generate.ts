import { REFERENCE_COUNTRIES } from '../referenceData/countries.js';
import type { NewSalaryHistoryEntry } from '../repositories/salaryHistory.js';
import type { EmployeeInput } from '../validators/employee.js';
import { salaryTotal, type SalaryComponent } from '../validators/salaryComponents.js';
import { createRandom, type Random } from './random.js';

export type GeneratedHistoryEntry = Omit<NewSalaryHistoryEntry, 'employeeId'>;

export interface GeneratedEmployee {
  details: EmployeeInput;
  /** Current salary: always equal to the last history entry's new components. */
  components: SalaryComponent[];
  /** Oldest first, starting with new_hire on the hire date. */
  history: GeneratedHistoryEntry[];
  leftOn: string | null;
}

/** Roles with a typical US salary; other countries scale it by their pay factor. */
const ROLES = [
  { department: 'Engineering', jobTitle: 'Software Engineer', baseUsd: 110_000, weight: 18 },
  { department: 'Engineering', jobTitle: 'Senior Software Engineer', baseUsd: 145_000, weight: 9 },
  { department: 'Engineering', jobTitle: 'Engineering Manager', baseUsd: 175_000, weight: 3 },
  { department: 'Engineering', jobTitle: 'QA Engineer', baseUsd: 85_000, weight: 5 },
  { department: 'Engineering', jobTitle: 'DevOps Engineer', baseUsd: 120_000, weight: 4 },
  { department: 'Data', jobTitle: 'Data Analyst', baseUsd: 80_000, weight: 5 },
  { department: 'Data', jobTitle: 'Data Scientist', baseUsd: 130_000, weight: 3 },
  { department: 'Product', jobTitle: 'Product Manager', baseUsd: 135_000, weight: 4 },
  { department: 'Product', jobTitle: 'Product Designer', baseUsd: 105_000, weight: 3 },
  { department: 'Sales', jobTitle: 'Account Executive', baseUsd: 90_000, weight: 8 },
  { department: 'Sales', jobTitle: 'Sales Manager', baseUsd: 130_000, weight: 3 },
  { department: 'Marketing', jobTitle: 'Marketing Specialist', baseUsd: 75_000, weight: 5 },
  { department: 'Finance', jobTitle: 'Accountant', baseUsd: 70_000, weight: 4 },
  { department: 'Finance', jobTitle: 'Financial Analyst', baseUsd: 85_000, weight: 3 },
  { department: 'People', jobTitle: 'HR Generalist', baseUsd: 65_000, weight: 3 },
  { department: 'People', jobTitle: 'Recruiter', baseUsd: 70_000, weight: 3 },
  { department: 'Operations', jobTitle: 'Operations Analyst', baseUsd: 68_000, weight: 4 },
  { department: 'Customer Support', jobTitle: 'Support Specialist', baseUsd: 50_000, weight: 10 },
] as const;

// Kept compact (one list per line) rather than one name per line.
// prettier-ignore
const NAMES = {
  indian: {
    first: ['Aarav', 'Aditi', 'Ananya', 'Arjun', 'Diya', 'Ishaan', 'Kavya', 'Meera', 'Neha', 'Nikhil', 'Pooja', 'Priya', 'Rahul', 'Riya', 'Rohan', 'Saanvi', 'Sameer', 'Sneha', 'Vihaan', 'Vikram'],
    last: ['Agarwal', 'Bansal', 'Chopra', 'Das', 'Gupta', 'Iyer', 'Joshi', 'Kapoor', 'Kumar', 'Mehta', 'Menon', 'Nair', 'Patel', 'Rao', 'Reddy', 'Shah', 'Sharma', 'Singh', 'Verma', 'Yadav'],
  },
  english: {
    first: ['Amelia', 'Benjamin', 'Charlotte', 'Daniel', 'Emily', 'Ethan', 'Grace', 'Harry', 'Isla', 'Jack', 'James', 'Lily', 'Lucas', 'Mia', 'Noah', 'Oliver', 'Olivia', 'Sophie', 'Thomas', 'William'],
    last: ['Anderson', 'Baker', 'Brown', 'Clarke', 'Davies', 'Evans', 'Green', 'Hall', 'Hughes', 'Johnson', 'Jones', 'Lee', 'Martin', 'Miller', 'Robinson', 'Smith', 'Taylor', 'Walker', 'White', 'Wilson'],
  },
  german: {
    first: ['Anna', 'Ben', 'Clara', 'Elias', 'Emma', 'Felix', 'Hanna', 'Jonas', 'Lea', 'Leon', 'Lukas', 'Marie', 'Max', 'Mia', 'Noah', 'Paul', 'Sophie', 'Tim', 'Lena', 'Jürgen'],
    last: ['Bauer', 'Becker', 'Fischer', 'Hoffmann', 'Koch', 'Krüger', 'Lehmann', 'Meyer', 'Müller', 'Neumann', 'Richter', 'Schäfer', 'Schmidt', 'Schneider', 'Schulz', 'Wagner', 'Weber', 'Wolf', 'Zimmermann', 'Braun'],
  },
  french: {
    first: ['Camille', 'Chloé', 'Élise', 'Emma', 'Gabriel', 'Hugo', 'Inès', 'Jade', 'Jérôme', 'Jules', 'Léa', 'Louis', 'Lucas', 'Manon', 'Nathan', 'Noémie', 'Raphaël', 'Sarah', 'Théo', 'Zoé'],
    last: ['Bernard', 'Bonnet', 'Dubois', 'Durand', 'Fontaine', 'Fournier', 'Garnier', 'Girard', 'Lambert', 'Lefèvre', 'Leroy', 'Martin', 'Mercier', 'Moreau', 'Petit', 'Richard', 'Robert', 'Roux', 'Simon', 'Thomas'],
  },
  singaporean: {
    first: ['Wei Ling', 'Jun Jie', 'Hui Min', 'Wei Jie', 'Siti', 'Ahmad', 'Priya', 'Rajesh', 'Mei Ling', 'Kai Wen', 'Xin Yi', 'Zhi Hao', 'Nur', 'Farah', 'Daniel', 'Rachel', 'Jasmine', 'Marcus', 'Shu Fen', 'Kumar'],
    last: ['Tan', 'Lim', 'Lee', 'Ng', 'Ong', 'Wong', 'Goh', 'Chua', 'Chan', 'Koh', 'Teo', 'Ang', 'Yeo', 'Tay', 'Ho', 'Low', 'Toh', 'Sim', 'Chong', 'Rahman'],
  },
  emirati: {
    first: ['Ahmed', 'Aisha', 'Fatima', 'Hamdan', 'Khalid', 'Layla', 'Mariam', 'Mohammed', 'Noura', 'Omar', 'Rashid', 'Saeed', 'Salma', 'Sara', 'Sultan', 'Yousef', 'Zayed', 'Hessa', 'Mansour', 'Reem'],
    last: ['Al Mansoori', 'Al Nuaimi', 'Al Shamsi', 'Al Suwaidi', 'Al Hashimi', 'Al Mazrouei', 'Al Ketbi', 'Al Falasi', 'Al Marri', 'Al Qasimi', 'Haddad', 'Khoury', 'Nasser', 'Saleh', 'Hassan', 'Farouk', 'Aziz', 'Karim', 'Rahman', 'Yassin'],
  },
  japanese: {
    first: ['Haruto', 'Yui', 'Sota', 'Hina', 'Riku', 'Aoi', 'Yuto', 'Mei', 'Kaito', 'Sakura', 'Ren', 'Yuna', 'Hiroshi', 'Akiko', 'Takumi', 'Emi', 'Kenji', 'Naoko', 'Daiki', 'Rin'],
    last: ['Sato', 'Suzuki', 'Takahashi', 'Tanaka', 'Watanabe', 'Ito', 'Yamamoto', 'Nakamura', 'Kobayashi', 'Kato', 'Yoshida', 'Yamada', 'Sasaki', 'Yamaguchi', 'Matsumoto', 'Inoue', 'Kimura', 'Hayashi', 'Shimizu', 'Mori'],
  },
} as const;

type NameSet = keyof typeof NAMES;
type CountryCode = (typeof REFERENCE_COUNTRIES)[number]['code'];

interface CountryProfile {
  weight: number;
  /** Pay level relative to the US. */
  payFactor: number;
  names: NameSet;
  /** Round amounts to this many local units, so salaries look like real ones. */
  step: number;
}

const COUNTRY_PROFILES: Record<CountryCode, CountryProfile> = {
  IN: { weight: 35, payFactor: 0.28, names: 'indian', step: 1_000 },
  US: { weight: 18, payFactor: 1, names: 'english', step: 100 },
  GB: { weight: 10, payFactor: 0.72, names: 'english', step: 100 },
  DE: { weight: 8, payFactor: 0.75, names: 'german', step: 100 },
  FR: { weight: 5, payFactor: 0.68, names: 'french', step: 100 },
  CA: { weight: 6, payFactor: 0.78, names: 'english', step: 100 },
  AU: { weight: 5, payFactor: 0.8, names: 'english', step: 100 },
  SG: { weight: 5, payFactor: 0.82, names: 'singaporean', step: 100 },
  AE: { weight: 4, payFactor: 0.7, names: 'emirati', step: 100 },
  JP: { weight: 4, payFactor: 0.62, names: 'japanese', step: 10_000 },
};

const EARLIEST_HIRE = '2014-01-01';
const LEAVER_SHARE = 0.05;
const DAY_MS = 86_400_000;

const toTime = (isoDate: string) => Date.parse(`${isoDate}T00:00:00.000Z`);
const toIsoDate = (time: number) => new Date(time).toISOString().slice(0, 10);
const addDays = (isoDate: string, days: number) => toIsoDate(toTime(isoDate) + days * DAY_MS);
const roundTo = (value: number, step: number) => Math.max(step, Math.round(value / step) * step);

/** Lower-case ASCII for emails: "Jérôme Lefèvre" → "jerome.lefevre". */
function emailPart(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]+/g, '');
}

/**
 * Splits a total salary into components the way each country typically structures pay.
 * The split depends only on the total and the employee's fixed allowance choices, so every
 * history entry for one employee has the same shape.
 */
function splitIntoComponents(
  total: number,
  countryCode: CountryCode,
  hasTransport: boolean,
  step: number,
): SalaryComponent[] {
  const basic = roundTo(total * 0.5, step);
  const components: SalaryComponent[] = [{ code: 'BASIC', annualAmount: basic }];
  if (countryCode === 'IN') {
    components.push({ code: 'HRA', annualAmount: roundTo(basic * 0.4, step) });
  }
  if (countryCode === 'AE' || countryCode === 'SG') {
    components.push({ code: 'HOUSING', annualAmount: roundTo(total * 0.2, step) });
  }
  if (hasTransport) {
    components.push({ code: 'TRANSPORT', annualAmount: roundTo(total * 0.05, step) });
  }
  const special = total - salaryTotal(components);
  if (special > 0) {
    components.push({ code: 'SPECIAL', annualAmount: special });
  } else {
    components[0] = { code: 'BASIC', annualAmount: basic + special };
  }
  return components;
}

function generateEmployee(
  random: Random,
  today: string,
  takenEmails: Map<string, number>,
): GeneratedEmployee {
  const countryCode = random.weighted(
    REFERENCE_COUNTRIES.map((country) => [country.code, COUNTRY_PROFILES[country.code].weight]),
  );
  const country = REFERENCE_COUNTRIES.find((candidate) => candidate.code === countryCode)!;
  const profile = COUNTRY_PROFILES[countryCode];
  const role = random.weighted(ROLES.map((candidate) => [candidate, candidate.weight]));

  const names = NAMES[profile.names];
  const firstName = random.pick(names.first);
  const lastName = random.pick(names.last);
  const emailBase = `${emailPart(firstName)}.${emailPart(lastName)}`;
  const emailCount = (takenEmails.get(emailBase) ?? 0) + 1;
  takenEmails.set(emailBase, emailCount);
  const email = `${emailBase}${emailCount > 1 ? emailCount : ''}@acme.example`;

  const latestHire = addDays(today, -14);
  const hireDate = toIsoDate(random.int(toTime(EARLIEST_HIRE), toTime(latestHire)));
  const yearsEmployed = (toTime(today) - toTime(hireDate)) / (365 * DAY_MS);

  // Start lower the longer someone has been here, then apply yearly reviews going forward.
  const usdPerUnit = Number(country.usdPerUnit);
  const targetUsd = role.baseUsd * profile.payFactor * random.between(0.85, 1.2);
  let total = roundTo(targetUsd / usdPerUnit / 1.045 ** yearsEmployed, profile.step);
  const hasTransport = countryCode === 'IN' || random.chance(0.4);
  const split = (amount: number) =>
    splitIntoComponents(amount, countryCode, hasTransport, profile.step);

  let components = split(total);
  const history: GeneratedHistoryEntry[] = [
    {
      effectiveDate: hireDate,
      reason: 'new_hire',
      previousComponents: null,
      previousTotal: null,
      newComponents: components,
      newTotal: total,
    },
  ];

  const recordChange = (
    effectiveDate: string,
    reason: GeneratedHistoryEntry['reason'],
    factor: number,
  ) => {
    const newTotal = roundTo(total * factor, profile.step);
    if (newTotal === total) {
      return;
    }
    const newComponents = split(newTotal);
    history.push({
      effectiveDate,
      reason,
      previousComponents: components,
      previousTotal: total,
      newComponents,
      newTotal,
    });
    components = newComponents;
    total = newTotal;
  };

  // Reviews happen every 1 April, from the first April at least six months after hiring.
  const firstReviewYear = Number(addDays(hireDate, 183).slice(0, 4));
  for (let year = firstReviewYear; year <= Number(today.slice(0, 4)); year += 1) {
    const reviewDate = `${year}-04-01`;
    if (reviewDate <= addDays(hireDate, 183) || reviewDate > today) {
      continue;
    }
    const outcome = random.next();
    if (outcome < 0.08) {
      recordChange(reviewDate, 'promotion', random.between(1.1, 1.2));
    } else if (outcome < 0.93) {
      recordChange(reviewDate, 'annual_increment', random.between(1.03, 1.09));
    }
    const correctionDate = addDays(reviewDate, random.int(30, 150));
    if (random.chance(0.03) && correctionDate <= today) {
      recordChange(correctionDate, 'correction', random.between(1.01, 1.03));
    }
  }

  const lastChange = history.at(-1)!.effectiveDate;
  const leftOn = random.chance(LEAVER_SHARE)
    ? toIsoDate(random.int(toTime(lastChange), toTime(today)))
    : null;

  return {
    details: {
      fullName: `${firstName} ${lastName}`,
      email,
      jobTitle: role.jobTitle,
      department: role.department,
      countryCode,
      hireDate,
    },
    components,
    history,
    leftOn,
  };
}

/**
 * Generates realistic employees with salary components and history. The same seed and `today`
 * always produce exactly the same data, so demos and tests are reproducible.
 */
export function generateEmployees(options: {
  count: number;
  seed: number;
  today: string;
}): GeneratedEmployee[] {
  const random = createRandom(options.seed);
  const takenEmails = new Map<string, number>();
  return Array.from({ length: options.count }, () =>
    generateEmployee(random, options.today, takenEmails),
  );
}
