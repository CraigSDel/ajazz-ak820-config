import { appendFile, readFile } from "node:fs/promises";

const reportPath = new URL("../coverage/coverage-summary.json", import.meta.url);
const report = JSON.parse(await readFile(reportPath, "utf8"));
const metrics = ["statements", "branches", "functions", "lines"];

const markdown = [
  "## Test coverage",
  "",
  "| Metric | Covered | Total | Coverage |",
  "| --- | ---: | ---: | ---: |",
  ...metrics.map((metric) => {
    const result = report.total[metric];
    return `| ${metric[0].toUpperCase()}${metric.slice(1)} | ${result.covered} | ${result.total} | ${result.pct}% |`;
  }),
  "",
].join("\n");

if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, markdown);
} else {
  process.stdout.write(markdown);
}
