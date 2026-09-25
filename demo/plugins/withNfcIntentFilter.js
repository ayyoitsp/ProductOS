const { withAndroidManifest } = require("expo/config-plugins");

/**
 * Registers MainActivity for android.nfc.action.NDEF_DISCOVERED on our
 * familywallet:// URI scheme, so cold NFC-tap on a programmed card opens
 * the app directly instead of Android's system Tag Reader.
 *
 * Written as a manifest mod because Expo's `android.intentFilters` in
 * app.json double-prefixes action names — an entry like
 *   { "action": "android.nfc.action.NDEF_DISCOVERED" }
 * ships as
 *   android.intent.action.android.nfc.action.NDEF_DISCOVERED
 * which is unmatchable.
 */
module.exports = function withNfcIntentFilter(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    const mainActivity = app?.activity?.find(
      (a) => a.$["android:name"] === ".MainActivity"
    );
    if (!mainActivity) return cfg;

    mainActivity["intent-filter"] = mainActivity["intent-filter"] ?? [];
    mainActivity["intent-filter"].push({
      action: [
        { $: { "android:name": "android.nfc.action.NDEF_DISCOVERED" } },
      ],
      category: [
        { $: { "android:name": "android.intent.category.DEFAULT" } },
      ],
      data: [
        { $: { "android:scheme": "familywallet", "android:host": "kid" } },
        { $: { "android:scheme": "familywallet" } },
      ],
    });

    return cfg;
  });
};
