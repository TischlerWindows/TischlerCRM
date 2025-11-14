import assert from 'assert';

async function run() {
  const base = 'http://localhost:4000';
  const results: Record<string, any> = {};

  try {
    const healthRes = await fetch(base + '/health');
    results.healthStatus = healthRes.status;
    results.healthBody = await healthRes.text();
  } catch (e: any) {
    results.healthError = e.message;
  }

  try {
    const loginRes = await fetch(base + '/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com', password: 'ChangeMe123!' })
    });
    results.loginStatus = loginRes.status;
    results.loginBodyRaw = await loginRes.text();
    if (loginRes.ok) {
      const parsed = JSON.parse(results.loginBodyRaw);
      assert(parsed.token, 'Missing token in response');
      results.loginTokenSnippet = parsed.token.substring(0, 16) + '...';
    }
  } catch (e: any) {
    results.loginError = e.message;
  }

  console.log(JSON.stringify(results, null, 2));
}

run();
