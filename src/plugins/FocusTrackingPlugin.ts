import { registerPlugin } from '@capacitor/core';

export interface FocusStats {
  instagramCount: number;
  instagramTimeMs: number;
  youtubeCount: number;
  youtubeTimeMs: number;
  totalTimeMs: number;
  isServiceRunning: boolean;
  hasUsagePermission: boolean;
  hasAccessibilityPermission: boolean;
  hasOverlayPermission: boolean;
}

export interface FocusLimits {
  instagramCountLimit: number;
  instagramTimeLimitMs: number;
  youtubeCountLimit: number;
  youtubeTimeLimitMs: number;
  combinedCountLimit: number;
  combinedTimeLimitMs: number;
  safetyDetectionEnabled: boolean;
  trackingEnabled: boolean;
  warningMode: 'warning_only' | 'warning_and_restrict';
}

export interface FocusTrackingPlugin {
  checkPermissions(): Promise<{ usage: boolean, accessibility: boolean, overlay: boolean }>;
  requestUsagePermission(): Promise<void>;
  requestAccessibilityPermission(): Promise<void>;
  requestOverlayPermission(): Promise<void>;
  
  getStats(): Promise<FocusStats>;
  setLimits(options: { limits: FocusLimits }): Promise<void>;
  
  getSafetyStatus(): Promise<{ status: 'enabled' | 'permission_required' | 'initializing' | 'error' | 'off', errorDetail?: string }>;
  setSafetyFilterEnabled(options: { enabled: boolean }): Promise<{ status: string, errorDetail?: string }>;
  requestSafetyPermission(): Promise<void>;
}

export const FocusTracker = registerPlugin<FocusTrackingPlugin>('FocusTracker');
