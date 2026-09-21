# Policy decisions — #23

Status: per-event management mode and schedule rules below are accepted; other proposals remain pending except where explicitly recorded. No other behavior change is authorized by this document alone. Current code is evidence of inconsistency, not a substitute for a product decision.

## Capability matrix proposed for decision

Accepted: each event has an owner-controlled management setting. New events default to owner-only. The owner may opt in to shared management, allowing every global host to manage playback, queue and registration approvals. The table below describes owner-only mode; in shared mode the other-global-host column becomes Yes for those three capabilities. Deletion, ownership transfer, catalog editing and Spotify import rights were not included in this opt-in decision. Existing-event backfill/default behavior still requires a rollout decision; do not silently revoke existing global-host access during migration.

| Capability | Ordinary musician | Event owner | Global host of another event |
|---|---|---|---|
| View public event/song/approved-performer data | Yes | Yes | Yes |
| Suggest a song; apply for a part | Yes, on eligible events/songs | Yes | Yes |
| Withdraw own application | Yes, subject to performance lifecycle | Yes | Yes |
| Create an event | No | Only if also a global host | Yes |
| Control playback, manage queue, approve applicants (accepted) | No | Yes | No in owner-only mode; Yes in shared mode |
| Edit/delete event (proposal; not decided by management-mode opt-in) | No | Yes | No |
| Import songs into an existing event | No | Yes | No |
| Assign owner to an ownerless legacy event | No self-claim | No self-claim | Explicit maintenance assignment, not implicit access |

Creation should assign the authenticated creator as owner, rather than accept arbitrary client ownership. Spotify-created events should follow the same create-event capability. These are proposals requiring explicit decisions; owner status and global host eligibility are distinct.

Current evidence: `src/auth/guards/role.guard.ts` treats every `isHost` musician as a host and has no real admin role; `src/jam/jam.controller.ts` protects creation/playback globally; `JamService.update` accepts owner or global host, while removal checks ownership differently; `SpotifyService.importPlaylist` requires target ownership but its controller does not require host status for new events.

## Schedule lifecycle and ordering

Accepted by the user:

- Generic edits cannot move songs between jams or change playback status; playback controls own those transitions.
- Current/completed songs cannot be deleted.
- Removing an unplayed song with registrations cancels the slot and preserves its registrations/history.
- Queue positions remain unique; explicit reorder renumbers them. Partial reorder moves supplied songs to the front in their requested order, then retains omitted songs in their prior relative order.
- Removing an unplayed slot without registrations deletes it. Registered slots are canceled and preserve history.
- PATCH may transition unplayed slots among SUGGESTED, SCHEDULED and CANCELED; IN_PROGRESS/COMPLETED belong to playback controls. Song replacement is refused once registrations or playback history exist.

These decisions unblock the core behavior definition for #7/#10. The following elaborations remain proposals unless they directly restate those accepted rules:

- Generic schedule PATCH cannot move a song to another event or set playback-owned statuses. Once referenced by registrations, replacing its music should also be refused unless an explicit migration flow is designed.
- Playback controls own IN_PROGRESS/COMPLETED transitions. Queue approval/rejection should use explicitly allowed SUGGESTED/SCHEDULED/CANCELED transitions, not arbitrary enum assignment.
- Removal of an unplayed slot without registrations deletes it; registered slots are canceled. Existing history must remain preserved.
- Queue positions are positive and unique per event. Allocation must work after gaps and under concurrent appends. Reorder explicitly assigns contiguous positions; whether cancellation compacts positions immediately remains a separate decision.
- Do not create new participation on canceled/completed songs or finished/deleted events; exact event-status eligibility requires agreement.

Historical audit evidence: `UpdateScheduleDto` inherited jamId, musicId, order and status; `EscalaService.update` forwarded it directly; create allocated count+1; generic remove deleted the row. The schedule/queue repair now guards those fields and serializes allocation and mutation. The accepted partial-reorder contract now moves supplied songs to the front and renumbers the whole queue; this deliberately replaces arbitrary sparse order assignment.

## Registration identity and lifecycle

Accepted: one application per musician, scheduled song slot and instrument; multiple instrument applications and multiple approved parts on one slot are allowed. Repeated song occurrences remain distinct slots, and requested instrument counts are guidance rather than approval limits.

Applications are always created for the authenticated musician. New applications are refused for inactive, finished or deleted events and for canceled, in-progress or completed slots. Withdrawal preserves the registration as `WITHDRAWN`; it cannot be resubmitted as a new duplicate or changed afterward. Event managers use the explicit unplayed-slot transition matrix: pending applications may be approved or rejected, approved applications may be rejected, and rejected applications may be reopened to pending. Instrument changes stop after approval or withdrawal, and registration mutation stops when the slot starts. Event management mode governs manager actions.

## Shared catalog and privacy

Accepted: phone and contact are self-only profile information. `/auth/me` retains them for the authenticated musician; `/musicos` and `/musicos/:id` omit them for every caller, including hosts. Public performer projections continue to expose only the limited performer fields needed by the live dashboard.

Accepted: only hosts curate shared Music records. Event links and arrangement notes belong only to the event owner; the shared-host playback/queue/approval opt-in does not extend catalog authority. The public catalog uses an explicit projection and omits host contact, owner identity, QR data and import identity fields.

## Identity linking and logout

Accepted: the provider subject is the immutable account identity. A login first resolves the local musician by `supabaseUserId`; a different provider subject that presents an existing email is rejected with a generic authentication error and never rebinds that musician. The same subject remains valid when the provider email changes. First-login uniqueness races re-read the subject and succeed only when the concurrent request created that same identity. Linking two existing accounts requires a separate, explicit verified recovery/linking flow.

Accepted: the client/provider owns session revocation. `POST /auth/logout` evicts the presented token from this API instance's validation cache and explicitly returns `providerSignOutRequired: true`; it does not claim to revoke the Supabase token. Clients must complete provider sign-out. A subsequent request therefore returns to authoritative provider validation rather than treating cache eviction as revocation.

## Implementation gates

The accepted capability, lifecycle, privacy, identity and logout decisions are implemented locally. Publication, hosted verification and ticket closure remain release work.
