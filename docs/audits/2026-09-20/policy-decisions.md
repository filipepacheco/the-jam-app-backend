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
- Queue positions remain unique; explicit reorder renumbers them.

These decisions unblock the core behavior definition for #7/#10. The following elaborations remain proposals unless they directly restate those accepted rules:

- Generic schedule PATCH cannot move a song to another event or set playback-owned statuses. Once referenced by registrations, replacing its music should also be refused unless an explicit migration flow is designed.
- Playback controls own IN_PROGRESS/COMPLETED transitions. Queue approval/rejection should use explicitly allowed SUGGESTED/SCHEDULED/CANCELED transitions, not arbitrary enum assignment.
- The accepted cancellation rule preserves the slot and registrations; handling removal of an unplayed slot without registrations remains to be specified.
- Queue positions are positive and unique per event. Allocation must work after gaps and under concurrent appends. Reorder explicitly assigns contiguous positions; whether cancellation compacts positions immediately remains a separate decision.
- Do not create new participation on canceled/completed songs or finished/deleted events; exact event-status eligibility requires agreement.

Current evidence: `UpdateScheduleDto` inherits jamId, musicId, order and status; `EscalaService.update` forwards it directly; create allocates count+1; generic remove deletes the row. Partial reorders exist, and their contract must remain compatible or be deliberately changed. Tickets #7/#10 must be refined before implementation.

## Registration identity and instrument-count guidance accepted

Accepted by the user: one application per musician, scheduled song slot and instrument; multiple instrument applications on a slot are allowed. Repeated occurrences of a song are distinct schedule slots. Instrument counts are guidance, not hard approval limits: a host may approve more musicians than the stated count. Whether the same musician may hold multiple approved parts concurrently remains a separate decision. Proposal, not yet accepted: require a supported canonical instrument for new applications and define a cleanup path for existing null/unknown values before adding constraints.

Pending decisions:

1. Can one musician hold multiple approved instrument parts on the same song?
2. Is withdrawal from a currently performing song allowed? Can rejected applications be resubmitted or must hosts reopen them?
3. Beyond the accepted unplayed-song cancellation rule, which transitions preserve historical participation, and which can remove records?

Current evidence: `InscricaoService.create` checks musician+jam+schedule+normalized instrument; the schema unique key instead uses musician+jam+nullable jamMusicId. Instrument normalization accepts unknown strings and null. Update can change status/instrument without equivalent duplicate checks. Decide semantics before #11 migrates existing rows.

## Shared catalog and privacy — still undecided

Recommendation for discussion: musicians submit suggestions; event owners approve them for their event; global catalog editing/approval needs a separate defined capability. Editing a shared Music row affects multiple events, so event ownership alone should not silently confer global editing rights.

Public performer projections already expose only musician id, name and instrument. Public musician profile/list projections still include phone/contact (`MUSICIAN_LIST_SELECT` in `src/musico/musico.service.ts`). Decide whether these fields are public opt-in, authenticated-only, or owner-only. Do not remove them without recording the intended contract and frontend impact.

## Identity linking and logout — still undecided

Current evidence: `SupabaseJwtStrategy.findOrCreateMusician` can rebind an existing email match to a new provider subject; the helper receives no verified-email flag. Provider verification and account-linking guarantees must be inspected before deciding a safe linking flow. This report makes no assertion about the deployed provider settings.

Recommendation for discussion: use provider subject as the stable identity; require an explicit verified account-linking process rather than reassign a subject from email equality alone. Existing account reconciliation requires a migration/recovery design.

`AuthController.logout` returns an acknowledgement; token cache eviction does not implement provider-wide revocation. Decide whether logout means current device, current token, or all sessions, and whether frontend/provider or backend owns the action. Cache expiry now respects token expiration, but revocation may remain delayed within that bounded lifetime.

## Implementation gates

Record each answer with its scope, then refine #7/#10/#11 and any additional authorization/privacy work before changing behavior. Do not mark all of #23 resolved after answering only ownership and schedule questions. Schema inventory can proceed while these product decisions remain pending.
