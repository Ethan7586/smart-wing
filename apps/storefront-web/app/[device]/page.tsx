import { DeviceShowcase } from '../../src/showcase/DeviceShowcase';

/**
 * Multi-device entry route.
 *
 * These legacy visual simulators are intentionally isolated from the
 * production storefront entry and native WeChat mini program.
 */
export default function DevicePage() {
  return <DeviceShowcase />;
}
