import App from '../src/App';

// The document contains only the public storefront shell. Member identity,
// balances, carts, orders, and qualified prices are fetched client-side after
// the host-only session is checked, so the HTML must never vary by a cookie.
// Making this explicit lets the runtime reuse the same shell instead of
// rendering it at the origin for every anonymous visit.
export const dynamic = 'force-static';

export default function Home() {
  return <App />;
}
