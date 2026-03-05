/// <reference path="../pb_data/types.d.ts" />

// =====================================================
// TESTIGO — Admin Approval Gate
// Blocks OTP sending for unapproved users
// =====================================================

// Intercept OTP email sending — silently block if user not approved
onMailerRecordOTPSend((e) => {
    const record = e.record;
    const approved = record.get("approved");

    if (!approved) {
        console.log(`[TESTIGO] OTP blocked for unapproved user: ${record.get("email")}`);
        // Don't call e.next() — silently prevents the email from being sent
        // The API response still says "OTP sent" so it doesn't reveal user status
        return;
    }

    e.next();
}, "users");
