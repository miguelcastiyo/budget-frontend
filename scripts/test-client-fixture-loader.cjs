const { coverage, loadCanonicalCorpus } = require("./client-parity-loader.cjs")
const corpus = loadCanonicalCorpus()
const report = coverage(corpus)
if (report.logicalGroups !== 24 || report.scenarios !== 25 || report.coveredHighPriority !== 80) throw new Error(`Unexpected canonical corpus: ${JSON.stringify(report)}`)
for (const { manifest, fixture } of report.entries) {
  if (fixture.fixture_id !== manifest.fixture_id || fixture.group_id && fixture.group_id !== manifest.group_id) throw new Error(`Manifest/fixture mismatch: ${manifest.fixture_id}`)
}
console.log(`Canonical Phase 0D corpus loaded: ${report.logicalGroups}/24 groups, ${report.scenarios}/25 scenarios, ${report.coveredHighPriority}/80 high-priority invariants`)
