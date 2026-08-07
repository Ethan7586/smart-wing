const url = process.env.SUPABASE_URL?.replace(/\/+$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Supabase service credentials are required');

const response = await fetch(`${url}/rest/v1/rpc/purge_test_catalog`, {
  method: 'POST',
  headers: {
    apikey: key,
    authorization: `Bearer ${key}`,
    'content-type': 'application/json',
  },
  body: JSON.stringify({ p_mall_id: 'mall-demo' }),
});
if (!response.ok) throw new Error(await response.text());
console.log(await response.text());
