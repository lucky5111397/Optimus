export const mockPlan = {
  _id: 'plan_001',
  taskId: 'task_003',
  markdown: `### Implementation Plan: Refactor Authentication Middleware

#### Overview
Extract common authentication patterns from individual route handlers into reusable Express middleware functions. This will reduce code duplication and provide a consistent auth interface across all endpoints.

#### Approach
1. Create a unified \`authMiddleware.js\` module
2. Support both JWT bearer tokens and API key authentication
3. Add role-based access control (RBAC) support
4. Implement proper error responses following RFC 7807

#### Files to Modify
- \`src/middleware/auth.js\` — Main refactor target
- \`src/routes/api.js\` — Update route definitions
- \`src/routes/admin.js\` — Update admin routes
- \`src/utils/errors.js\` — Add auth-specific error classes

#### Testing Strategy
- Unit tests for each middleware function
- Integration tests for protected endpoints
- Verify backward compatibility with existing JWT flow`,
  assumptions: [
    'Existing JWT signing key remains unchanged',
    'API keys are stored in the database with scoping',
    'No breaking changes to the public API contract',
    'Role definitions follow existing user model schema',
  ],
  steps: [
    {
      title: 'Create auth middleware module',
      description: 'Extract JWT verification and API key checking into standalone middleware functions in src/middleware/auth.js',
      filesAffected: ['src/middleware/auth.js', 'src/utils/errors.js'],
    },
    {
      title: 'Implement role-based access control',
      description: 'Add a requireRole() middleware that checks user roles from the JWT payload against required permissions',
      filesAffected: ['src/middleware/auth.js', 'src/models/User.js'],
    },
    {
      title: 'Update route definitions',
      description: 'Replace inline auth checks in route handlers with the new middleware composition pattern',
      filesAffected: ['src/routes/api.js', 'src/routes/admin.js'],
    },
    {
      title: 'Add error handling and tests',
      description: 'Implement RFC 7807 error responses for auth failures and add unit/integration tests',
      filesAffected: ['src/utils/errors.js', 'tests/auth.test.js'],
    },
  ],
};
