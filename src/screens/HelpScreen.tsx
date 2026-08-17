import { TopBar } from "../components/shell";

const sections: { title: string; entries: [string, string][] }[] = [
  {
    title: "Record lifecycle",
    entries: [
      ["Draft", "Editable and autosaved. Drafts survive closing or restarting the app — everything is stored on the device as you type."],
      ["Completed", "Finalized by the handler with an acknowledgment. Read-only; changes require a documented correction with a reason."],
      ["Reviewed", "A supervisor or trainer has recorded a review on a completed record."],
      ["Locked", "Permanently read-only. Corrections are no longer possible from the app."],
      ["Correction", "Editing a finalized record stores the original values, the person, the time, and your stated reason in the revision history. This is an auditability feature — it does not by itself establish legal chain of custody."]
    ]
  },
  {
    title: "Hide outcomes",
    entries: [
      ["Found — independent", "The K9 located the hide and gave a final indication without handler assistance."],
      ["Found — handler assisted", "A correct response that required handler help, such as a directed recheck or presentation."],
      ["Interest, no indication", "The K9 showed interest but did not commit to a final response. Not counted as a find or a false response."],
      ["Missed", "The K9 searched the area and failed to locate the hide."],
      ["Not searched", "The hide was placed but its area was never searched. Excluded from find-rate math."],
      ["False response", "A final response where no target odor was confirmed present. Recorded per exercise, since it is not tied to any real hide."],
      ["Blank search", "An exercise deliberately containing no target odor. 'Correctly cleared' means the K9 gave no final response."]
    ]
  },
  {
    title: "Blindness levels",
    entries: [
      ["Known", "The handler knew the hide locations."],
      ["Single-blind", "The handler did not know the locations; the placer or evaluator did."],
      ["Double-blind", "No one present during the search knew the locations. Certification bodies (e.g., SWGDOG-derived guidelines) recommend periodic double-blind assessments including a negative/blank search."]
    ]
  },
  {
    title: "Metrics",
    entries: [
      ["Find rate", "Confirmed finds ÷ searched hides. 'Searched hides' excludes hides with no outcome or marked Not searched. A training metric only — not a scientific estimate of operational reliability."],
      ["Searched hides", "Hides with a recorded outcome of found, missed, or interest-only."],
      ["Small sample", "Fewer than 20 searched hides in the selected window. Rates from small samples are flagged because they swing widely."],
      ["Session duration", "End time minus start time. Sessions crossing midnight are handled."],
      ["Cups", "Food-reward cups. ESD dogs are typically food-driven and fed through training, so daily cup counts also document feeding."]
    ]
  },
  {
    title: "Why record misses, false responses, and blanks?",
    entries: [
      ["Court reliability", "In Florida v. Harris (2013), the U.S. Supreme Court held that a dog's reliability is judged by the totality of the circumstances, with training and certification records as central evidence. Complete records — including misses, false responses, and blank searches — are what withstand cross-examination. Courts have discounted dogs whose handlers kept no false-response records."],
      ["Training value", "Patterns in misses and false responses (heat, airflow, residual odor, cueing) identify exactly what to train next."]
    ]
  },
  {
    title: "Data & privacy",
    entries: [
      ["Storage", "All records live in this device's browser storage (IndexedDB). Nothing is uploaded anywhere. Exports and backups only go where you send them."],
      ["Backups", "Create backups regularly from More → Backup & restore. Clearing browser data for this site deletes your records — a backup file is the recovery path."],
      ["Installing", "In Chrome on Android, use menu → 'Add to home screen' / 'Install app' to install this as an app that works fully offline."]
    ]
  }
];

export default function HelpScreen() {
  return (
    <>
      <TopBar title="Help & Definitions" back="/more" />
      <main className="shell-main">
        {sections.map((s) => (
          <div key={s.title} className="card">
            <h3>{s.title}</h3>
            <dl>
              {s.entries.map(([term, def]) => (
                <div key={term} style={{ marginBottom: 10 }}>
                  <dt style={{ fontWeight: 700 }}>{term}</dt>
                  <dd style={{ margin: 0, color: "var(--text-2)", fontSize: "var(--fs-sm)" }}>{def}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </main>
    </>
  );
}
