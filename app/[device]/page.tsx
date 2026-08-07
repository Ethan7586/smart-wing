import { headers } from 'next/headers';
import App from '../../src/App';

/**
 * Multi-device entry route.
 *
 * MallContext resolves the concrete mode from the pathname. Keeping the
 * rendering entry shared prevents the five clients from drifting into
 * independent business implementations.
 *
 * initialHost must be resolved server-side (matching app/page.tsx) so
 * isMvpPreviewHost() agrees between SSR and hydration — otherwise a
 * zhudatuan.com visit renders the full device frame on the server and
 * flips to the read-only preview shell on the client.
 */
export default async function DevicePage() {
  const requestHeaders = await headers();
  return <App initialHost={requestHeaders.get('host') ?? ''} />;
}
