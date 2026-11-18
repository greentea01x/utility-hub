if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');

const url = new URL(process.env.DATABASE_URL);
const isLocal = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);

if (!isLocal && !url.searchParams.has('sslmode')) {
  url.searchParams.set('sslmode', 'require');
}

// node-postgres now verifies certificates for sslmode=require by default.
// Supabase's documented "require" mode encrypts without CA verification.
// Use sslmode=verify-full&sslrootcert=/path/to/cert for certificate verification.
if (url.searchParams.get('sslmode') === 'require' && !url.searchParams.has('sslrootcert')) {
  url.searchParams.set('uselibpqcompat', 'true');
}

export const connectionString = url.toString();
