# SuperAdmin Frontend - Testing Guide

## 🧪 Manual Testing Checklist

### Prerequisites
1. ✅ Backend running on `http://localhost:9000`
2. ✅ Supabase database connected
3. ✅ `.env.local` configured with `NEXT_PUBLIC_API_URL=http://localhost:9000`

---

## Test Scenarios

### 1. Login Flow
**Steps:**
1. Navigate to `http://localhost:3000`
2. You should be redirected to `/login`
3. Enter email: `Mohalotaibii77@gmail.com`
4. Enter password (your password)
5. Click "Sign in"

**Expected:**
- ✅ Loading state shows "Signing in..."
- ✅ Redirected to `/dashboard` on success
- ✅ Error message displayed if credentials wrong
- ✅ Token stored in localStorage

**TypeScript Check:**
- ✅ No `any` types - using `authApi.login()` with proper types

---

### 2. View Dashboard
**Steps:**
1. After login, you should see the dashboard
2. Check the stats cards at the top
3. Check the business table

**Expected:**
- ✅ Stats show correct counts (Total, Active, Suspended)
- ✅ Table displays all businesses with columns:
  - Name & Slug
  - Business Type
  - Contact (Phone & Email)
  - Users (current / max)
  - Subscription Tier
  - Status (color-coded badges)
  - Certificate link
- ✅ Empty state shows if no businesses

**TypeScript Check:**
- ✅ No `any` types - using `Business[]` and `User | null`

---

### 3. Create New Business
**Steps:**
1. Click "New Business" button
2. Modal should open
3. Fill in the form:
   ```
   Business Name: Test Restaurant
   Slug: test-restaurant (auto-generated)
   Business Type: Restaurant
   Email: test@restaurant.com
   Phone: +1 234 567 8900
   Address: 123 Test Street
   Certificate: Upload a test image
   Tier: Basic
   Max Users: 5
   Max Products: 100
   ```
4. Click "Create Business"

**Expected:**
- ✅ Slug auto-generates from name
- ✅ File upload validates size (max 5MB) and type (images only)
- ✅ Loading state shows "Creating..."
- ✅ Modal closes on success
- ✅ New business appears in table
- ✅ Error shown if slug already exists

**Backend Call Check:**
```
POST http://localhost:9000/api/businesses
Headers: Authorization: Bearer <token>
Body: {
  name, slug, email, phone, address,
  business_type, certificate_url,
  subscription_tier, max_users, max_products
}
```

**TypeScript Check:**
- ✅ Using `CreateBusinessInput` type
- ✅ No `any` types in form data

---

### 4. View Certificate
**Steps:**
1. Find a business with a certificate
2. Click the "View" link in the Certificate column

**Expected:**
- ✅ Opens certificate image in new tab
- ✅ Shows "No certificate" if none uploaded

---

### 5. Logout
**Steps:**
1. Click "Logout" button in header

**Expected:**
- ✅ Redirected to `/login`
- ✅ Token removed from localStorage
- ✅ User data removed from localStorage

---

## 🔍 Code Quality Checks

### TypeScript Types
Run this command to check types:
```bash
cd Silo-system/super-admin
npx tsc --noEmit
```

**Expected:** ✅ No type errors

### Linting
```bash
npm run lint
```

**Expected:** ✅ No linting errors

---

## 🐛 Known Issues / Future Improvements

### Current Limitations:
1. **Certificate Upload**
   - Currently stores as base64 data URL
   - **TODO:** Upload to S3/Cloudinary via backend

2. **No Edit/Delete**
   - Can only create new businesses
   - **TODO:** Add edit and delete functionality

3. **No Search/Filter**
   - Shows all businesses
   - **TODO:** Add search and filters

4. **No Pagination**
   - Shows all businesses at once
   - **TODO:** Add pagination for large lists

---

## 📸 Expected UI

### Login Page:
```
┌─────────────────────────────────────┐
│                                     │
│           🎯 Logo                   │
│        Welcome back                 │
│   Enter your credentials...         │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  📧 Email                   │   │
│  │  🔒 Password                │   │
│  │                             │   │
│  │  [Sign in]                  │   │
│  └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘
```

### Dashboard:
```
┌──────────────────────────────────────────────────────────┐
│  🎯 Silo Admin        System Overview    🌙  [Logout]    │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐             │
│  │ Total    │  │ Active   │  │ Suspend  │             │
│  │   2      │  │    1     │  │    0     │             │
│  └──────────┘  └──────────┘  └──────────┘             │
│                                                          │
│  Registered Businesses         [+ New Business]          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Name  │ Type │ Contact │ Users │ Sub  │ Status │.. │ │
│  ├────────────────────────────────────────────────────┤ │
│  │ Silo  │ Rest │ phone   │ 2/5   │ Basic│ Active │.. │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Create Business Modal:
```
┌─────────────────────────────────────────┐
│  🏢 Create New Business            [X]  │
├─────────────────────────────────────────┤
│                                         │
│  Business Name *                        │
│  [The Great Restaurant         ]        │
│                                         │
│  Slug *                                 │
│  [the-great-restaurant         ]        │
│                                         │
│  Business Type *                        │
│  [Restaurant ▼]                         │
│                                         │
│  Email                  Phone           │
│  [test@email.com]       [+1234567890]   │
│                                         │
│  Certificate                            │
│  [📤 Click to upload or drag]           │
│                                         │
│  Subscription Tier      Max Users       │
│  [Basic ▼]              [5      ]       │
│                                         │
│  [Cancel]  [Create Business]            │
│                                         │
└─────────────────────────────────────────┘
```

---

## ✅ Success Criteria

All tests pass when:
- [x] Can log in successfully
- [x] Dashboard loads with correct data
- [x] Can create new business
- [x] Business appears in table immediately
- [x] All table columns show correct data
- [x] Certificate upload works
- [x] Can log out successfully
- [x] No TypeScript errors
- [x] No console errors
- [x] Responsive on mobile
- [x] Dark/Light theme works

---

## 🚀 Quick Start Testing

```bash
# Terminal 1: Start Backend
cd Silo-system/backend
npm run dev

# Terminal 2: Start SuperAdmin Frontend
cd Silo-system/super-admin
npm run dev

# Open browser: http://localhost:3000
# Login and test!
```

---

## 📞 Support

If you encounter issues:
1. Check backend is running on port 9000
2. Check `.env.local` has correct API_URL
3. Check browser console for errors
4. Check backend terminal for API errors
5. Verify Supabase database connection













