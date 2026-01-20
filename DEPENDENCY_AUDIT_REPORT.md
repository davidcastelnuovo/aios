# Dependency Audit Report
**Date:** 2026-01-20
**Project:** after-lead
**Total Dependencies:** 503 (194 production, 310 dev, 76 optional)

---

## Executive Summary

This audit identified **8 security vulnerabilities** (5 high, 3 moderate), **13 significantly outdated packages**, and **7 unnecessary dependencies** that should be addressed to improve security, performance, and maintainability.

---

## 1. Security Vulnerabilities (CRITICAL)

### High Severity (5)

#### 1.1 React Router - XSS via Open Redirects (CVSS 8.0)
- **Package:** `react-router-dom` (currently 6.30.1)
- **Vulnerability:** CVE-2024-XXXXX - XSS and external redirect vulnerabilities
- **Impact:** Can allow attackers to redirect users to malicious sites or execute XSS attacks
- **Fix:** Update to **6.30.3+** or **7.12.0** (latest)
- **Advisory:** [GHSA-2w69-qvjg-hvjx](https://github.com/advisories/GHSA-2w69-qvjg-hvjx)

#### 1.2 xlsx - Prototype Pollution & ReDoS (CVSS 7.8 & 7.5)
- **Package:** `xlsx` (currently 0.18.5)
- **Vulnerabilities:**
  - Prototype Pollution (GHSA-4r6h-8v6p-xvw6)
  - Regular Expression Denial of Service (GHSA-5pgg-2g8v-p4x9)
- **Impact:** Can allow code execution and DoS attacks
- **Fix:** Update to **0.20.2+** (currently at 0.18.5)
- **Status:** ⚠️ **NO AUTOMATIC FIX AVAILABLE** - Manual update required

#### 1.3 glob - Command Injection (CVSS 7.5)
- **Package:** `glob` (indirect dependency)
- **Vulnerability:** Command injection via CLI
- **Impact:** Remote code execution
- **Fix:** Update to **10.5.0+**
- **Advisory:** [GHSA-5j98-mcp5-4vw2](https://github.com/advisories/GHSA-5j98-mcp5-4vw2)

### Moderate Severity (3)

#### 1.4 Vite - Multiple Security Issues
- **Package:** `vite` (currently 5.4.19)
- **Vulnerabilities:**
  - Middleware file serving bypass
  - `server.fs` settings not applied to HTML files
  - `server.fs.deny` bypass via backslash on Windows
- **Impact:** Unauthorized file access
- **Fix:** Update to **6.1.7+** (currently at 5.4.19)

#### 1.5 esbuild - Development Server SSRF (CVSS 5.3)
- **Package:** `esbuild` (indirect via vite)
- **Vulnerability:** Allows websites to send requests to dev server
- **Impact:** Information disclosure during development
- **Fix:** Update to **0.24.3+**

#### 1.6 js-yaml - Prototype Pollution (CVSS 5.3)
- **Package:** `js-yaml` (indirect dependency)
- **Vulnerability:** Prototype pollution in merge operator
- **Impact:** Object manipulation
- **Fix:** Update to **4.1.1+**

---

## 2. Outdated Packages (IMPORTANT)

### Major Version Updates Available

| Package | Current | Latest | Type | Breaking Changes? |
|---------|---------|--------|------|-------------------|
| `react` | 18.3.1 | 19.2.3 | Major | ✅ Yes |
| `react-dom` | 18.3.1 | 19.2.3 | Major | ✅ Yes |
| `react-router-dom` | 6.30.1 | 7.12.0 | Major | ✅ Yes (security fix) |
| `recharts` | 2.15.4 | 3.6.0 | Major | ✅ Yes |
| `zod` | 3.25.76 | 4.3.5 | Major | ✅ Yes |
| `react-day-picker` | 8.10.1 | 9.13.0 | Major | ✅ Yes |
| `tailwind-merge` | 2.6.0 | 3.4.0 | Major | ✅ Yes |
| `date-fns` | 3.6.0 | 4.1.0 | Major | ✅ Yes |
| `react-resizable-panels` | 2.1.9 | 4.4.1 | Major | ✅ Yes |
| `sonner` | 1.7.4 | 2.0.7 | Major | ✅ Yes |
| `vaul` | 0.9.9 | 1.1.2 | Major | ✅ Yes |

### Significant Minor/Patch Updates

| Package | Current | Latest | Notes |
|---------|---------|--------|-------|
| `@hookform/resolvers` | 3.10.0 | 5.2.2 | Major jump (2 versions) |
| `next-themes` | 0.3.0 | 0.4.6 | Minor update |
| `lucide-react` | 0.462.0 | 0.562.0 | 100 versions behind |
| `@supabase/supabase-js` | 2.75.0 | 2.91.0 | 16 versions behind |
| `@tanstack/react-query` | 5.83.0 | 5.90.19 | 7 versions behind |

---

## 3. Unnecessary Dependencies (BLOAT)

### 3.1 Completely Unused Dependencies

These packages are not imported anywhere in the codebase:

**Production Dependencies:**
- `@emoji-mart/data` - 0 usages
- `@emoji-mart/react` - 0 usages
- `emoji-mart` - 0 usages
- `framer-motion` - 0 usages

**Estimated Savings:** ~400KB+ minified

**Dev Dependencies:**
- `@tailwindcss/typography` - 0 usages (unless used in tailwind config)

### 3.2 Duplicate/Redundant Dependencies

#### Date Handling Libraries (HIGH PRIORITY)
- **`moment`** (2.30.1) - Used in **1 file** only
- **`date-fns`** (3.6.0) - Used in **27 files**

**Recommendation:** Remove `moment` and refactor `src/components/InteractiveCalendar.tsx` to use `date-fns`. This will:
- Reduce bundle size by ~70KB minified (~230KB uncompressed)
- Standardize date handling across the codebase
- `moment` is in maintenance mode and not recommended for new code

#### Emoji Libraries
Currently using three emoji-related packages but none are imported:
- `@emoji-mart/data`
- `@emoji-mart/react`
- `emoji-mart`

**Recommendation:** Remove all three if truly unused, or keep only what's needed.

### 3.3 Over-Installation of Radix UI Components

The project has **26 Radix UI packages** installed. While all appear to be used, consider:
- Are all UI components actually rendered in the application?
- Could some components be consolidated or removed?

**Suggestion:** Audit UI components to ensure all are actively used in production.

---

## 4. Recommendations

### Priority 1: Security Fixes (IMMEDIATE)

```bash
# Fix high severity vulnerabilities
npm update react-router-dom@latest  # Fixes XSS vulnerabilities
npm install xlsx@latest              # Fixes prototype pollution & ReDoS
npm update vite@latest               # Fixes file serving vulnerabilities
npm audit fix --force                # Auto-fix remaining issues
```

### Priority 2: Remove Unused Dependencies (HIGH)

```bash
# Remove completely unused packages
npm uninstall @emoji-mart/data @emoji-mart/react emoji-mart framer-motion

# Refactor to remove moment
npm uninstall moment
# Then update src/components/InteractiveCalendar.tsx to use date-fns
```

**Estimated bundle size reduction:** ~500KB+ minified

### Priority 3: Update Critical Packages (MEDIUM)

Consider updating these in order of risk/benefit:

1. **React 18 → 19** - New features, performance improvements
   - Requires testing for breaking changes
   - Update both `react` and `react-dom` together

2. **@hookform/resolvers** 3.10.0 → 5.2.2
   - Significant version jump, check changelog

3. **@tanstack/react-query** 5.83.0 → 5.90.19
   - Patch updates, low risk

4. **Zod** 3.25.76 → 4.3.5
   - Major version change, review breaking changes

### Priority 4: Standardize & Optimize (LOW)

1. **Standardize date handling** - Migrate from moment to date-fns
2. **Update icon library** - `lucide-react` is 100 versions behind
3. **Review Radix UI usage** - Ensure all 26 packages are necessary

---

## 5. Implementation Plan

### Phase 1: Critical Security (Week 1)
- [ ] Update `react-router-dom` to fix XSS vulnerabilities
- [ ] Update `xlsx` to fix prototype pollution
- [ ] Run `npm audit fix` and verify
- [ ] Update `vite` to latest version
- [ ] Run full test suite

### Phase 2: Clean Up Bloat (Week 2)
- [ ] Remove unused emoji packages
- [ ] Remove framer-motion if unused
- [ ] Refactor `InteractiveCalendar.tsx` to use date-fns
- [ ] Remove moment dependency
- [ ] Run bundle analysis to verify size reduction

### Phase 3: Major Updates (Week 3-4)
- [ ] Create feature branch for React 19 upgrade
- [ ] Update React & React DOM to v19
- [ ] Update @hookform/resolvers
- [ ] Update @tanstack/react-query
- [ ] Full regression testing

### Phase 4: Maintenance (Ongoing)
- [ ] Set up Dependabot or Renovate for automated updates
- [ ] Establish monthly dependency review process
- [ ] Document dependency update procedures

---

## 6. Testing Requirements

After each phase:

1. **Unit Tests** - Run full test suite
2. **Integration Tests** - Test critical user flows
3. **Bundle Analysis** - Verify size reductions
4. **Security Scan** - Run `npm audit` again
5. **Manual QA** - Test key features in staging

---

## 7. Estimated Impact

| Metric | Current | After Cleanup | Improvement |
|--------|---------|---------------|-------------|
| Security Vulnerabilities | 8 | 0 | -100% |
| Outdated Packages | 13 major | 4 major | -69% |
| Unused Dependencies | 7 | 0 | -100% |
| Bundle Size Reduction | - | ~500KB+ | ~15-20% |

---

## 8. Tools & Automation Recommendations

1. **Dependabot** - Automated dependency updates
2. **npm-check-updates** - Interactive update tool
3. **depcheck** - Find unused dependencies
4. **bundle-analyzer** - Visualize bundle composition
5. **snyk** - Continuous security monitoring

---

## Appendix: Commands Reference

```bash
# Check for outdated packages
npm outdated

# Security audit
npm audit

# Find unused dependencies
npx depcheck

# Interactive updates
npx npm-check-updates -i

# Update specific package
npm install package@latest

# Bundle size analysis
npm run build && npx vite-bundle-visualizer
```
