---
name: Database source verification
description: Avoid assigning production roles to workspace database connections by their variable names.
---

Do not assume the workspace's `NEON_DATABASE_URL` is the published app's production connection.

**Why:** The workspace Neon connection and development connection contained identical records, while the read-only production query returned different records.

**How to apply:** Verify the intended source using environment-specific read-only queries before labeling database exports. A matching database name or login is not sufficient evidence that two connections reach the same data.
