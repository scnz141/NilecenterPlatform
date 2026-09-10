# Frontend API reference

Staff UI contract for the EMS rebuild. Pair this file with live OpenAPI at
**`/api/docs`** (schema, enums, Try it out). This file covers purpose, call
order, who may call what, and field rules that Swagger does not spell out.

Do not read backend source or `design/backend/*-plan.md` to build the UI. Students and
guardians never use EMS.

Public paths below include the nginx prefix **`/api`**. JSON field names match
OpenAPI models (`User_Create_Request`, and so on).

---

## How to use this document

1. **Auth and shell** — read [Client basics](#client-basics), [Roles and
   workspace](#roles-and-workspace), then the [flows](#flows).
2. **Screens** — jump to the resource section. Each endpoint has a purpose; skip
   routes whose purpose is Super-admin / ops if that screen is out of your
   slice.
3. **Request/response shapes** — OpenAPI. Come back here for formats, XOR
   bodies, and case-based required fields (`caller_password`, Moodle `mode`,
   …).
4. **Errors** — show the server message to the user. Do not branch on a
   catalogue of `detail` strings. Drive flow from `/api/auth/me` (role,
   workspace) and HTTP status codes ([Errors](#errors)).

---

## Client basics

### Base URL and headers

| | |
| --- | --- |
| Browser origin | nginx (same host as the UI). Call **`/api/...`**. |
| Auth | `Authorization: Bearer <access_token>` on every route except login, refresh, invitation validate/accept, and the three liveness routes. |
| Content type | `application/json` on requests with a body. |
| Creates | HTTP **200** with the resource body (not 201). |
| Empty success | HTTP **204** (logout, session revoke, change-password). |

Swagger Authorize: paste the **access** token only (scheme `BearerAuth`).

### Tokens

`POST /api/auth/login` and `POST /api/auth/refresh` return:

- `access_token` — short-lived (15 minutes). Send on API calls.
- `refresh_token` — longer-lived (30 days). Send **only** to `/api/auth/refresh`.
- `access_token_expires_at` / `refresh_token_expires_at` — UTC ISO-8601 with
  `Z`, e.g. `2026-09-03T08:15:00Z`.
- `session_id` — this login session (see [Auth sessions](#auth-sessions) vs
  class sessions).
- `user` — staff account snapshot.

Refresh **rotates** the pair: store the new tokens; the previous refresh token
stops working. Logout invalidates the current session; `logout-all` invalidates
every session for that user. After 401 on a data call, try refresh once; if
refresh fails, send the user to login.

**`POST /api/auth/switch-workspace` does not rotate tokens.** Keep the same
access token; it picks up the new `workspace_branch_id`. After a successful
switch, **refetch** workspace-scoped lists (do not keep the previous branch’s
cached rows). The UI SWR keys include `active_role` + `workspace_branch_id`
for that reason.

**`POST /api/auth/switch-role` returns a full new token pair.** Replace both
tokens.

Never put tokens in query strings, logs, or analytics. One-time secrets
(`invitation_url`, `generated_password`, `generated_moodle_password`) appear
**once** on the mutating response — show a copy dialog; they are omitted from
later GETs.

### Lists and omitted keys

Most list endpoints return a JSON **array** with no pagination. Exceptions:
notifications and audit events take `limit` (default 50, max 100).

Many responses **omit** keys whose value is null (phone, optional schedule,
one-time passwords, HOD `departments` when the user is not an HOD). Treat
missing as “not set”, not as an empty string.

### PATCH

Omitted fields are left unchanged. To clear some optional fields, send JSON
`null` or `""` where the schema allows (blank phone/nationality become unset).
If you send a nested object (`profile`, `scopes`), that object is a
**replace** of what you include — see each resource.

---

## Errors

Status-code meanings: [`API_CONVENTIONS.md`](./API_CONVENTIONS.md).

| Code | UI |
| --- | --- |
| **200** / **204** | Success. |
| **400** | Show `detail` (string). Usually invalid state or a body id that does not exist. If Branch admin / Registrar has `workspace_branch_id` null on `/auth/me`, send them to the branch picker **before** retrying workspace-guarded routes. |
| **401** | Missing/expired/revoked access token, or step-up `caller_password` did not match. Refresh or re-login; for step-up, prompt the caller’s password again. |
| **403** | Signed in but this **active** role cannot do it. Hide the action; do not retry. |
| **404** | Path id does not exist **or** is outside this caller’s scope. Same treatment: not found. |
| **409** | Uniqueness (email, branch name, class name, already enrolled, …). Show `detail`. |
| **422** | Body failed schema validation. `detail` is an **array** of `{ loc, msg, type }`. Highlight the field in `loc`. |
| **500** | Generic failure. `detail` is a safe message; do not dump it as a stack. |

Do not parse `detail` to discover hidden behaviour. If the UI needs a
decision (workspace set? Moodle bound?), read `/auth/me` or the resource you
already loaded.

---

## Roles and workspace

EMS is **staff-only**. Role strings (JSON):

`super_admin` · `branch_admin` · `hod` · `registrar` · `teacher`

| Concept | Where | Use |
| --- | --- | --- |
| **Assigned role** | `user.assigned_role` and `assigned_role` on `/auth/me` | Permanent role. Show a “viewing as …” banner when it differs from active. |
| **Active role** | `active_role` on `/auth/me` | Drive **navigation and which buttons exist**. After switch-role, this is the view. |
| **Workspace** | `workspace_branch_id` on `/auth/me` | Current branch for Branch admin and Registrar. |

Privilege order (highest first): Super admin → Branch admin → HOD → Registrar → Teacher.

### Who uses workspace

| Active role | Workspace |
| --- | --- |
| Super admin | Optional. Most Super-admin lists do not require it. May set any **active** branch or clear with `branch_id: null`. |
| Branch admin | **Required** before almost all operational list/write routes. |
| Registrar | Same as Branch admin. |
| HOD | Not used. Visibility is assigned **departments** (`user.departments` on `/auth/me`). |
| Teacher | Not used. Visibility is **assigned classes**. |

`GET /api/branches` (picker) does **not** need workspace. `GET /api/moodle/users`
and `GET /api/moodle/groups` do not need workspace; the create/link that follows
does (for BA/Registrar).

Branch admin / Registrar: on login, if `workspace_branch_id` is null, show the
picker (`GET /api/branches`) then `POST /api/auth/switch-workspace`. Keep
switch-role available on that screen (assigned Super admin / Branch admin /
HOD may restore their assigned role without picking a branch first).

### Role switch

Allowed only for assigned **Super admin**, **Branch admin**, and **HOD**.
Registrar and Teacher cannot switch.

`POST /api/auth/switch-role` body: `{ "target_role": "<role>" }`.

- Switch **down** to any strictly lower role.
- Switch **back** by sending the assigned role.

Returns a new token pair. Rebuild the shell from the new `user` + `/auth/me`.

### Visibility cheat sheet

What an **active** role can generally do (403 otherwise). Row filters still
apply (workspace, departments, assigned classes).

| Area | Super admin | Branch admin | HOD | Registrar | Teacher |
| --- | --- | --- | --- | --- | --- |
| Staff users | yes | workspace, BA and below | — | — | — |
| Branch catalog write | yes | — | — | — | — |
| Branch list | full catalog | ceiling active (picker) | — | ceiling active (picker) | — |
| Department catalog | yes | — | — | — | — |
| Moodle **site** config | yes | — | — | — | — |
| Moodle course picker | yes | — | — | — | — |
| EMS courses read | all statuses | active | assigned depts | active | courses of assigned classes |
| EMS courses write | yes | — | — | — | — |
| Classes read | all | workspace active | assigned depts | workspace active | assigned (incl. disabled) |
| Classes / enrolment write | yes | workspace | — | workspace | — |
| Roster / attendance / grades read | yes | workspace | dept classes | workspace | assigned classes |
| Students / leads / placement | yes | workspace | — | workspace | — |
| Rooms write | yes | workspace | — | workspace | — |
| Rooms / sessions read | yes | scoped | scoped | scoped | scoped |
| Teacher workspace | — | — | — | — | **only** |
| Custom field **definitions** write | yes | — | — | — | — |
| Custom field definitions read | yes | yes (for user forms) | — | — | — |
| System health | yes | — | — | — | — |
| Audit | all streams | branch streams + workspace | — | branch streams + workspace | — |
| Notifications | own inbox | own | own | own | own |

A Super admin **switched** to Branch admin is treated as Branch admin for these
rows (cannot edit the branch catalog until they switch back).

---

## Shared field formats

Use these on every resource that has the field. OpenAPI types are `string`
unless noted.

### Phone (`phone`, `guardian_phone`)

**E.164**: `+` then country code then subscriber number, no spaces.

| Valid | Invalid |
| --- | --- |
| `+201012345678` (Egypt) | `01012345678` (national only) |
| `+14155552671` (US) | `+20 101 234 5678` (spaces) |

Optional. Blank `""` is stored as unset. Malformed → **422**.

### Nationality (`profile.nationality`)

**ISO 3166-1 alpha-3** (three letters). The API uppercases lowercase input.

| Valid | Invalid |
| --- | --- |
| `EGY`, `USA`, `GBR` | `Egypt`, `US`, `eg` |

Optional. Blank → unset. Names and alpha-2 codes → **422**.

### Email

- **Login** (`POST /auth/login`): ordinary string (the stored address).
- **Creates/patches** (`POST /users`, students, leads, …): must be a valid
  email, max 320 characters. Some reserved test suffixes are rejected (**422**).
  Use a normal address in forms (`user@example.com`).
- Compared case-insensitively; the API stores a normalised form.

Staff, student, and lead emails must be unique within their own collection.
Converting a lead fails **409** if that email already exists on a student.

### Person names

`first_name` / `last_name` (and guardian name): trimmed, max **100** characters.
Required on create unless the section says otherwise.

### Dates

| Field | JSON | Notes |
| --- | --- | --- |
| `date_of_birth` (staff profile) | `"2012-04-15"` (`YYYY-MM-DD`) | Optional. |
| `date_of_birth` (student) | same | Optional; must **not** be in the future. |
| Timestamps (`created_at`, `start_at`, `scheduled_at`, …) | `"2026-09-01T07:00:00Z"` | UTC with `Z`. |
| `schedule_start_time` / `schedule_end_time` | `"07:00:00"` | Clock time in the **branch IANA timezone**, not UTC. |

### Catalog `name` and `code`

Branch and department **`name`** is stored **lowercase**. Display it as
returned for now (a separate display-name field is not shipped). Max 100.

Optional **`code`**: `a-z`, `0-9`, underscore only (`nile_cairo`). Max 64.
Blank → unset. Duplicate name or code → **409**.

Class **`name`**: trimmed, max 150, **unique across the whole system**
(case-sensitive). Duplicate → **409**. Display as returned.

Room **`name`**: unique per branch (case-sensitive).

### Timezone

Branch `timezone` is an **IANA** name, e.g. `Africa/Cairo`, `UTC`. Default on
create: `UTC`. Used when generating class sessions from weekly clock times.

### Enums (JSON strings)

| Field | Values |
| --- | --- |
| Staff `status` | `invited`, `active`, `disabled`, `canceled` |
| Branch / department / course / class / student / room `status` | `active`, `disabled` |
| Enrolment `status` | `active`, `withdrawn` |
| Session `status` | `scheduled`, `cancelled` |
| Lead `status` | `new`, `contacted`, `qualified`, `converted`, `lost` |
| Placement test `status` | `scheduled`, `completed`, `cancelled`, `no_show` |
| Custom `field_type` | `text`, `textarea`, `number`, `date`, `boolean`, `select` |
| Scope `scope_type` | `global`, `branch` |
| User `provisioning` | `invitation`, `manual` |
| Moodle bind `mode` | `create`, `link` |

Disable is only valid from `active`; enable only from `disabled`. Repeating
the same transition → **400**. There is no delete on these catalogs.

### Passwords the user types

**Chosen** passwords (invitation accept `password`, self-change `new_password`):
8–128 characters, at least one lowercase, one uppercase, and one digit. Symbols
allowed but not required. Failure → **422**.

**Not** checked against that policy: login `password`, `current_password`, and
`caller_password` (they are existing secrets).

Admin-generated EMS passwords are 14 characters, returned once as
`generated_password`. Moodle-generated passwords include a special character
(Moodle’s own rule); returned once as `generated_moodle_password`.

### `caller_password` (step-up)

The **signed-in Super admin’s current EMS password**, not the target’s.

| Request | Required? |
| --- | --- |
| `POST /users` with `assigned_role: "super_admin"` | **Yes** |
| `POST /users` any other role | No — omit |
| `PATCH /users/{id}` promoting someone **to** Super admin | **Yes** |
| `PATCH /users/{id}` demoting a Super admin **off** Super admin | **Yes** |
| `PATCH /users/{id}` other field/role changes | No |
| `POST /users/{id}/password` when the target is Super admin | **Yes** |
| `POST /users/{id}/password` otherwise | No |

Missing when required → **400**. Wrong value → **401**. Prompt with a password
field labelled as the caller’s own password. Never log it.

### Moodle bind XOR

Staff, students, and class groups share the same body shape:

```json
{ "mode": "create" }
```

```json
{ "mode": "link", "moodle_user_id": 42 }
```

(For classes the id field is `moodle_group_id`.)

- `mode` is required.
- `create`: do **not** send the Moodle id (**422** if present).
- `link`: Moodle id is required, integer **> 0**. Id `1` is rejected (**400**).
- Already bound → **400**. Search first (`GET /api/moodle/users` or
  `/api/moodle/groups`), then link.

Responses never include a Moodle service token. Site config accepts `ws_token`
on write only; GET returns `has_token: true/false`.

### `custom_fields` on staff

Object keyed by **`field_key`** (not definition id), e.g.
`{ "staff_code": "NCC-01" }`. Load definitions from `GET /api/custom-fields`
and render from `field_type`, `is_required`, `options_json`, `help_text`.
On **create**, required definitions must be present. On **PATCH**, send only
keys you are changing (missing required keys are not re-checked the same way
as create — still send required values when first setting them).

Supported `entity_type` today: **`user_profile`**.

---

## Flows

### Sign in

1. `POST /api/auth/login` `{ "email", "password" }` → store tokens.
2. `GET /api/auth/me` → `active_role`, `workspace_branch_id`, `scopes`,
   `user` (including `departments` when HOD).
3. If active role is Branch admin or Registrar and workspace is null → branch
   picker → `POST /api/auth/switch-workspace` `{ "branch_id" }`.
4. If assigned role may switch and you offer “view as”, call
   `POST /api/auth/switch-role` and replace tokens.

### Accept invitation

The create/invite response includes `invitation_url`, shaped like
`{app origin}/invite/accept?token=...`. Implement that frontend route.

1. Read `token` from the query string.
2. `POST /api/auth/invitations/validate` `{ "token" }` → show `email`,
   `expires_at`. No auth header.
3. User chooses a password (chosen-password rules).
4. `POST /api/auth/invitations/accept` `{ "token", "password" }` → same as
   login (token pair). Continue as [Sign in](#sign-in) from step 2.

Expired or used token → error `detail`; send them to an admin to resend.

### Create staff (invitation)

1. Workspace set if you are Branch admin.
2. Optional: `GET /api/custom-fields?entity_type=user_profile&is_active=true`.
3. `POST /api/users` with `provisioning: "invitation"`, `profile`, `scopes`,
   optional `departments` (HOD only), optional `custom_fields`.
4. Super-admin target: include `caller_password`.
5. Show `invitation_url` once (copy / share). Status is `invited`; they cannot
   sign in until accept.

### Create staff (manual password)

Same as invitation but `provisioning: "manual"`. Response includes
`generated_password` once; status is `active`. Show a copy dialog. There is
no forced change on first login.

### Bind a person to Moodle

1. Confirm Moodle is configured (Super admin: `GET /api/moodle/site` →
   `configured` and `has_token`). Other roles just attempt the bind; missing
   config returns **400**.
2. Search: `GET /api/moodle/users?q=` (at least 2 characters).
3. If a match: `POST .../moodle` `{ "mode": "link", "moodle_user_id" }`.
4. If not: `POST .../moodle` `{ "mode": "create" }` → show
   `generated_moodle_password` once.
5. If create returns **409** (email already on Moodle), search and link
   instead — do not auto-link.

Staff: `POST /api/users/{user_id}/moodle` (not self; BA only HOD/Registrar/Teacher
in workspace). Students: `POST /api/students/{student_id}/moodle` (SA/BA/Registrar).

Reset Moodle password later: `POST .../moodle/password` (empty body) → new
`generated_moodle_password` once. Staff cannot reset their own Moodle password
here.

### Open a class and enrol

1. EMS course overlay exists (`POST /api/courses` as Super admin, after Moodle
   picker). Course and department must be **active**.
2. `POST /api/classes` with course, branch, capacity, term `start_at`/`end_at`,
   optional teachers, optional weekly schedule + `default_room_id`.
3. `POST /api/classes/{id}/moodle` create or link a Moodle **group**.
4. Student record exists and is Moodle-bound (`moodle_user_id` set).
5. `POST /api/classes/{id}/enrolments` `{ "student_id" }`. Capacity counts
   **active** enrolments only. Re-enrol of a withdrawn row is allowed.
6. Withdraw: `POST /api/classes/{id}/enrolments/{student_id}/withdraw`.

Teachers take **attendance in Moodle**. EMS only **displays** it
(`GET /api/classes/{id}/attendance/sessions`). From the teacher workspace, open
`moodle_course_url` in a new tab.

### Generate the timetable

1. Class has all three schedule fields: `schedule_days_of_week` (0=Monday …
   6=Sunday, unique, non-empty), `schedule_start_time`, `schedule_end_time`
   (end after start, same local day). Branch `timezone` applies.
2. `POST /api/classes/{id}/sessions/generate` — idempotent; existing slots are
   not duplicated.
3. Reschedule or cancel **future** `scheduled` sessions only
   (`PATCH` / `POST .../cancel` on `/api/sessions/{session_id}`).

### Lead → student

1. `POST /api/leads` (status starts `new`).
2. Optional placement test on the lead (`lead_id` XOR `student_id`).
3. `POST /api/leads/{id}/convert` when status is not `converted` or `lost`.
   Returns `{ "lead", "student" }`. Lead becomes `converted` and is no longer
   patchable. Then bind Moodle on the student as usual.

---

## Liveness

Unauthenticated. Useful for “is the API up?”, not a product screen.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/` | Service envelope (`status: ok`). |
| GET | `/api/ping` | `{ "pong": true }`. |
| GET | `/api/health` | `{ "status": "ok" }`. |

Operator dashboard is `GET /api/system/health` (authenticated Super admin),
not these routes.

---

## Auth

### `POST /api/auth/login`

**Purpose:** Sign in with email and password; start a session.

**Who:** Public. Disabled accounts and invited accounts (no password yet) fail.

**Body:** `email` (string), `password` (string). Both required.

**Returns:** `Auth_Response` (tokens + `user`).

### `POST /api/auth/refresh`

**Purpose:** Exchange a refresh token for a new token pair (new session).

**Who:** Public (valid refresh token). Body: `{ "refresh_token" }`.

Workspace and active role are preserved from the old session.

### `POST /api/auth/logout`

**Purpose:** End **this** session. **204**. Bearer required.

### `POST /api/auth/logout-all`

**Purpose:** End **every** session for this user (sign out other browsers).
**204**.

### `GET /api/auth/me`

**Purpose:** Shell bootstrap: account, `assigned_role`, `active_role`,
`workspace_branch_id`, `scopes`, `session_id`.

`scopes[]`: `{ "scope_type": "global"|"branch", "scope_id": uuid|null, "is_live": bool }`.
`is_live` is false when a branch grant points at a now-disabled branch.

HOD only: `user.departments[]` with `department_id`, `name`, `status`. The key
is omitted for other roles.

### `PATCH /api/auth/me`

**Purpose:** The signed-in person updates **their own** profile (F05). Cannot
change email, role, or scopes here.

**Body:** `{ "profile": Profile_Write }` — `first_name` and `last_name`
required inside `profile`; phone / nationality / address / date_of_birth /
notes optional (formats above).

**Returns:** `Me_Response`.

### `POST /api/auth/switch-workspace`

**Purpose:** Set or clear the session’s current branch **without** new tokens.

**Body:** `{ "branch_id": "<uuid>" }` or `{ "branch_id": null }` to clear.

**Who:** Super admin (any active branch), Branch admin and Registrar (an
**active** branch they are assigned). HOD / Teacher → **403**.

**Returns:** `Me_Response` only (not a token pair).

### `POST /api/auth/switch-role`

**Purpose:** View the app as a lower role, or restore the assigned role.

**Body:** `{ "target_role": "teacher" }` (any legal role string).

**Returns:** full `Auth_Response`. Replace stored tokens.

### `POST /api/auth/change-password`

**Purpose:** Change **own** EMS password. **204**.

**Body:** `current_password` (required), `new_password` (chosen-password
rules). Admins reset **other** people via `POST /api/users/{id}/password`,
never this route on themselves.

### `POST /api/auth/invitations/validate`

**Purpose:** Check an invite token before the password form. No Bearer.

**Body:** `{ "token" }`. **Returns:** `{ "email", "expires_at" }`.

### `POST /api/auth/invitations/accept`

**Purpose:** Set the first password and sign in. No Bearer.

**Body:** `{ "token", "password" }` (`password` = chosen-password rules).
**Returns:** `Auth_Response`.

---

## Auth sessions

These are **login sessions**, not class timetable sessions (`/api/sessions/{id}`).

### `GET /api/auth/sessions`

**Purpose:** List the caller’s live logins (devices). Each row: `id`,
`issued_at`, `last_seen_at`, optional `ip_address` / `user_agent`,
`is_current`.

**Who:** Any signed-in staff (own sessions only).

### `DELETE /api/auth/sessions/{session_id}`

**Purpose:** Revoke one of **your** sessions. **204**. Cannot be used as an
admin “kick user” tool.

---

## Staff users

**Who (list/get):** active Super admin (everyone); active Branch admin
(accounts in the **workspace** branch, roles Branch admin and below — never
Super admin). HOD / Registrar / Teacher → **403**.

**Who (create/invite/disable/enable/password/Moodle):** **assigned** Super
admin (global); **assigned** Branch admin in workspace, targets HOD /
Registrar / Teacher only. Nobody may disable or password-reset **themselves**.
The last remaining active Super admin cannot be disabled.

**Query on list:** optional `assigned_role`, `status`, `search` (name/email).

### `GET /api/users`

**Purpose:** Staff directory the caller is allowed to see.

### `POST /api/users`

**Purpose:** Create a staff account (invitation or generated password).

**Body (required):** `email`, `assigned_role`, `provisioning`, `profile`
(`first_name`, `last_name` required).

**Body (case-based):**

| Field | When |
| --- | --- |
| `caller_password` | Creating a Super admin |
| `scopes` | Super admin target: exactly one `{ "scope_type": "global" }` (`scope_id` omitted/null). Branch admin target: zero or more `{ "scope_type": "branch", "scope_id" }`. HOD / Registrar / Teacher: **one or more** branch scopes. Empty HOD/Registrar/Teacher scopes → **400**. Branch-admin **caller**: every branch id must be in their assignment, and create must **include the workspace branch**. |
| `departments` | Only when target is HOD (list of department UUIDs, may be empty). Non-empty on a non-HOD → **400**. Super admin caller only. Each id must be an **active** department. |
| `custom_fields` | Optional object; required keys per active definitions when creating. |

**Returns:** user detail plus **one of** `invitation_url` or
`generated_password` (the other key omitted).

### `GET /api/users/{user_id}`

**Purpose:** One staff account (same visibility as list). Includes
`custom_fields` and, for HOD, `departments`.

### `PATCH /api/users/{user_id}`

**Purpose:** Update email, profile, scopes, custom fields, and (Super admin
only, never self) `assigned_role`.

| Field | Notes |
| --- | --- |
| `profile` | If sent, send a full `Profile_Write` (`first_name` / `last_name` required). |
| `scopes` | If sent, replace-all (same rules as create). If **omitted**, existing grants stay — except on assigned-role change (below). |
| `departments` | HOD only; omit to leave; replace-all when sent. |
| `caller_password` | See [caller_password](#caller_password-step-up). |
| Assigned-role change | Super admin only. Changing **to** Super admin replaces scopes with one `global` (if you send `scopes`, it must be that). Changing **from** Super admin **requires** `scopes` on the same PATCH. Changing **off** HOD clears departments; do not send a non-empty `departments` list. Successful role change signs the target out of all sessions. |

`canceled` accounts may be patched. Changing email does not rewrite an
existing invite; resend uses the current email.

### `POST /api/users/{user_id}/invite`

**Purpose:** Send or resend an invitation (status `invited` or `canceled`).
**Returns:** `{ "invitation_url" }` once.

### `POST /api/users/{user_id}/cancel-invitation`

**Purpose:** Withdraw an unused invite (`invited` → `canceled`).

### `POST /api/users/{user_id}/password`

**Purpose:** Admin generates a new EMS password for **another** user. Empty
body except optional `caller_password`. **Returns:** `{ "generated_password" }`
once. Target is signed out of all sessions.

| Target status | Effect |
| --- | --- |
| `active` | New password; sessions revoked. |
| `disabled` | New hash only; stays disabled (enable separately). |
| `canceled` | Becomes `active` (manual-create equivalent). |
| `invited` | **400** — use accept or cancel, not this. |

### `POST /api/users/{user_id}/disable` · `.../enable`

**Purpose:** Lifecycle. Enable does **not** invent a password. `canceled`
people are activated with the password endpoint, not enable.

### `POST /api/users/{user_id}/moodle`

**Purpose:** Create or link a Moodle account for this staff user. See
[Moodle bind XOR](#moodle-bind-xor). **Returns:** user detail; on create,
`generated_moodle_password` once.

Cannot target self. `canceled` staff → **400**.

### `POST /api/users/{user_id}/moodle/password`

**Purpose:** New random Moodle password for a **bound** staff user. Empty
body. Unbound → **400**. Same who/self rules as Moodle create.

---

## Branches

**Write / disable / enable / get any status:** active Super admin.

**Picker list:** active Branch admin or Registrar — active branches in the
**assigned-role workspace ceiling** (empty array if none). Assigned Super admin
acting as BA/Registrar sees every **active** branch (same as
`POST /auth/switch-workspace`). Does not need workspace.

Other roles → **403**. Unknown or not-in-picker id → **404**.

### `GET /api/branches`

**Purpose:** Super admin: full catalog (any status), ordered by `sort_order`
then `name`. BA/Registrar: workspace picker.

### `POST /api/branches`

**Purpose:** Create an **active** branch.

**Body:** `name` required; `code` optional; `timezone` optional (default
`UTC`); `sort_order` optional (default 0).

### `GET /api/branches/{branch_id}`

**Purpose:** One branch. Super admin: any status. BA: assigned and **active**
only.

### `PATCH /api/branches/{branch_id}`

**Purpose:** `name`, `code`, `timezone`, `sort_order`. Not status (use
disable/enable).

### `POST /api/branches/{branch_id}/disable`

**Purpose:** `active` → `disabled`. Sessions that used this workspace are
cleared. Staff with grants on it keep the grant (`is_live` becomes false).

### `POST /api/branches/{branch_id}/enable`

**Purpose:** `disabled` → `active`.

---

## Departments

**Who:** active Super admin only (including GET). HOD does **not** list the
catalog here; they see assignments on `/auth/me`.

Same create/patch/disable/enable pattern as branches (`name`, optional `code`,
`sort_order`). No timezone.

HOD assignment is **not** these routes — it is `departments` on
`POST`/`PATCH /api/users`.

---

## Moodle site (Super admin)

**Purpose:** Store the one Moodle connection. The browser **never** receives
the service token. **Who:** active Super admin only (switched-down SA → 403).

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/moodle/site` | Status. **200** even when nothing is configured (`configured` / `has_token` false). Never 404 for empty. |
| PUT | `/api/moodle/site` | Create or replace. **Both** `site_url` and `ws_token` required. Does not call Moodle. |
| PATCH | `/api/moodle/site` | Change URL and/or token. No row yet → **400** (PUT first). Empty string fields → **400**. Does not call Moodle. |
| POST | `/api/moodle/site/disconnect` | Clear the token; keep the URL. Already disconnected → **400**. |
| POST | `/api/moodle/site/test` | Probe the configured site. **200** even if Moodle is down; read `reachable` and `error`. |

GET/PUT/PATCH **response** (never `ws_token`): `configured`, `has_token`,
`site_url`, `sitename`, `release`, `version_expected` (true when last
successful probe looked like 4.5.x), `last_checked_at`, `reachable`,
`last_error`, `warnings`.

Treat `ws_token` in the Super-admin form like a password (write-only).

---

## Moodle pickers (read-only)

### `GET /api/moodle/courses` · `POST /api/moodle/courses/refresh`

**Purpose:** Super-admin UI to pick an existing Moodle course to **link** into
EMS. Does not create Moodle courses.

**Who:** active Super admin.

**Query:** `category_id` (Moodle category int), `q` (substring on name/shortname/idnumber),
`unmapped` (default **true**: hide courses already linked), `refresh` on GET
(default false). POST refresh forces a pull then returns the same body.

**Returns:** `{ catalog_refreshed_at, warnings, error?, courses[] }`. Each
course: Moodle `id`, `shortname`, `idnumber`, `fullname`, `displayname`,
category fields, `visible`. If Moodle is down and a cache exists, you still
get courses plus `warnings`.

### `GET /api/moodle/categories`

**Purpose:** Category filter for that picker. Query `refresh` (bool). Same who.

### `GET /api/moodle/users`

**Purpose:** Search Moodle people to **link** (staff or students).

**Who:** Super admin, Branch admin, Registrar. **Query `q` required**, trimmed,
**minimum 2 characters** (**400** if shorter). Result cap 50.

Workspace not required for search.

### `GET /api/moodle/groups`

**Purpose:** Search Moodle groups **in one EMS course** to link to a class.

**Who:** Super admin, Branch admin, Registrar (class writers).

**Query:** `course_id` (**EMS course UUID**, required), `q` (min 2 chars).
Workspace not required for search. Already-linked groups are omitted.

---

## EMS courses

Overlay rows: EMS metadata + a snapshot of an **existing** Moodle course. EMS
does not create or edit Moodle course content.

**Read:** all five roles (Teacher sees courses of assigned classes; HOD sees
assigned departments). Super admin sees disabled overlays; others generally
see **active** only (Teacher may see a disabled overlay if it is on an
assigned class).

**Write / disable / enable:** active Super admin only.

**Query on list:** optional `department_id`; `refresh=true` to pull Moodle
snapshots for the visible list.

### `GET /api/courses`

**Purpose:** Catalogue for class setup and department views.

### `POST /api/courses/refresh`

**Purpose:** Force snapshots for every overlay the caller would list.

### `POST /api/courses`

**Purpose:** Link one Moodle course. Send **exactly one** of:

- `moodle_course_id` (int, not `1`)
- `shortname`
- `idnumber`

plus required `department_id` (must be an **active** department). Optional
`sort_order`. Duplicate bind → **409**.

### `GET /api/courses/{course_id}`

**Purpose:** One overlay. Query `refresh=true` optional. Out of scope → **404**.

### `PATCH /api/courses/{course_id}`

**Purpose:** EMS metadata only: `department_id`, `sort_order`, optional
`moodle_attendance_id` (Moodle attendance activity instance, or `null` to
clear). Cannot change the Moodle bind or names (those come from Moodle).

### `POST /api/courses/{course_id}/disable` · `.../enable`

**Purpose:** EMS overlay only. Moodle is unchanged.

### `POST /api/courses/{course_id}/refresh`

**Purpose:** Force snapshot for this row.

Response includes Moodle snapshot fields (`fullname`, `shortname`, …),
`moodle_refreshed_at`, optional `moodle_refresh_error`, `warnings` (e.g. stale
snapshot after a failed pull).

---

## Classes

**Read:** SA (all statuses); BA/Registrar (active, **workspace** branch);
HOD (active, assigned departments); Teacher (assigned classes, including
disabled).

**Write / Moodle group / generate sessions / enrol / withdraw:** SA (any live
branch); BA/Registrar (**workspace** must match `branch_id`). HOD/Teacher →
**403** on writes.

**Query on list:** optional `course_id`; `branch_id` (Super admin filter;
BA/Registrar are already locked to workspace — omit it); `department_id`
(filter; HOD/Teacher get an empty list if that department is not theirs).

### `GET /api/classes` · `GET /api/classes/{class_id}`

**Purpose:** Offerings (term, teachers, capacity, optional weekly pattern).
Responses include `active_enrolment_count` (active roster size), same meaning
as on the teacher workspace class item.

### `POST /api/classes`

**Required:** `name`, `course_id` (active overlay), `branch_id` (active
branch; BA/Registrar = workspace), `capacity` (≥ 1), `start_at`, `end_at`
(end after start).

**Optional:** `teacher_ids` (staff user UUIDs with teacher role), `sort_order`,
schedule triple + `default_room_id` (active room on the **same** branch).

Schedule: all of `schedule_days_of_week`, `schedule_start_time`,
`schedule_end_time` together, or none. Days: integers **0–6**, Monday=0,
no duplicates.

### `PATCH /api/classes/{class_id}`

**Purpose:** `name`, `capacity`, `start_at`, `end_at`, `teacher_ids`,
`sort_order`, schedule fields, `default_room_id`. **Cannot** change
`course_id` or `branch_id`. Status via disable/enable.

Name changes are **not** pushed to Moodle until you call sync.

### `POST /api/classes/{class_id}/disable` · `.../enable`

Disable cancels **future scheduled** class sessions and, if a Moodle group
was bound, removes that group bind (you re-create after enable with
`POST .../moodle`). Enable does **not** auto-recreate the Moodle group.

### `POST /api/classes/{class_id}/moodle`

**Purpose:** Create or link the Moodle **group** for this class (needed before
enrolment). Body: [Moodle bind XOR](#moodle-bind-xor) with `moodle_group_id`.

### `POST /api/classes/{class_id}/moodle/sync`

**Purpose:** Push current EMS class name (and related group fields) to the
already-bound Moodle group. Empty body. Unbound → **400**.

---

## Enrolment

Student must be **active**, Moodle-bound, same operational rules as class
write. Class must have a Moodle group. Course/department/branch must be live.
Full class (active count ≥ capacity) → **400**. Already active enrolment →
**409**; withdrawn enrolment is reactivated.

### `POST /api/classes/{class_id}/enrolments`

**Body:** `{ "student_id" }`.

### `POST /api/classes/{class_id}/enrolments/{student_id}/withdraw`

**Purpose:** Soft withdraw (no body). Active row required or **404**.

### `GET /api/classes/{class_id}/enrolments`

**Purpose:** Roster. HOD/Teacher use this instead of `GET /students`.

**Query `status`:** `active` (default), `withdrawn`, or `all`. Only Super
admin may request `withdrawn` / `all`; others always see active.

Each row includes embedded `student` (`first_name`, `last_name`, `email`,
`branch_id`, optional `moodle_user_id`).

### `GET /api/students/{student_id}/enrolments`

**Purpose:** Classes this student is (or was) on. Same `status` query default
`active`. **Who:** student readers plus HOD/Teacher when they can see that
student via roster scope.

---

## Rooms

**Write:** SA / BA / Registrar (BA/Reg: workspace = `branch_id`).

**Read:** those plus HOD/Teacher (rooms on branches they can see via
classes/departments).

### `GET /api/rooms`

**Query:** optional `branch_id` (Super admin catalogue filter). BA/Registrar
are already scoped to workspace; HOD/Teacher are scoped to the branches of
classes they can see.

### `POST /api/rooms`

**Required:** `branch_id`, `name`. Optional `capacity` (≥ 1), `sort_order`.

### `GET /api/rooms/{room_id}` · `PATCH` · `disable` · `enable`

PATCH: `name`, `capacity`, `sort_order`. Not `branch_id`.

---

## Class sessions (timetable)

Not login sessions. Path prefix `/api/sessions` vs `/api/auth/sessions`.

### `GET /api/classes/{class_id}/sessions`

**Purpose:** Generated rows for one class. Same read scope as the class.

### `POST /api/classes/{class_id}/sessions/generate`

**Purpose:** Create missing slots from the weekly pattern inside the class
term. Requires a complete schedule. **Returns:** `{ "created_count", "sessions": [...] }`.
Idempotent on `(class, start time)`.

**Who:** class writers.

### `GET /api/sessions/{session_id}`

**Purpose:** One slot (`starts_at`, `ends_at`, optional room, `status`).
Path id is a **UUID** (422 if not).

### `PATCH /api/sessions/{session_id}`

**Purpose:** Move a **future** `scheduled` session (`starts_at`, `ends_at`,
`room_id`). Past or cancelled → **400**.

### `POST /api/sessions/{session_id}/cancel`

**Purpose:** Cancel a future scheduled session. Empty body.

There is no branch-wide calendar list in v1.

---

## Attendance (read-only)

Moodle is the source of truth. **No EMS write.** Teachers mark attendance in
Moodle.

**Who:** same as roster read (SA / BA / HOD / Registrar / Teacher, scoped).

Class must have a Moodle group; the course must have an attendance activity
(or `moodle_attendance_id` set on the overlay). Otherwise **400**.

### `GET /api/classes/{class_id}/attendance/sessions`

**Purpose:** Moodle attendance sessions for the class (group `0` or this
class’s group). Each item: `moodle_session_id` (Moodle **int**), `sessdate`,
`duration`, `groupid`, optional `lasttaken`, `description`, optional
`ems_session_id` when it matches an EMS slot.

### `GET /api/classes/{class_id}/attendance/sessions/{moodle_session_id}`

**Purpose:** One Moodle session plus `statuses[]` and roster `students[]`
with optional mark fields (`status_id`, acronym, description, `remarks`).
Unmarked students still appear.

`moodle_session_id` is Moodle’s integer, not an EMS UUID.

### `GET /api/sessions/{session_id}/attendance`

**Purpose:** Same detail payload, looked up from an **EMS** class session
UUID (matched to a Moodle session when times align).

---

## Learning reads (read-only)

Live Moodle grades/completion. **Who:** roster-read scope.

### `GET /api/classes/{class_id}/grades`

**Purpose:** Per-roster-student grade items and optional `course_grade`.

### `GET /api/students/{student_id}/learning`

**Purpose:** Per **active** enrolment: course/class names, optional
`course_grade`, `course_completed`, `completion_status`.

HOD/Teacher: only students they can see on a roster; they still cannot call
`GET /api/students`.

---

## Teacher workspace

### `GET /api/teacher/workspace`

**Purpose:** Teacher home: assigned classes, upcoming sessions, Moodle links.

**Who:** **active role Teacher only** (including a Super admin switched to
Teacher). Others → **403**.

**Returns:**

- `moodle_site_url` — omitted if Moodle is not configured (open in a new tab).
- `classes[]` — assigned, any class status; `active_enrolment_count`; optional
  `moodle_course_id`, `moodle_course_url`
  (`{site}/course/view.php?id={moodle_course_id}`), `moodle_group_id`.
- `upcoming_sessions[]` — `scheduled`, start from now, within 14 days, max 50.

No writes on this route.

---

## Students

**Who:** Super admin, Branch admin, Registrar (workspace for BA/Reg). HOD and
Teacher → **403** on these paths (use roster/learning instead).

SA sees all statuses; BA/Registrar see **active** on the workspace branch.

**Query:** `q` (optional, name/email contains); `branch_id` (Super admin
only; others sending it → **400**).

### `POST /api/students`

**Required:** `first_name`, `last_name`, `email`, `branch_id` (BA/Reg =
workspace).

**Optional:** `phone` (E.164), `date_of_birth` (`YYYY-MM-DD`, not future),
guardian fields (`guardian_name`, `guardian_phone` E.164,
`guardian_email`, `guardian_relationship` max 64). Guardian is **data on the
student**, not an EMS login.

Duplicate email → **409**. `moodle_user_id` is always present on responses
(`null` until bound).

### `PATCH /api/students/{student_id}`

Mutable identity/contact/branch/guardian. Not status (disable/enable).

### `POST /api/students/{student_id}/moodle` · `.../moodle/password`

Same bind/password pattern as staff. SA may act on disabled students;
BA/Registrar get **404** for disabled (same as GET).

### `POST /api/students/{student_id}/disable` · `.../enable`

Enable re-checks that the home branch is live.

---

## Leads

**Who:** same as students (SA / BA / Registrar).

**Query:** `q`, `status`, `branch_id` (SA only).

### `POST /api/leads`

**Required:** `first_name`, `last_name`, `email`, `branch_id`. Status starts
`new`.

**Optional:** `phone`, `source` (max 64), `notes` (max 2000),
`preferred_course_id` (existing EMS course).

### `PATCH /api/leads/{lead_id}`

All of those plus `status`. **Converted** leads are immutable (**400**).

### `POST /api/leads/{lead_id}/convert`

**Purpose:** Create a student from the lead. Lead must not be `converted` or
`lost`. **Returns:** `{ "lead", "student" }`. Then bind Moodle on the student.

---

## Placement tests

**Who:** same as students. EMS-only (no Moodle).

**Query:** `branch_id` (SA), `status`, `lead_id`, `student_id`.

### `POST /api/placement-tests`

**Required:** `branch_id`, `scheduled_at`, and **exactly one** of `lead_id`
or `student_id` (**422** if both or neither).

Lead must not be `converted` or `lost`. Student must be `active`. Branch must
match the subject’s home branch. Optional `room_id`: active room on that
branch.

### `PATCH /api/placement-tests/{id}`

Only while `scheduled`. `scheduled_at`, `room_id`, and/or `status` (use
`no_show` here). At least one field required. Terminal statuses
(`completed`, `cancelled`, `no_show`) are immutable.

### `POST /api/placement-tests/{id}/record-result`

**Purpose:** Complete a scheduled test. **Body:** `recommended_course_id`
(required EMS course), optional `result_score` (max 64), `result_notes`
(max 2000).

### `POST /api/placement-tests/{id}/cancel`

From `scheduled` only. Empty body.

Responses nest `subject`: `{ "subject_type": "lead"|"student", "subject_id", "first_name", "last_name", "email" }`.

---

## Custom field definitions

**Read list:** Super admin and Branch admin (needed to render staff forms).

**Create / patch / disable / enable:** Super admin only.

`field_key`, `entity_type`, and `field_type` are **immutable** after create.

### `GET /api/custom-fields`

**Query:** `entity_type` (use `user_profile`), `is_active` (bool).

### `POST /api/custom-fields`

**Required:** `entity_type` (`user_profile`), `field_key` (stable machine
key, max 100), `label`, `field_type`.

**Optional:** `is_required` (default false), `sort_order`, `help_text`,
`options_json` (for `select`: JSON array of choices for the UI, e.g.
`["full_time","part_time"]`).

Duplicate `entity_type`+`field_key` → **409**. Unknown `entity_type` → **400**.

### `PATCH /api/custom-fields/{field_id}`

`label`, `is_required`, `sort_order`, `options_json`, `help_text`.

Disable leaves historical values on users; inactive definitions should not
appear on new forms (`is_active=true` filter).

There is no `GET /custom-fields/{id}` in the current API (list + patch by id).

---

## Notifications

**Who:** any signed-in staff; **own** rows only.

Kinds you may see: `moodle` category with `moodle_unreachable` or
`moodle_version_warning` (Super admins, produced when site test runs). Treat
`kind` / `category` as display keys; `payload` is a small JSON object.

### `GET /api/notifications`

**Query:** `unread` (bool, omit = all), `limit` (1–100, default 50). Newest
first.

### `GET /api/notifications/unread-count`

**Returns:** `{ "unread_count": n }` (badge).

### `POST /api/notifications/{notification_id}/read`

**Purpose:** Mark one as read (must own it).

### `POST /api/notifications/read-all`

**Returns:** `{ "marked_read": n }`.

---

## Audit logs

**Purpose:** Operational history browser (not a product-critical v1 screen).

**Who:** Super admin: every stream. Branch admin / Registrar: **branch**
streams only, and workspace required. HOD / Teacher → **403**.

### `GET /api/audit/events`

**Query (all optional):**

| Param | Notes |
| --- | --- |
| `stream` | One of: `auth`, `branch`, `department`, `course`, `custom_field`, `moodle_site`, `student`, `lead`, `placement_test`, `class`, `enrolment`, `room`, `session`. Invalid → **400**. Global streams (`auth`, catalogs, `moodle_site`) are Super admin only. |
| `branch_id` | Filter; BA/Reg stay inside workspace. |
| `actor_user_id`, `entity_id` | UUIDs. |
| `event_type` | Exact event name string if you already know it from a row. |
| `from` / `to` | Timestamps (`from` / `to` query names). |
| `limit` | 1–100, default 50. No offset in v1. |

Newest first. Rows may include `payload` (object), optional `ip_address` /
`user_agent` on auth events. Do not treat payload as a stable UI schema
beyond display.

---

## System health

### `GET /api/system/health`

**Purpose:** Operator snapshot (EMS + Moodle integration). **Who:** active
Super admin.

**Returns:** `status` (`healthy` | `degraded` | `unhealthy`), `checked_at`,
`components` with `api`, `database`, `schema_check`, `migration`, `moodle`.
Each component has `status` (`ok` | `warning` | `error` | `not_configured`)
and optional `detail`. Moodle component may include `configured`, `has_token`,
`reachable`, `sitename`, `release`, `version_expected`, `warnings` — never a
token.

Use this for an admin “status” page, not for the public liveness probe.

---

## OpenAPI models vs this file

Swagger is authoritative for property types, required flags **on the schema**,
and example payloads. This file is authoritative for:

- What the endpoint is **for**
- **Who** may call it (active vs assigned role, workspace)
- **XOR** and case-based required fields
- Phone / nationality / weekday / IANA timezone / chosen-password rules
- Call **order** (workspace, Moodle bind, enrol)
- One-time secrets and write-only `ws_token`

If the two disagree on a type, trust live `/api/docs` and file a backend bug.
If they disagree on product rules, this file plus Enes.
