const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Mock PostgreSQL db module so tests run hermetically without requiring a live external database
jest.mock('../src/config/db', () => {
  const mockRows = new Map();
  return {
    query: jest.fn(),
    getClient: jest.fn(),
    pool: {},
    _mockRows: mockRows,
  };
});

process.env.JWT_SECRET = 'test_secret_key_1234567890_test_suite';
process.env.ALLOWED_FACULTY_DOMAINS = 'academia.edu,university.ac.in';

const db = require('../src/config/db');
const app = require('../src/app');

describe('IAM & Auth Microservice - Integration & Unit Tests', () => {
  let mockUserDb = [];
  let mockBlacklist = new Set();
  let mockResetTokens = [];
  let mockOtpDb = [];

  beforeEach(() => {
    jest.clearAllMocks();
    mockUserDb = [];
    mockBlacklist = new Set();
    mockResetTokens = [];
    mockOtpDb = [];

    // Setup flexible query mocking for PostgreSQL calls
    db.query.mockImplementation(async (queryText, params = []) => {
      const q = queryText.trim().toLowerCase();

      // INSERT INTO users
      if (q.startsWith('insert into users')) {
        const [email, passwordHash, firstName, lastName, role, department, isVerified] = params;
        const newUser = {
          id: 'b8b3b3cb-5690-4c3d-bcf2-70bca5362ff1',
          email,
          password_hash: passwordHash,
          first_name: firstName,
          last_name: lastName,
          role,
          department,
          is_verified: isVerified,
          created_at: new Date(),
          updated_at: new Date(),
        };
        mockUserDb.push(newUser);
        return { rows: [newUser] };
      }

      // SELECT from users by email
      if (q.startsWith('select') && q.includes('from users') && q.includes('where email = $1')) {
        const found = mockUserDb.find((u) => u.email.toLowerCase() === params[0].toLowerCase());
        return { rows: found ? [found] : [] };
      }

      // SELECT from users by id
      if (q.startsWith('select') && q.includes('from users') && q.includes('where id = $1')) {
        const found = mockUserDb.find((u) => u.id === params[0]);
        return { rows: found ? [found] : [] };
      }

      // UPDATE users profile
      if (q.startsWith('update users') && q.includes('where id = $4')) {
        const [firstName, lastName, department, id] = params;
        const user = mockUserDb.find((u) => u.id === id);
        if (user) {
          if (firstName) user.first_name = firstName;
          if (lastName) user.last_name = lastName;
          if (department) user.department = department;
          return { rows: [user] };
        }
        return { rows: [] };
      }

      // Token blacklist query
      if (q.startsWith('insert into token_blacklist')) {
        mockBlacklist.add(params[0]);
        return { rows: [] };
      }

      if (q.startsWith('select 1 from token_blacklist')) {
        const exists = mockBlacklist.has(params[0]);
        return { rows: exists ? [{ '?column?': 1 }] : [] };
      }

      // Password resets
      if (q.startsWith('insert into password_resets')) {
        const [userId, tokenHash, expiresAt] = params;
        const rec = { id: 'reset-uuid-1', user_id: userId, reset_token_hash: tokenHash, expires_at: expiresAt, used: false };
        mockResetTokens.push(rec);
        return { rows: [rec] };
      }

      if (q.startsWith('select id, user_id') && q.includes('from password_resets')) {
        const rec = mockResetTokens.find((r) => r.reset_token_hash === params[0] && !r.used);
        return { rows: rec ? [rec] : [] };
      }

      if (q.startsWith('update password_resets')) {
        return { rows: [] };
      }

      // Faculty OTP
      if (q.includes('faculty_verification_codes')) {
        if (q.includes('insert into')) {
          mockOtpDb.push({ email: params[0].toLowerCase(), code: params[1], expires_at: params[2] });
          return { rows: [{ id: 'otp-id-1' }] };
        }
        if (q.includes('select')) {
          const rec = mockOtpDb.find((o) => o.email === params[0].toLowerCase() && o.code === params[1]);
          return { rows: rec ? [{ id: 'otp-1' }] : [] };
        }
      }

      return { rows: [] };
    });
  });

  describe('POST /api/auth/register', () => {
    it('should successfully register a student', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'student@example.com',
          password: 'Password123',
          firstName: 'John',
          lastName: 'Doe',
          role: 'student',
          department: 'Computer Science',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe('student');
      expect(res.body.data.email).toBe('student@example.com');
    });

    it('should reject registration if password does not meet complexity requirements', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'weak@example.com',
          password: 'simple',
          firstName: 'Weak',
          lastName: 'Pass',
          role: 'student',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toBeDefined();
    });

    it('should allow faculty registration with an authorized institutional email domain', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'prof.smith@academia.edu',
          password: 'SecurePassword123',
          firstName: 'Alice',
          lastName: 'Smith',
          role: 'faculty',
          department: 'Physics',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe('faculty');
      expect(res.body.data.isVerified).toBe(true);
    });

    it('should reject faculty registration with personal email if OTP is not provided', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'smith.personal@gmail.com',
          password: 'SecurePassword123',
          firstName: 'Alice',
          lastName: 'Smith',
          role: 'faculty',
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Faculty registration requires an institutional email domain or a valid pre-authorized OTP/i);
    });

    it('should allow faculty registration with non-institutional email when valid OTP is provided', async () => {
      // First generate OTP
      const otpRes = await request(app)
        .post('/api/auth/generate-faculty-otp')
        .send({ email: 'smith.fellow@gmail.com' });

      expect(otpRes.status).toBe(200);
      const generatedOtp = otpRes.body.otp;

      // Register with OTP
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'smith.fellow@gmail.com',
          password: 'SecurePassword123',
          firstName: 'Alice',
          lastName: 'Smith',
          role: 'faculty',
          facultyOtp: generatedOtp,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe('faculty');
    });
  });

  describe('POST /api/auth/login & Token Flow', () => {
    beforeEach(async () => {
      const hash = await bcrypt.hash('Password123', 10);
      mockUserDb.push({
        id: 'user-uuid-1234',
        email: 'alice@academia.edu',
        password_hash: hash,
        first_name: 'Alice',
        last_name: 'Wonderland',
        role: 'faculty',
        department: 'Mathematics',
        is_verified: true,
      });
    });

    it('should authenticate valid credentials and return a signed JWT', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'alice@academia.edu',
          password: 'Password123',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();

      // Verify JWT claims
      const decoded = jwt.verify(res.body.data.token, process.env.JWT_SECRET);
      expect(decoded.sub).toBe('user-uuid-1234');
      expect(decoded.role).toBe('faculty');
    });

    it('should reject invalid password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'alice@academia.edu',
          password: 'WrongPassword',
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should support logout and prevent reusing the invalidated token', async () => {
      // 1. Login
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({ email: 'alice@academia.edu', password: 'Password123' });
      const token = loginRes.body.data.token;

      // 2. Access profile with token
      const profileBefore = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`);
      expect(profileBefore.status).toBe(200);

      // 3. Logout
      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`);
      expect(logoutRes.status).toBe(200);

      // 4. Access profile again with same token -> should be rejected
      const profileAfter = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`);
      expect(profileAfter.status).toBe(401);
      expect(profileAfter.body.message).toMatch(/Token has been revoked/i);
    });
  });

  describe('RBAC Middleware Guards', () => {
    let facultyToken;
    let studentToken;

    beforeEach(async () => {
      facultyToken = jwt.sign(
        { sub: 'fac-1', userId: 'fac-1', email: 'f@academia.edu', role: 'faculty' },
        process.env.JWT_SECRET
      );
      studentToken = jwt.sign(
        { sub: 'stu-1', userId: 'stu-1', email: 's@academia.edu', role: 'student' },
        process.env.JWT_SECRET
      );

      mockUserDb.push(
        { id: 'fac-1', email: 'f@academia.edu', role: 'faculty' },
        { id: 'stu-1', email: 's@academia.edu', role: 'student' }
      );
    });

    it('allows faculty to access faculty-only endpoints and denies students', async () => {
      const allowed = await request(app)
        .get('/api/auth/faculty-only-resource')
        .set('Authorization', `Bearer ${facultyToken}`);
      expect(allowed.status).toBe(200);

      const denied = await request(app)
        .get('/api/auth/faculty-only-resource')
        .set('Authorization', `Bearer ${studentToken}`);
      expect(denied.status).toBe(403);
    });
  });
});
