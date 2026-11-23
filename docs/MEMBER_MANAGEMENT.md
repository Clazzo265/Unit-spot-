# UnitSpot member management — implementation notes

## Current supported workflows

UnitSpot uses the existing group membership model rather than a second invitation collection.

1. **Administrator adds a roster record** in Group Management → Add Member. This is a record for group administration and contribution allocation. It does not create a Firebase Authentication account or grant the person access to private group data.
2. **Administrator shares the group invite link/code.** The person creates or signs in to their own verified account and joins through the existing invite flow.
3. The group can use `code_auto` for immediate joining or `admin_approval` for a pending join request.
4. An authorised group manager reviews pending requests. Approval creates the authenticated member record and updates the group membership list.
5. Elevated roles are managed only after the account is linked. A roster-only record must never receive admin or treasurer privileges.

## Changes in this update

- Corrected the Add Member modal's misleading claim that entering an email immediately gives someone account access.
- Explicitly explains that a roster record is not an account and does not grant private workspace access.
- Removed admin/treasurer role selection from roster-only creation. New manual entries are always `member`.
- Added a defensive validation in `addMemberRecord` that rejects attempts to create roster-only records with elevated roles.
- Kept the existing group invite code, approval policy, join request, membership approval, role management and Firestore rules architecture intact.

## Security invariants

- A roster record is not proof of identity and is not an authenticated membership.
- Only verified signed-in users can join through the invite workflow.
- Group membership and group-scoped data access are governed by Firestore rules, not by UI visibility.
- Do not add a client-side email-to-UID lookup or allow admins to create Firebase Auth identities from a roster form.
- Do not assign `admin` or `treasurer` to a roster-only record.
- Elevated role changes must apply to an already-linked authenticated member and be checked by Firestore rules.
- Continue testing with a group admin, an invited/verified member, and an unrelated account.

## Deliberate limitation

The current invite code is group-scoped, not a unique email-bound invitation. It can be shared through WhatsApp/SMS or copied as a link. Email-bound single-use invitations with automatic email delivery would require a separate trusted backend flow (for example, an authenticated callable function plus a mail provider) and corresponding rules. Do not simulate that security guarantee in the browser.
