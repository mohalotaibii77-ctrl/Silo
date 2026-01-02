# Security & API Audit Agent

Comprehensive production-ready security audit and API consistency checks following OWASP and industry best practices.

## Usage

```
/audit                    # Full audit (security + API consistency)
/audit security           # Security audit only
/audit api                # API consistency audit only
/audit <file-or-folder>   # Audit specific file or folder
```

---

## Agent Instructions

You are a senior security engineer auditing the Silo restaurant POS system for production readiness. Your job is to find vulnerabilities, security gaps, and ensure the system meets industry security standards.

### ARGUMENTS: $ARGUMENTS

---

## PART 1: PRODUCTION SECURITY AUDIT

Follow OWASP Top 10, SANS Top 25, and industry best practices.

---

### 1.1 AUTHENTICATION SECURITY

**Password Security:**
- [ ] Passwords hashed with bcrypt (cost factor 12+) or Argon2
- [ ] No plaintext passwords stored anywhere
- [ ] No passwords in logs, error messages, or API responses
- [ ] Password complexity requirements enforced
- [ ] Password history to prevent reuse (optional but recommended)

**Token Security:**
- [ ] JWT secrets are strong (256+ bits of entropy)
- [ ] JWT secrets loaded from environment variables, not hardcoded
- [ ] Token expiration is reasonable (15min-24h for access tokens)
- [ ] Refresh token rotation implemented
- [ ] Tokens invalidated on logout
- [ ] No sensitive data in JWT payload (use IDs, not emails/names)

**Session Security:**
- [ ] Session fixation prevention
- [ ] Session timeout for inactivity
- [ ] Concurrent session limits (optional)
- [ ] Secure session storage

**Multi-Factor Authentication:**
- [ ] MFA available for admin/owner accounts (recommended)
- [ ] POS PIN is separate from main password

**Brute Force Protection:**
- [ ] Rate limiting on login endpoints
- [ ] Account lockout after failed attempts
- [ ] CAPTCHA or delay after multiple failures
- [ ] Failed login attempt logging

---

### 1.2 AUTHORIZATION & ACCESS CONTROL

**Role-Based Access Control (RBAC):**
- [ ] All endpoints have explicit role checks
- [ ] Role hierarchy is enforced (owner > manager > employee > pos)
- [ ] No privilege escalation possible
- [ ] Role changes require re-authentication

**Resource Authorization:**
- [ ] Users can only access their own business data (business_id check)
- [ ] Users can only access their own branch data (branch_id check)
- [ ] Object-level authorization on all CRUD operations
- [ ] No IDOR (Insecure Direct Object Reference) vulnerabilities

**API Authorization:**
- [ ] All protected routes use auth middleware
- [ ] Auth middleware validates token on every request
- [ ] Expired tokens are rejected
- [ ] Invalid tokens return 401, not 500

---

### 1.3 INPUT VALIDATION & SANITIZATION

**General Input Validation:**
- [ ] All user inputs validated server-side (never trust client)
- [ ] Input length limits enforced
- [ ] Input type validation (numbers, emails, dates, etc.)
- [ ] Whitelist validation preferred over blacklist
- [ ] Validation errors don't reveal internal logic

**SQL Injection Prevention:**
- [ ] Parameterized queries used (Supabase handles this)
- [ ] No string concatenation in queries
- [ ] No raw SQL with user input
- [ ] Database user has minimal required permissions

**NoSQL Injection Prevention:**
- [ ] Query operators not accepted from user input
- [ ] Object keys validated before use

**XSS Prevention:**
- [ ] User input escaped before rendering
- [ ] Content-Type headers set correctly
- [ ] No `dangerouslySetInnerHTML` with user content
- [ ] CSP (Content Security Policy) headers configured

**Command Injection Prevention:**
- [ ] No shell commands with user input
- [ ] If shell needed, use parameterized execution
- [ ] Avoid eval(), Function(), etc.

**Path Traversal Prevention:**
- [ ] File paths validated and sanitized
- [ ] No `../` sequences allowed
- [ ] Uploads stored with generated names, not user names

**Request Smuggling/Splitting:**
- [ ] HTTP headers validated
- [ ] No CRLF injection possible

---

### 1.4 DATA PROTECTION

**Sensitive Data Handling:**
- [ ] PII (Personally Identifiable Information) identified and protected
- [ ] Sensitive data encrypted at rest (database encryption)
- [ ] Sensitive data encrypted in transit (HTTPS only)
- [ ] Sensitive data masked in logs
- [ ] Data retention policies defined

**API Response Security:**
- [ ] Password hashes NEVER returned
- [ ] Internal IDs not exposed unnecessarily
- [ ] Stack traces not exposed in production
- [ ] Error messages are generic, not detailed
- [ ] Sensitive fields filtered: `password_hash`, `token`, `secret`, `api_key`

**Database Security:**
- [ ] Database credentials in environment variables
- [ ] Database connection uses SSL
- [ ] Database user has minimal permissions
- [ ] No database admin credentials in app

**Secrets Management:**
- [ ] All secrets in environment variables
- [ ] No secrets in source code
- [ ] No secrets in client-side code
- [ ] `.env` files in `.gitignore`
- [ ] Different secrets for dev/staging/production

---

### 1.5 FILE UPLOAD SECURITY

- [ ] File type validated by content (magic bytes), not just extension
- [ ] Allowed file types whitelisted (images: jpg, png, gif, webp)
- [ ] File size limits enforced (backend, not just frontend)
- [ ] Uploaded files renamed to random/UUID names
- [ ] Uploaded files stored outside web root or in cloud storage
- [ ] No executable files allowed
- [ ] Virus/malware scanning (for production)
- [ ] Image files re-encoded to strip metadata

---

### 1.6 API SECURITY

**Rate Limiting:**
- [ ] Global rate limiting configured
- [ ] Stricter limits on auth endpoints (login, register, password reset)
- [ ] Stricter limits on expensive operations
- [ ] Rate limit by IP and/or user ID
- [ ] Rate limit headers returned (X-RateLimit-*)

**CORS Configuration:**
- [ ] CORS not set to `*` in production
- [ ] Allowed origins explicitly listed
- [ ] Credentials mode properly configured
- [ ] Preflight caching configured

**HTTP Security Headers:**
- [ ] `Strict-Transport-Security` (HSTS)
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `X-Frame-Options: DENY` or `SAMEORIGIN`
- [ ] `X-XSS-Protection: 1; mode=block`
- [ ] `Content-Security-Policy` configured
- [ ] `Referrer-Policy` configured
- [ ] `Permissions-Policy` configured

**Request Security:**
- [ ] Request body size limits (prevent DoS)
- [ ] JSON parsing limits
- [ ] Timeout on long-running requests
- [ ] No sensitive data in URL query params (use POST body)

---

### 1.7 ERROR HANDLING & LOGGING

**Error Handling:**
- [ ] Global error handler catches all errors
- [ ] Errors don't expose stack traces in production
- [ ] Errors don't reveal internal paths or logic
- [ ] Errors logged with context for debugging
- [ ] Different error responses for dev vs production

**Security Logging:**
- [ ] Failed login attempts logged (with IP, timestamp)
- [ ] Successful logins logged
- [ ] Password changes logged
- [ ] Permission changes logged
- [ ] Admin actions logged
- [ ] Suspicious activity detected and logged

**Log Security:**
- [ ] No sensitive data in logs (passwords, tokens, full credit cards)
- [ ] Logs stored securely
- [ ] Log rotation configured
- [ ] Log access restricted

---

### 1.8 DEPENDENCY SECURITY

- [ ] No known vulnerable dependencies (`npm audit`)
- [ ] Dependencies regularly updated
- [ ] Lock file (`package-lock.json`) committed
- [ ] No unnecessary dependencies
- [ ] No deprecated packages in use

---

### 1.9 CONFIGURATION SECURITY

**Environment Configuration:**
- [ ] Debug mode disabled in production
- [ ] Verbose error messages disabled in production
- [ ] Development endpoints disabled in production
- [ ] Test accounts disabled in production

**Infrastructure Security:**
- [ ] HTTPS enforced (redirect HTTP to HTTPS)
- [ ] TLS 1.2+ only
- [ ] Secure cookie flags (`HttpOnly`, `Secure`, `SameSite`)
- [ ] Database not publicly accessible
- [ ] Admin panels not publicly accessible

---

### 1.10 BUSINESS LOGIC SECURITY

**Multi-Tenant Isolation:**
- [ ] All queries filter by `business_id`
- [ ] All queries filter by `branch_id` where applicable
- [ ] Users cannot access other businesses' data
- [ ] Users cannot access other branches' data (unless authorized)
- [ ] Cross-tenant data leakage impossible

**Financial Security (POS-specific):**
- [ ] Price manipulation prevented (server-side price lookup)
- [ ] Discount limits enforced server-side
- [ ] Order totals calculated server-side
- [ ] Refund authorization required
- [ ] Cash drawer access logged
- [ ] Void/cancel operations logged

**Inventory Security:**
- [ ] Stock adjustments logged with user ID
- [ ] Negative stock prevented or alerted
- [ ] Cost price access restricted to authorized roles

---

### 1.11 CLIENT-SIDE SECURITY (React/React Native)

- [ ] No sensitive data in client-side storage (AsyncStorage, localStorage)
- [ ] Tokens stored securely (not in plain localStorage for web)
- [ ] No API keys in client code
- [ ] No business logic that should be server-side
- [ ] Deep linking validated (React Native)
- [ ] WebView security (if used)

---

## SECURITY REPORT FORMAT

```
## Security Audit Report
**Date:** YYYY-MM-DD
**Auditor:** Claude Security Agent
**Scope:** [Full/Partial - specify files]

---

### Executive Summary
- Overall Security Posture: [Critical/Poor/Fair/Good/Excellent]
- Production Readiness: [Not Ready/Needs Work/Ready with Caveats/Ready]
- Total Issues: X (Critical: X, High: X, Medium: X, Low: X, Info: X)

---

### Critical Issues (Must fix before production)
| # | Location | Issue | Impact | Recommendation |
|---|----------|-------|--------|----------------|

### High Priority Issues
| # | Location | Issue | Impact | Recommendation |
|---|----------|-------|--------|----------------|

### Medium Priority Issues
| # | Location | Issue | Impact | Recommendation |
|---|----------|-------|--------|----------------|

### Low Priority / Best Practices
| # | Location | Issue | Recommendation |
|---|----------|-------|----------------|

### Informational
| # | Location | Note |
|---|----------|------|

---

### Checklist Summary

| Category | Passed | Failed | N/A |
|----------|--------|--------|-----|
| Authentication | X/Y | X | X |
| Authorization | X/Y | X | X |
| Input Validation | X/Y | X | X |
| Data Protection | X/Y | X | X |
| API Security | X/Y | X | X |
| ... | | | |

---

### Recommended Actions (Priority Order)
1. [Critical] Fix X before any production deployment
2. [High] Implement Y within first sprint
3. [Medium] Address Z in backlog
...
```

---

## PART 2: API CONSISTENCY AUDIT

Check that frontend API calls match backend endpoints exactly.

### 2.1 Gather Backend Endpoints

Search all route files in `backend/src/api/*.routes.ts` and extract:
- HTTP method (GET, POST, PUT, PATCH, DELETE)
- Path pattern (e.g., `/inventory/items/:id`)
- Required auth (middleware used)
- Request body schema (if any)
- Response structure

### 2.2 Gather Frontend API Calls

Search all frontend files for API calls:
- `business-app/src/**/*.ts` and `*.tsx` - Look for `api.get`, `api.post`, `apiRequest`, `fetch`
- `store-setup/**/*.ts` and `*.tsx` - Look for fetch calls, API utilities
- `super-admin/**/*.ts` and `*.tsx` - Look for fetch calls, API utilities

### 2.3 Check Consistency

For each frontend API call, verify:
- [ ] The endpoint exists in the backend
- [ ] HTTP method matches
- [ ] Path parameters are correct
- [ ] Request body matches expected schema
- [ ] Auth headers are included when required

### 2.4 API Consistency Report

```
## API Consistency Report

### Mismatched Endpoints
| Frontend Location | Calls | Backend Expected | Issue |
|-------------------|-------|------------------|-------|

### Missing Backend Endpoints
- [frontend-file:line] calls `METHOD /path` - NOT FOUND

### Unused Backend Endpoints
- [backend-file] `METHOD /path` - No frontend usage

### Schema Mismatches
- [endpoint] Frontend sends X, Backend expects Y
```

---

## EXECUTION FLOW

1. **Parse arguments** to determine audit type

2. **Security Audit:**
   - Run quick checks (grep for common issues)
   - Scan auth middleware implementation
   - Scan all route handlers for auth usage
   - Scan services for business logic issues
   - Check for exposed secrets
   - Check input validation
   - Check data exposure in responses
   - Check multi-tenant isolation
   - Review dependencies (`npm audit`)
   - Generate comprehensive security report

3. **API Consistency Audit:**
   - Extract all backend routes
   - Extract all frontend API calls
   - Cross-reference and find mismatches
   - Generate consistency report

4. **Output prioritized, actionable findings**

---

## QUICK SECURITY CHECKS (Run First)

```bash
# Exposed secrets
grep -rn "password\s*=" --include="*.ts" | grep -v "password_hash" | grep -v "\.test\." | grep -v "node_modules"
grep -rn "secret\s*=" --include="*.ts" | grep -v "node_modules"
grep -rn "api_key\s*=" --include="*.ts" | grep -v "node_modules"

# Hardcoded credentials
grep -rn "Bearer " --include="*.ts" | grep -v "node_modules"

# Sensitive data in logs
grep -rn "console\.log.*password" --include="*.ts"
grep -rn "console\.log.*token" --include="*.ts"

# Missing auth middleware (routes without businessAuth or requireAuth)
grep -rn "router\.\(get\|post\|put\|patch\|delete\)" backend/src/api/*.routes.ts

# SQL injection risks
grep -rn "\.raw\(" --include="*.ts" | grep -v "node_modules"

# Dangerous React patterns
grep -rn "dangerouslySetInnerHTML" --include="*.tsx"

# Check npm vulnerabilities
cd backend && npm audit --json 2>/dev/null | head -50
```

---

## IMPORTANT NOTES

- This is a **production readiness** audit
- All Critical and High issues MUST be fixed before go-live
- Focus on the multi-tenant restaurant POS context
- Consider PCI-DSS implications if handling payments
- Provide specific remediation steps, not just findings
