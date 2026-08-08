import App from '../../src/App';

/**
 * Multi-device entry route.
 *
 * MallContext resolves the concrete mode from the pathname. Keeping the
 * rendering entry shared prevents the five clients from drifting into
 * independent business implementations.
 */
export default function DevicePage() {
  return <App />;
}
