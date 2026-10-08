// Closes the QA form-test leads the forms suite creates in staging.
// Finds the NILE-QA-* lost reason, marks nile.qa.form* leads lost, disables it.
import { Api } from "./lib.mjs";

const admin = new Api();
await admin.login("SUPER_ADMIN");
const marker = (await admin.call("GET", "/api/ncc/settings/lost-reasons")).data.items.find(r =>
  r.name.startsWith("NILE-QA-")
);
if (!marker) {
  console.log("no NILE-QA- lost reason; nothing to clean");
  await admin.logout();
  process.exit(0);
}
await admin.call("POST", `/api/ncc/settings/lost-reasons/${marker.id}/enable`);
const leads = (await admin.call("GET", "/api/ncc/admissions/leads?q=nile.qa.form&pageSize=100")).data.items.filter(
  l => !["lost", "registered"].includes(l.status)
);
for (const l of leads)
  console.log(
    l.email,
    (await admin.call("PATCH", `/api/ncc/admissions/leads/${l.id}`, { status: "lost", lostReasonId: marker.id })).status
  );
console.log("closed", leads.length, "form-test leads");
console.log("marker reason disabled again", (await admin.call("POST", `/api/ncc/settings/lost-reasons/${marker.id}/disable`)).status);
await admin.logout();
