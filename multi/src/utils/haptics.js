// =============================================
// RAJA RANI: MONEY WAR — Haptic Feedback API
// =============================================

/**
 * Safely triggers device vibration if supported.
 * @param {number|number[]} pattern - Vibration duration(s) in ms
 */
export function vibrate(pattern) {
  if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
    try {
      window.navigator.vibrate(pattern);
    } catch (e) {
      // Ignore security or permission errors
    }
  }
}

export const HAPTICS = {
  // Light tap for buttons
  TAP: 15,
  // Card flip reveal
  REVEAL: [30, 50, 40],
  // Police submits action
  SUBMIT: 40,
  // Money showered
  COINS: [10, 80, 10, 80, 20],
  // Danger/Police wrong 
  ERROR: [50, 100, 100],
  // Result
  SUCCESS: [40, 60, 40, 60, 100]
};
