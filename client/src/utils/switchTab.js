import { switchTab as shellSwitchTab } from './shellBridge.js';

export function switchTab(tabName, targetEl) {
  return shellSwitchTab(tabName, targetEl);
}
