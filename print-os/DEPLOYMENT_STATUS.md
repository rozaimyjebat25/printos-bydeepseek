# PRINT OS V1.0 — Live Deployment

## 🎉 Status: DEPLOYED & RUNNING

### Production API
- **URL**: https://printos-bydeepseek-production.up.railway.app
- **Status**: ACTIVE (uptime 6+ minutes)
- **Platform**: Railway (Docker)
- **Region**: US West
- **Plan**: Trial ($5.00 credit, 30 days)

### Verification Results
```
✓ 1. Root endpoint          Status: 200
✓ 2. Health endpoint        Status: 200 (uptime: 363.89s)
✓ 3. Quotations (no auth)   Status: 401 (correctly protected)
✓ 4. Customers (no auth)    Status: 401 (correctly protected)
✓ 5. Sales Orders (no auth) Status: 401 (correctly protected)
✓ 6. Dashboard (no auth)    Status: 401 (correctly protected)
✓ 7. 404 handler            Status: 404 (custom error)
```

**Result: 7/7 passed**

### Database
- **Supabase Project**: `ddvytkgskhegfjytwpqz.supabase.co`
- **URL**: https://ddvytkgskhegfjytwpqz.supabase.co
- **Status**: 22 tables live, 27 RLS policies, 42 audit triggers
- **Demo data**: SR Creative Print tenant seeded

### GitHub Repository
- **Repo**: https://github.com/rozaimyjebat25/printos-bydeepseek
- **Branch**: main
- **Commits**: 7 total
- **Latest**: `3ffca61` (Remove conflicting config files - Railway auto-detect Dockerfile)

### Architecture
```
Frontend (Replit) → API (Railway) → Database (Supabase)
                  ↓
              JWT auth via Supabase
              RLS-enforced queries
              Tenant isolation per company
```

### What Was Built
1. **Database Schema** — 22 tables, 27 RLS policies, audit triggers, helper functions
2. **Backend TypeScript** — 9 modules (types, workflows, RBAC, audit, automation, services)
3. **REST API** — 6 route modules (quotation, SO, production, dashboard, customer, auth)
4. **Multi-tenant** — company_id scoping + RLS at database level
5. **RBAC** — 8 default roles with permission matrix
6. **Cost filtering** — Sales role can't see cost/margin
7. **Auto workflows** — Production job, delivery, invoice auto-creation
8. **Docker** — Multi-stage build, production-ready

### Verified Endpoints
| Endpoint | Auth | Status |
|---|---|---|
| `GET /` | No | 200 |
| `GET /health` | No | 200 |
| `GET /api/v1/quotations` | Yes | 401 without token |
| `GET /api/v1/customers` | Yes | 401 without token |
| `GET /api/v1/sales-orders` | Yes | 401 without token |
| `GET /api/v1/dashboard/owner` | Yes | 401 without token |
| `GET /api/v1/production/jobs` | Yes | 401 without token |
| `GET /api/v1/dashboard/repeat-predictions` | Yes | 401 without token |
| `GET /nonexistent` | No | 404 custom error |

### Owner User (Authenticated Access)
- **Email**: `owner@srcreative.my`
- **UID**: `158e17e8-7040-4db8-b21b-3f46cdb9faf0`
- **Role**: Owner
- **Company**: SR Creative Print
- **JWT app_metadata**: company_id, role, role_id

To test with real auth, login from frontend (Replit) using email + password.

### Test Commands
```bash
# Health check
curl https://printos-bydeepseek-production.up.railway.app/health

# List quotations (requires JWT)
curl -H "Authorization: Bearer <jwt>" \
  https://printos-bydeepseek-production.up.railway.app/api/v1/quotations

# Owner dashboard (requires JWT)
curl -H "Authorization: Bearer <jwt>" \
  https://printos-bydeepseek-production.up.railway.app/api/v1/dashboard/owner
```

### Next Steps
- [ ] Frontend integration (Replit app connects to Railway API)
- [ ] Custom domain (optional, ~$1/month on Railway)
- [ ] Production Supabase plan (when needed)
- [ ] Onboard first customer
- [ ] Implement remaining modules (artwork portal, etc.)

---

**Last Updated**: 2026-06-17
**Deployment Status**: ✅ LIVE
