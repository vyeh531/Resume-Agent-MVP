const assert = require("assert");
const { inferRoleFamilyFromJobTitle } = require("../services/mentorAdviceRetrieval");

const CASES = [
  ["Machine Learning Engineer", "machine_learning"],
  ["Machine Learning Engineer Intern (MLE)", "machine_learning"],
  ["ML Engineer", "machine_learning"],
  ["AI Engineer", "ai_engineer"],
  ["LLM Engineer", "ai_engineer"],
  ["Generative AI Engineer", "ai_engineer"],
  ["Data Scientist", "data_scientist"],
  ["Data Analyst", "data_analyst"],
  ["Business Intelligence Analyst", "data_analyst"],
  ["Software Engineer", "software_engineer"],
  ["Software Development Engineer", "software_engineer"],
  ["Backend Engineer", "software_engineer"],
  ["Frontend Engineer", "software_engineer"],
  ["Full Stack Engineer", "software_engineer"],
  ["Staff Accountant", "accounting"],
  ["Accounting Associate", "accounting"],
  ["Financial Analyst", "finance"],
  ["Investment Analyst", "finance"],
  ["Operations Analyst", "business"],
  ["Business Strategy Associate", "business"],
];

let failed = 0;
for (const [title, expected] of CASES) {
  const actual = inferRoleFamilyFromJobTitle(title);
  const ok = actual === expected;
  console.log(`${ok ? "OK " : "BAD"} ${title.padEnd(42)} -> ${actual} ${ok ? "" : `(expected ${expected})`}`);
  try {
    assert.equal(actual, expected);
  } catch {
    failed += 1;
  }
}

if (failed) {
  console.error(`\n${failed} taxonomy cases failed`);
  process.exit(1);
}

console.log(`\n${CASES.length} taxonomy cases passed`);
