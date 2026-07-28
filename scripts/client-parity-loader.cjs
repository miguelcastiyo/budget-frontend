const fs = require("node:fs")
const path = require("node:path")

const fixtureRoot = path.resolve(__dirname, "../../budget-backend/tests/fixtures/privacy-parity")

function loadCanonicalCorpus() {
  const manifest = JSON.parse(fs.readFileSync(path.join(fixtureRoot, "manifest.json"), "utf8"))
  const entries = manifest.entries.map((entry) => ({
    manifest: entry,
    fixture: JSON.parse(fs.readFileSync(path.resolve(path.join(fixtureRoot, "..", "..", "..", entry.fixture_path)), "utf8")),
  }))
  return { fixtureRoot, manifest, entries }
}

function coverage(corpus) {
  const groups = new Set(corpus.entries.map(({ manifest }) => manifest.group_id))
  const invariants = new Set(corpus.entries.flatMap(({ manifest }) => manifest.covered_invariant_ids))
  const invariantCandidates = [
    path.resolve(fixtureRoot, "../../../../docs/financial-domain-invariants.md"),
    path.resolve(fixtureRoot, "../../../../docs-internal/architecture/privacy-program/financial-domain-invariants.md"),
  ]
  const invariantPath = invariantCandidates.find((candidate) => fs.existsSync(candidate))
  if (!invariantPath) throw new Error("Unable to locate the tracked financial-domain invariants document")
  const invariantDoc = fs.readFileSync(invariantPath, "utf8")
  const highPriority = new Set([...invariantDoc.matchAll(/^\| (INV-[A-Z0-9-]+) \|.*\| high \|/gm)].map((match) => match[1]))
  return { logicalGroups: groups.size, scenarios: corpus.entries.length, highPriorityInvariants: highPriority.size, coveredHighPriority: [...highPriority].filter((id) => invariants.has(id)).length, entries: corpus.entries }
}

module.exports = { loadCanonicalCorpus, coverage }
