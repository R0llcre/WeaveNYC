// Stub expo-haptics for Node test env — the real package calls into a
// native module that isn't registered under jest. Atom tests just need to
// assert that the atom *attempted* to fire a haptic, so we expose spy-able
// no-op functions that return resolved promises.
const selectionAsync = jest.fn(() => Promise.resolve());
const impactAsync = jest.fn(() => Promise.resolve());
const notificationAsync = jest.fn(() => Promise.resolve());

const ImpactFeedbackStyle = {
  Light: 'light',
  Medium: 'medium',
  Heavy: 'heavy',
  Soft: 'soft',
  Rigid: 'rigid',
};

const NotificationFeedbackType = {
  Success: 'success',
  Warning: 'warning',
  Error: 'error',
};

module.exports = {
  selectionAsync,
  impactAsync,
  notificationAsync,
  ImpactFeedbackStyle,
  NotificationFeedbackType,
};
