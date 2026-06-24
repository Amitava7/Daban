// JS entry for the local Expo module. The real UCI client lives in
// src/engine/StockfishUci.ts; this just re-exports the raw native bridge so
// callers can `requireNativeModule('ExpoStockfish')` indirectly and so the
// Expo local-module autolinker has an index to resolve.
import { requireNativeModule } from 'expo-modules-core';

// May be undefined in environments without the native binary (Expo Go, web,
// dev client without a fresh prebuild). Callers must null-check.
let nativeModule: any = null;
try {
  nativeModule = requireNativeModule('ExpoStockfish');
} catch {
  nativeModule = null;
}

export default nativeModule;
