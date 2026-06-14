import { createComposeSdk, type ComposeSdk } from '@lifi/composer-sdk';
import { getLifiApiKey, getLifiComposerBaseUrl } from './config';

let _sdk: ComposeSdk | undefined;

export function getSdk(): ComposeSdk {
  if (!_sdk) {
    _sdk = createComposeSdk({
      baseUrl: getLifiComposerBaseUrl(),
      apiKey: getLifiApiKey(),
    });
  }
  return _sdk;
}
