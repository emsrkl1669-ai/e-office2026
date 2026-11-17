# Security Specification — ระบบ e-Office มูลนิธิร่วมกุศลสมุทรปราการ

## 1. Data Invariants
1. **Authentication & Email Verification**: All Firestore reads and writes require an authenticated Firebase user with `request.auth.token.email_verified == true`.
2. **Admin Bootstrap & Trusted Role Lookup**: `emsrkl1669@gmail.com` (verified) is bootstrapped as `Admin`. All other role checks (`Admin`, `Manager`, `Supervisor`, `Registrar`) use `get()`/`exists()` against `/roles/{uid}` (never client claims).
3. **Self-Assigned Role Prevention**: Users cannot assign themselves elevated roles (`Admin`, `Manager`, `Supervisor`, `Registrar`) on `roles/{uid}` or `staff_directory/{staffId}`; only `Admin` can create/modify role assignments.
4. **PII Isolation**: Staff emails, phone numbers, and PIN hashes live in `/staff_private/{staffId}` and are strictly readable only by the owning user (`existing().authUid == request.auth.uid`) or an `Admin`.
5. **Immutable Ownership & Timestamps**: `createdBy`, `createdAt`, and `orgId` are immutable after creation; `createdAt == request.time` on create and `updatedAt == request.time` on update.
6. **Terminal State Locking**: Finalized documents (`leave_requests` with `status in ['approved', 'rejected']`, `medical_loans`/`kitchen_loans` with `status == 'returned'`, `repairs` with `status in ['completed', 'cancelled']`, `pavilion_requests` with `status in ['approved', 'rejected']`) cannot be altered by non-Admin users.
7. **Path & Size Hardening**: Every document ID matches `^[a-zA-Z0-9_\-]+$` (`<= 128` chars), and every string and bounded array has explicit `.size()` constraints.
8. **Secure List Queries**: Every `allow list` rule evaluates `resource.data` directly (zero `get()`/`exists()` inside `allow list`, zero blanket `if isSignedIn()`).

## 2. "Dirty Dozen" Adversarial Payloads (Must Return `PERMISSION_DENIED`)
1. **Unauthenticated Read/Write**: Unauthenticated client attempts `getDoc(/incoming_docs/doc1)`.
2. **Unverified Email Spoofing**: User with `email: 'emsrkl1669@gmail.com'` and `email_verified: false` attempts Admin write on `/staff_directory/staff_1`.
3. **Self-Role Escalation**: Standard Staff user attempts `setDoc(/roles/uid_staff, { role: 'Admin' })`.
4. **PII Blanket Read**: Non-Admin Staff user attempts `getDoc(/staff_private/staff_2)` belonging to another employee.
5. **PII Collection Scrape**: Non-Admin Staff user attempts `getDocs(collection(db, 'staff_private'))` without `where('authUid', '==', uid)`.
6. **Ghost Field Shadow Write**: Signed-in user creates `/incoming_docs/doc1` with extra undeclared field `isBypassed: true`.
7. **ID Poisoning**: Client writes `/vehicles/${'A'.repeat(300)}` or `/vehicles/bad$id`.
8. **CreatedBy Spoofing**: User A creates `/leave_requests/req1` with `createdBy: 'uid_user_b'`.
9. **Client Timestamp Forgery**: User creates `/outgoing_docs/out1` with `createdAt` set to a past client timestamp instead of `request.time`.
10. **Terminal State Tampering**: Non-Admin attempts to update `/leave_requests/req1` where `status == 'approved'` back to `pending_supervisor`.
11. **Unauthorized Registry Deletion**: Non-Admin/Non-Registrar Staff attempts `deleteDoc(/incoming_docs/doc1)`.
12. **Unbounded Array / Payload Exhaustion**: Client submits `items` array of length 100 or a 2MB `subject` string in `/medical_loans/loan1`.
