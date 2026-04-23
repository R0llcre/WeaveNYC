// `expo-haptics` test stub — R4 atoms extension.
//
// IconButton calls through to `triggerHaptic()` which maps ms → an impact
// call on `expo-haptics`. Tests need to assert which call was made (or
// that nothing fired when `haptic={false}`), so every export below is a
// spy-able `jest.fn()` returning a resolved promise.
//
// The real package wires native modules (iOS UIFeedbackGenerator /
// Android Vibrator patterns) that jest can't run without the full
// jest-expo preset. The stub intentionally does no work — we only care
// that the atom attempted the right call.
module.exports = {
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
    Soft: 'soft',
    Rigid: 'rigid',
  },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
};
