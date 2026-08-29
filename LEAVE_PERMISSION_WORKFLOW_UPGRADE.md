# ELNUBY HR — Leave & Permission Workflow Upgrade

Implemented:

- Employee leave balances surfaced as dedicated cards.
- Dynamic leave type loading from the backend instead of hard-coded form values.
- Client-side duration / balance preview before submission.
- Request statistics: total, pending, approved, rejected.
- Search and status/type filtering.
- Request details modal with approval timeline and manager/HR comments.
- Employee/HR cancellation of pending requests with a mandatory reason.
- Permission types changed from free-text to controlled categories.
- Permission duration preview and validation.
- Rejection requires a comment at the backend for audit quality.
- Leave/permission decisions use status predicates to avoid double decisions under concurrency.
- Added cancellation metadata and status constraints to Supabase.
- Added indexes for workflow queues.
- Leave types are now readable by all authorized HR roles.

Production DB migration applied to the configured Supabase project:
`leave_permission_workflow_upgrade`

Verification:
- Contract tests: PASS
- Backend smoke: PASS
- Security: PASS
- Operational regression: PASS
