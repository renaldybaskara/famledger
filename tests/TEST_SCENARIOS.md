# Test Scenarios — Saku (FinTracker)

Generated: 2026-06-13

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ PASS | Test ran and passed |
| ❌ FAIL | Test ran and failed |
| ⏳ PENDING | Test written, environment not yet set up to run |
| 🔲 PLANNED | Test not yet written |

---

## 1. Backend — Go Unit Tests

Run: `cd apps/api-go && go test ./...`

### 1.1 Email Parser (`internal/infrastructure/emailparser`)

File: `apps/api-go/internal/infrastructure/emailparser/parser_test.go`

| # | Test Name | Scenario | Result |
|---|-----------|----------|--------|
| 1 | `TestParseAmount/Indonesian_thousands_dot` | `"1.500.000"` → 1,500,000 | ✅ PASS |
| 2 | `TestParseAmount/Indonesian_decimal_comma` | `"1.500.000,50"` → 1,500,000.50 | ✅ PASS |
| 3 | `TestParseAmount/US_comma_thousands_multi` | `"1,500,000"` → 1,500,000 | ✅ PASS |
| 4 | `TestParseAmount/Single_dot_thousands_3-digits` | `"72.000"` → 72,000 | ✅ PASS |
| 5 | `TestParseAmount/Single_dot_decimal` | `"1.5"` → 1.5 | ✅ PASS |
| 6 | `TestParseAmount/Single_comma_3-from-end` | `"72,000"` → 72,000 | ✅ PASS |
| 7 | `TestParseAmount/Single_comma_decimal` | `"1,50"` → 1.50 | ✅ PASS |
| 8 | `TestParseAmount/Rp_prefix_stripped` | `"Rp1.500.000"` → 1,500,000 | ✅ PASS |
| 9 | `TestParseAmount/Rp_with_space` | `"Rp 50.000"` → 50,000 | ✅ PASS |
| 10 | `TestParseAmount/IDR_prefix` | `"IDR 100000"` → 100,000 | ✅ PASS |
| 11 | `TestParseAmount/Plain_integer` | `"50000"` → 50,000 | ✅ PASS |
| 12 | `TestParseAmount/Zero` | `"0"` → 0 | ✅ PASS |
| 13 | `TestParseAmount/Empty_string` | `""` → ok=false | ✅ PASS |
| 14 | `TestParseAmount/Non-numeric` | `"abc"` → ok=false | ✅ PASS |
| 15 | `TestParseAmount/Large_amount` | `"10.000.000"` → 10,000,000 | ✅ PASS |
| 16 | `TestParseAmount/Decimal_comma_only` | `"99,99"` → 99.99 | ✅ PASS |
| 17 | `TestStripHTML/<b>Hello</b>` | HTML tag stripped → `"Hello"` | ✅ PASS |
| 18 | `TestStripHTML/<p>Rp&nbsp;50.000</p>` | `&nbsp;` decoded → `"Rp 50.000"` | ✅ PASS |
| 19 | `TestStripHTML/A_&amp;_B` | `&amp;` decoded → `"A & B"` | ✅ PASS |
| 20 | `TestStripHTML/plain_text` | No-op on plain text | ✅ PASS |
| 21 | `TestParse_BCA_Expense` | BCA debit email → Matched, Bank=BCA, type=expense, amount=75,000 | ✅ PASS |
| 22 | `TestParse_GoPay_Expense` | GoPay payment email → Matched, Bank=GoPay, amount=50,000 | ✅ PASS |
| 23 | `TestParse_NoMatch` | Non-bank newsletter → Matched=false | ✅ PASS |
| 24 | `TestParse_HTMLFallback` | BCA HTML-only body → falls back to HTML, amount=200,000 | ✅ PASS |

**Subtotal: 24/24 PASS**

---

### 1.2 Email Classifier (`internal/usecase`)

File: `apps/api-go/internal/usecase/email_classifier_test.go`

| # | Test Name | Scenario | Result |
|---|-----------|----------|--------|
| 25 | `TestClassifyEmail/reply_prefix_skips` | Subject `"Re: ..."` → SkipAI=true, IsFinancial=false | ✅ PASS |
| 26 | `TestClassifyEmail/fwd_prefix_skips` | Subject `"Fwd: ..."` → SkipAI=true, IsFinancial=false | ✅ PASS |
| 27 | `TestClassifyEmail/unsubscribe_in_body_skips` | Body has `"unsubscribe"` → SkipAI=true | ✅ PASS |
| 28 | `TestClassifyEmail/OTP_email_skips` | Subject `"Kode Verifikasi"`, body `"kode otp"` → SkipAI=true | ✅ PASS |
| 29 | `TestClassifyEmail/do_not_reply_skips` | Body has `"do not reply"` → SkipAI=true | ✅ PASS |
| 30 | `TestClassifyEmail/debit_keyword_is_financial` | Body has `"debit"` → IsFinancial=true, SkipAI=false | ✅ PASS |
| 31 | `TestClassifyEmail/transfer_keyword_is_financial` | Body has `"transfer"` → IsFinancial=true | ✅ PASS |
| 32 | `TestClassifyEmail/Rp_amount_regex_is_financial` | Body has `"Rp150.000"` → IsFinancial=true | ✅ PASS |
| 33 | `TestClassifyEmail/top_up_is_financial` | Body has `"top up"` → IsFinancial=true | ✅ PASS |
| 34 | `TestClassifyEmail/generic_email` | Birthday email → IsFinancial=false, SkipAI=false | ✅ PASS |
| 35 | `TestClassifyEmail/empty_email` | Empty subject+body → IsFinancial=false, SkipAI=false | ✅ PASS |
| 36 | `TestClassifyEmail_SkipWinsOverFinancial` | Reply prefix + financial body → SkipAI wins | ✅ PASS |
| 37 | `TestClassifyEmail_BodyTruncatedAt400` | `"unsubscribe"` placed after char 400 → NOT skipped | ✅ PASS |

**Subtotal: 13/13 PASS**

---

### 1.3 Midtrans Payment Gateway (`internal/infrastructure/payment`)

File: `apps/api-go/internal/infrastructure/payment/midtrans_test.go`

| # | Test Name | Scenario | Result |
|---|-----------|----------|--------|
| 38 | `TestVerifyNotification_Valid` | Correct SHA512 signature → true | ✅ PASS |
| 39 | `TestVerifyNotification_WrongKey` | Signature with wrong server key → false | ✅ PASS |
| 40 | `TestVerifyNotification_TamperedAmount` | Valid sig but amount changed → false | ✅ PASS |
| 41 | `TestVerifyNotification_EmptySignature` | Empty string signature → false | ✅ PASS |
| 42 | `TestEnabled` | Non-empty serverKey → Enabled()=true; empty → false | ✅ PASS |
| 43 | `TestSnapBaseURL` | sandbox=false → production URL; true → sandbox URL | ✅ PASS |

**Subtotal: 6/6 PASS**

---

### 1.4 Subscription Use Case (`internal/usecase`)

File: `apps/api-go/internal/usecase/subscription_usecase_test.go`

| # | Test Name | Scenario | Result |
|---|-----------|----------|--------|
| 44 | `TestCreateTrial_NewUser` | New user no sub → creates trialing pro, TrialEndsAt ≈ now+14d | ✅ PASS |
| 45 | `TestCreateTrial_Idempotent` | User already has active sub → Upsert NOT called | ✅ PASS |
| 46 | `TestIsProActive/trialing_within_window` | Status=trialing, TrialEndsAt=future → true | ✅ PASS |
| 47 | `TestIsProActive/trialing_expired` | Status=trialing, TrialEndsAt=past → false | ✅ PASS |
| 48 | `TestIsProActive/active_within_period` | Status=active, PeriodEnd=future → true | ✅ PASS |
| 49 | `TestIsProActive/active_no_period_end` | Status=active, no PeriodEnd → true | ✅ PASS |
| 50 | `TestIsProActive/active_period_expired` | Status=active, PeriodEnd=past → false | ✅ PASS |
| 51 | `TestIsProActive/past_due_within_grace` | Status=past_due, GraceEndsAt=future → true | ✅ PASS |
| 52 | `TestIsProActive/past_due_grace_expired` | Status=past_due, GraceEndsAt=past → false | ✅ PASS |
| 53 | `TestIsProActive/free` | Status=free → false | ✅ PASS |
| 54 | `TestIsProActive/canceled` | Status=canceled → false | ✅ PASS |
| 55 | `TestIsProActive/nil_subscription` | No subscription record → false | ✅ PASS |
| 56 | `TestIsProActive_DisableTierLimits` | disableTierLimits=true → always true regardless of sub | ✅ PASS |
| 57 | `TestGetStatus_ExpiredTrialDowngradesImmediately` | Expired trial → GetStatus returns status=free, plan=free | ✅ PASS |
| 58 | `TestGetStatus_NoSubscription_ReturnsFree` | No DB record → GetStatus returns status=free | ✅ PASS |
| 59 | `TestCancel_ActiveSub` | Active sub → status=canceled, CanceledAt set | ✅ PASS |
| 60 | `TestCancel_NoSubscription` | nil sub → ErrSubscriptionNotFound | ✅ PASS |
| 61 | `TestHandleWebhook_InvalidSignature` | Wrong webhook sig → error "invalid webhook signature" | ✅ PASS |

**Subtotal: 18/18 PASS**

---

### Backend Summary

```
Package                                                 Tests    Result
apps/api-go/internal/infrastructure/emailparser          24     ALL PASS
apps/api-go/internal/usecase          (classifier)       13     ALL PASS
apps/api-go/internal/infrastructure/payment               6     ALL PASS
apps/api-go/internal/usecase          (subscription)     18     ALL PASS
──────────────────────────────────────────────────────────────────────
TOTAL                                                    61     61 PASS / 0 FAIL
```

Actual `go test ./...` output:
```
ok  github.com/fintrackr/api/internal/infrastructure/emailparser  2.963s
ok  github.com/fintrackr/api/internal/infrastructure/payment      2.699s
ok  github.com/fintrackr/api/internal/usecase                     2.286s
```

---

## 2. Frontend — TypeScript Unit Tests

Run: `cd apps/web && npx jest`

Requires: `jest-expo` installed (`npm install --save-dev jest-expo babel-jest`).

### 2.1 Format Utilities (`src/lib/format.ts`)

File: `apps/web/src/lib/format.test.ts`

| # | Test Name | Scenario | Result |
|---|-----------|----------|--------|
| 62 | `formatCurrency/formats_1500000_as_Rp_with_dots` | 1,500,000 → contains "1.500.000" and "Rp"/"IDR" | ⏳ PENDING |
| 63 | `formatCurrency/formats_0` | 0 → contains "0" | ⏳ PENDING |
| 64 | `formatCurrency/formats_50000` | 50,000 → contains "50.000" | ⏳ PENDING |
| 65 | `formatCurrency/no_decimal_digits_for_whole_amounts` | 100,000 → no trailing ",NN" or ".NN" | ⏳ PENDING |
| 66 | `formatCurrencyCompact/billions_→_M_suffix` | 2,000,000,000 → "Rp 2.0 M" | ⏳ PENDING |
| 67 | `formatCurrencyCompact/billions_with_fraction` | 1,500,000,000 → "Rp 1.5 M" | ⏳ PENDING |
| 68 | `formatCurrencyCompact/millions_→_jt_suffix` | 1,500,000 → "Rp 1.5 jt" | ⏳ PENDING |
| 69 | `formatCurrencyCompact/exact_million` | 1,000,000 → "Rp 1.0 jt" | ⏳ PENDING |
| 70 | `formatCurrencyCompact/thousands_→_rb_suffix` | 500,000 → "Rp 500 rb" | ⏳ PENDING |
| 71 | `formatCurrencyCompact/under_1000_falls_back_to_full_format` | 999 → contains "999" | ⏳ PENDING |
| 72 | `formatCurrencyCompact/negative_million` | -1,000,000 → "Rp -1.0 jt" | ⏳ PENDING |
| 73 | `formatDate/returns_Hari_ini_for_today` | new Date() → "Hari ini" | ⏳ PENDING |
| 74 | `formatDate/returns_Kemarin_for_yesterday` | yesterday → "Kemarin" | ⏳ PENDING |
| 75 | `formatDate/formats_past_date_with_Indonesian_month_name` | "2024-01-15" → contains "2024" + "januari" | ⏳ PENDING |
| 76 | `formatDate/accepts_string_input` | string date → no throw | ⏳ PENDING |
| 77 | `formatDate/accepts_Date_input` | Date object → no throw | ⏳ PENDING |
| 78 | `formatDateShort/returns_Hari_ini_for_today` | new Date() → "Hari ini" | ⏳ PENDING |
| 79 | `formatDateShort/returns_Kemarin_for_yesterday` | yesterday → "Kemarin" | ⏳ PENDING |
| 80 | `formatDateShort/short_format_contains_day_number` | "2024-03-20" → contains digit | ⏳ PENDING |
| 81 | `formatMonth/January_→_Jan` | "2024-01" → matches /Jan/i | ⏳ PENDING |
| 82 | `formatMonth/July_→_Jul` | "2024-07" → matches /Jul/i | ⏳ PENDING |
| 83 | `formatMonth/December_→_Des_or_Dec` | "2024-12" → matches /Des\|Dec/i | ⏳ PENDING |
| 84 | `getCurrentMonthRange/startDate_is_first_day_of_month` | startDate ends "-01" | ⏳ PENDING |
| 85 | `getCurrentMonthRange/startDate_and_endDate_same_month` | same YYYY-MM prefix | ⏳ PENDING |
| 86 | `getCurrentMonthRange/endDate_is_last_day_of_month` | endDate = computed last day | ⏳ PENDING |
| 87 | `getCurrentMonthRange/dates_are_YYYY-MM-DD_format` | both match /^\d{4}-\d{2}-\d{2}$/ | ⏳ PENDING |
| 88 | `formatPercent/whole_number` | 75 → "75%" | ⏳ PENDING |
| 89 | `formatPercent/rounds_decimal_down` | 75.3 → "75%" | ⏳ PENDING |
| 90 | `formatPercent/rounds_decimal_up` | 75.7 → "76%" | ⏳ PENDING |
| 91 | `formatPercent/zero` | 0 → "0%" | ⏳ PENDING |
| 92 | `formatPercent/100` | 100 → "100%" | ⏳ PENDING |
| 93 | `formatPercent/over_100_over-budget_scenario` | 120 → "120%" | ⏳ PENDING |

**Subtotal: 0/32 run** (test file written; install `jest-expo` then run `npx jest`)

---

## 3. Integration Tests

### 3.1 Auth Flow

| # | Scenario | Steps | Result |
|---|----------|-------|--------|
| IT-1 | Register → JWT issued | POST /api/auth/register → 201, accessToken present | 🔲 PLANNED |
| IT-2 | Duplicate email | Register same email twice → 409 Conflict | 🔲 PLANNED |
| IT-3 | Login correct password | POST /api/auth/login → 200, access + refresh tokens | 🔲 PLANNED |
| IT-4 | Login wrong password | POST /api/auth/login → 401 | 🔲 PLANNED |
| IT-5 | Token refresh | POST /api/auth/refresh with valid token → new access token | 🔲 PLANNED |
| IT-6 | Revoked token rejected | Use refresh token twice → second attempt 401 | 🔲 PLANNED |
| IT-7 | Protected without token | GET /api/auth/me, no Authorization → 401 | 🔲 PLANNED |

### 3.2 Subscription Flow

| # | Scenario | Steps | Result |
|---|----------|-------|--------|
| IT-8 | New user has trial | Register → GET /api/subscription → status=trialing | 🔲 PLANNED |
| IT-9 | Checkout returns snap token | POST /api/subscription/checkout → snapToken in response | 🔲 PLANNED |
| IT-10 | Webhook activates sub | POST /api/webhooks/midtrans settlement + valid sig → status=active | 🔲 PLANNED |
| IT-11 | Webhook bad sig rejected | POST /api/webhooks/midtrans wrong sig → 400 | 🔲 PLANNED |
| IT-12 | Cancel subscription | POST /api/subscription/cancel → status=canceled | 🔲 PLANNED |
| IT-13 | TierGate free user blocked | Connect email-integration as expired trial user → 403 | 🔲 PLANNED |
| IT-14 | TierGate pro user passes | Connect email-integration as active pro user → 201 | 🔲 PLANNED |

### 3.3 Email Import Flow

| # | Scenario | Steps | Result |
|---|----------|-------|--------|
| IT-15 | BCA email imports transaction | ProcessMessage BCA debit → transaction created, status=imported | 🔲 PLANNED |
| IT-16 | Duplicate email skipped | ProcessMessage same email twice → second=skipped | 🔲 PLANNED |
| IT-17 | Non-bank email skipped | ProcessMessage newsletter → status=skipped | 🔲 PLANNED |
| IT-18 | Reprocess after rule add | Create parser rule, reprocess failed email → status=imported | 🔲 PLANNED |

---

## 4. How to Run

### Backend

```powershell
cd apps/api-go
go test ./...                          # all packages
go test ./internal/usecase/... -v      # verbose subscription + classifier
go test ./internal/infrastructure/... -v  # parser + payment
```

### Frontend

```powershell
cd apps/web
npm install --save-dev jest-expo babel-jest   # one-time setup
npx jest                                       # run all tests
npx jest --coverage                           # with coverage report
npx jest src/lib/format.test.ts              # single file
```

### Integration (not yet written)

```powershell
cd apps/api-go
go test ./internal/delivery/http/handler/... -tags integration -v
```

---

## 5. Final Summary

| Layer | Scenarios | Ran | PASS | FAIL | PENDING/PLANNED |
|-------|-----------|-----|------|------|-----------------|
| Backend unit | 61 | 61 | **61** | 0 | 0 |
| Frontend unit | 32 | 0 | 0 | 0 | **32** |
| Integration | 18 | 0 | 0 | 0 | **18** |
| **TOTAL** | **111** | **61** | **61** | **0** | **50** |

**Backend: 61/61 ✅ PASS. Frontend tests are written and ready to run once `jest-expo` is installed. Integration tests are specified but not yet implemented.**
