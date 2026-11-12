import express from 'express';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const dbUrl = new URL(process.env.DATABASE_URL);
console.log(`DB target: host=${dbUrl.hostname}:${dbUrl.port} db=${dbUrl.pathname.slice(1)} schema=spike_refine`);

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
const s3 = new S3Client({
  region: process.env.S3_REGION,
  requestChecksumCalculation: process.env.SPIKE_BAD_CHECKSUM ? 'WHEN_SUPPORTED' : 'WHEN_REQUIRED',
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY },
});

const SORTABLE = new Set(['id', 'full_name', 'email', 'city', 'status', 'created_at']);
const FILTERABLE = new Set(['status', 'city']);
const STATUSES = ['active', 'inactive', 'banned'];
const CITIES = ['Ha Noi', 'Ho Chi Minh', 'Da Nang', 'Can Tho', 'Hai Phong'];

async function migrateAndSeed() {
  await pool.query('CREATE SCHEMA IF NOT EXISTS spike_refine');
  await pool.query(`CREATE TABLE IF NOT EXISTS spike_refine.player (
    id serial PRIMARY KEY, full_name text NOT NULL, email text NOT NULL UNIQUE,
    city text NOT NULL, status text NOT NULL, avatar_key text, created_at timestamptz NOT NULL DEFAULT now())`);
  const { rows } = await pool.query('SELECT count(*)::int AS n FROM spike_refine.player');
  if (rows[0].n >= 200) return;
  await pool.query(
    `INSERT INTO spike_refine.player (full_name, email, city, status, created_at)
     SELECT 'Player ' || lpad(g::text, 3, '0'), 'player' || g || '@example.test',
            ($1::text[])[1 + g % 5], ($2::text[])[1 + g % 3], now() - (g || ' hours')::interval
     FROM generate_series(1, 200) g ON CONFLICT DO NOTHING`,
    [CITIES, STATUSES],
  );
}

const app = express();
app.set('query parser', 'extended');
app.use(express.json());
app.use((req, _res, next) => { console.log(req.method, decodeURIComponent(req.originalUrl)); next(); });

app.get('/api/players', async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 10));
    const where = []; const args = [];
    if (req.query.q) { args.push(`%${req.query.q}%`); where.push(`(full_name ILIKE $${args.length} OR email ILIKE $${args.length})`); }
    for (const [k, v] of Object.entries(req.query.filter ?? {})) {
      if (!FILTERABLE.has(k)) return res.status(400).json({ message: `Unknown filter ${k}` });
      args.push(String(v).split(',')); where.push(`${k} = ANY($${args.length})`);
    }
    const order = String(req.query.sort || '-created_at').split(',').map((s) => {
      const col = s.replace(/^-/, '');
      if (!SORTABLE.has(col)) throw Object.assign(new Error(`Unknown sort ${col}`), { status: 400 });
      return `${col} ${s.startsWith('-') ? 'DESC' : 'ASC'}`;
    }).concat('id ASC').join(', ');
    const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = (await pool.query(`SELECT count(*)::int n FROM spike_refine.player ${w}`, args)).rows[0].n;
    const data = (await pool.query(
      `SELECT * FROM spike_refine.player ${w} ORDER BY ${order} LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`, args)).rows;
    res.json({ data, total });
  } catch (e) { next(e); }
});

app.post('/api/players', async (req, res, next) => {
  try {
    const { full_name, email, city, status, avatar_key } = req.body ?? {};
    const errors = {};
    if (!full_name || String(full_name).trim().length < 3) errors.full_name = 'Ho ten phai tu 3 ky tu';
    if (!/^\S+@\S+\.\S+$/.test(email ?? '')) errors.email = 'Email khong hop le';
    if (!CITIES.includes(city)) errors.city = 'Thanh pho khong hop le';
    if (!STATUSES.includes(status)) errors.status = 'Trang thai khong hop le';
    if (!errors.email) {
      const dup = await pool.query('SELECT 1 FROM spike_refine.player WHERE email = $1', [email]);
      if (dup.rowCount) errors.email = 'Email da ton tai';
    }
    if (Object.keys(errors).length) return res.status(422).json({ message: 'Validation failed', errors });
    const { rows } = await pool.query(
      'INSERT INTO spike_refine.player (full_name, email, city, status, avatar_key) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [full_name.trim(), email, city, status, avatar_key ?? null]);
    res.status(201).json({ data: rows[0] });
  } catch (e) { next(e); }
});

app.post('/api/upload-intent', async (req, res, next) => {
  try {
    const { filename, contentType } = req.body ?? {};
    if (!filename || !/^image\//.test(contentType ?? '')) return res.status(422).json({ errors: { file: 'Chi nhan anh' } });
    const key = `spike-refine/${randomUUID()}-${String(filename).replace(/[^\w.-]/g, '_')}`;
    const uploadUrl = await getSignedUrl(s3, new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key, ContentType: contentType }), { expiresIn: 300 });
    const u = new URL(uploadUrl);
    // local RustFS sends no CORS headers: default to same-origin via Vite proxy (UPLOAD_MODE=direct hits S3 from the browser)
    res.json({ key, uploadUrl: process.env.UPLOAD_MODE === 'direct' ? uploadUrl : '/s3' + u.pathname + u.search });
  } catch (e) { next(e); }
});

app.use((err, _req, res, _next) => {
  console.error(err.message);
  res.status(err.status ?? 500).json({ message: err.message });
});

await migrateAndSeed();
app.listen(3100, () => console.log('stub api on :3100'));
