/**
 * LiveLocationRadar.tsx
 * Mutual Two-Way Live Location Sharing Component using Leaflet.js (OpenStreetMap)
 * 
 * Features:
 * - Real-time Firestore synchronization in chats/{chatId}.locationSession
 * - Mutual permission flow (Request, Pending, Accept & Share, Decline, Stop)
 * - Sleek Cyberpunk Dark-themed CartoDB tile layer
 * - Dual Markers: Glowing Cyan (Current User) & Glowing Magenta/Red (Partner)
 * - Live Distance Badge (Meters / Kilometers)
 * - Throttled (5s) watchPosition tracker with cleanup on unmount
 */

import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import {
  Navigation,
  Radio,
  X,
  Check,
  Compass,
  AlertCircle,
  LocateFixed,
  Maximize2,
  Minimize2,
  Share2,
} from 'lucide-react';
import {
  LocationSession,
  PublicUserProfile,
  UserRecord,
} from '../types';
import {
  calculateDistance,
  respondLocationSharing,
  stopLocationSharing,
  updateUserLiveCoordinates,
} from '../userService';

interface LiveLocationRadarProps {
  chatId: string;
  currentUser: UserRecord;
  partnerUser: PublicUserProfile;
  locationSession?: LocationSession;
  onClose?: () => void;
}

export const LiveLocationRadar: React.FC<LiveLocationRadarProps> = ({
  chatId,
  currentUser,
  partnerUser,
  locationSession,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const partnerMarkerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);

  const [geoError, setGeoError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isLocating, setIsLocating] = useState<boolean>(false);

  const myKey = currentUser.username.toLowerCase();
  const partnerKey = partnerUser.username.toLowerCase();

  const sessionStatus = locationSession?.status || 'idle';
  const requestedBy = locationSession?.requestedBy || '';
  const isRequestedByMe = requestedBy === myKey;
  const activeUsers = locationSession?.activeUsers || {};

  const myCoords = activeUsers[myKey];
  const partnerCoords = activeUsers[partnerKey];

  // Calculate live distance
  const liveDistance = useMemo(() => {
    if (myCoords && partnerCoords) {
      return calculateDistance(myCoords.lat, myCoords.lng, partnerCoords.lat, partnerCoords.lng);
    }
    return null;
  }, [myCoords, partnerCoords]);

  // Clean up geolocation watcher
  const stopWatching = () => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsLocating(false);
  };

  // Start watching position and throttle updates to 5 seconds
  const startWatching = () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser/device.');
      return;
    }

    setGeoError(null);
    setIsLocating(true);

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const now = Date.now();

        // Update local accuracy circle if map is ready
        if (mapRef.current) {
          if (!accuracyCircleRef.current) {
            accuracyCircleRef.current = L.circle([latitude, longitude], {
              radius: accuracy || 20,
              color: '#06b6d4',
              fillColor: '#06b6d4',
              fillOpacity: 0.1,
              weight: 1,
            }).addTo(mapRef.current);
          } else {
            accuracyCircleRef.current.setLatLng([latitude, longitude]);
            accuracyCircleRef.current.setRadius(accuracy || 20);
          }
        }

        // Throttle Firestore updates to every 5 seconds
        if (now - lastUpdateRef.current >= 5000 || lastUpdateRef.current === 0) {
          lastUpdateRef.current = now;
          updateUserLiveCoordinates(chatId, myKey, latitude, longitude);
        }
      },
      (err) => {
        console.warn('[LocationRadar] Geolocation error:', err.message);
        if (err.code === 1) {
          setGeoError('Location permission denied. Please allow GPS access.');
        } else {
          setGeoError('Unable to acquire precise GPS signal.');
        }
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 4000,
      }
    );
  };

  // Trigger GPS watching when session is active
  useEffect(() => {
    if (sessionStatus === 'active') {
      startWatching();
    } else {
      stopWatching();
    }

    return () => {
      stopWatching();
    };
  }, [sessionStatus, chatId]);

  // Initialize and maintain Leaflet Map when status is 'active'
  useEffect(() => {
    if (sessionStatus !== 'active' || !mapContainerRef.current) return;

    if (!mapRef.current) {
      // Default center: fallback to existing coords or standard fallback
      const initialLat = myCoords?.lat || partnerCoords?.lat || 20.5937;
      const initialLng = myCoords?.lng || partnerCoords?.lng || 78.9629;
      const initialZoom = myCoords || partnerCoords ? 15 : 5;

      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: true,
      }).setView([initialLat, initialLng], initialZoom);

      // CartoDB Dark Matter Tiles for sleek Cyberpunk contrast
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map);

      // Add Zoom Control at bottom right
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      mapRef.current = map;
    }

    // Invalidate size on container change or mount
    const timer = setTimeout(() => {
      mapRef.current?.invalidateSize();
    }, 250);

    return () => {
      clearTimeout(timer);
    };
  }, [sessionStatus]);

  // Clean up Map instance when session stops
  useEffect(() => {
    if (sessionStatus !== 'active' && mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
      userMarkerRef.current = null;
      partnerMarkerRef.current = null;
      accuracyCircleRef.current = null;
    }
  }, [sessionStatus]);

  // Helper to build custom HTML markers with anime glowing dot, avatar & pulse rings
  const createCyanUserIcon = (avatarUrl?: string, name?: string) => {
    const initial = name ? name.charAt(0).toUpperCase() : 'U';
    const innerContent = avatarUrl
      ? `<img src="${avatarUrl}" class="w-8 h-8 rounded-full object-cover border-2 border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.8)] relative z-10" />`
      : `<div class="w-8 h-8 rounded-full bg-slate-900 border-2 border-cyan-400 flex items-center justify-center text-cyan-300 font-bold text-xs shadow-[0_0_12px_rgba(6,182,212,0.8)] relative z-10">${initial}</div>`;

    return L.divIcon({
      className: 'custom-radar-marker',
      iconSize: [44, 44],
      iconAnchor: [22, 22],
      html: `
        <div class="relative w-11 h-11 flex items-center justify-center">
          <div class="absolute inset-0 rounded-full bg-cyan-400/30 marker-pulse-cyan"></div>
          <div class="absolute -inset-1 rounded-full border border-cyan-400/40 animate-spin" style="animation-duration: 9s;"></div>
          ${innerContent}
          <div class="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-cyan-400 border-2 border-[#0a0d14] shadow-[0_0_8px_#22d3ee] z-20"></div>
          <div class="absolute -bottom-4 bg-[#0a0d14]/95 text-cyan-300 font-mono text-[9px] font-bold px-1.5 py-0.5 rounded border border-cyan-500/50 whitespace-nowrap shadow-md">
            You
          </div>
        </div>
      `,
    });
  };

  const createMagentaPartnerIcon = (avatarUrl?: string, name?: string) => {
    const initial = name ? name.charAt(0).toUpperCase() : 'P';
    const innerContent = avatarUrl
      ? `<img src="${avatarUrl}" class="w-8 h-8 rounded-full object-cover border-2 border-pink-500 shadow-[0_0_12px_rgba(236,72,153,0.8)] relative z-10" />`
      : `<div class="w-8 h-8 rounded-full bg-slate-900 border-2 border-pink-500 flex items-center justify-center text-pink-300 font-bold text-xs shadow-[0_0_12px_rgba(236,72,153,0.8)] relative z-10">${initial}</div>`;

    return L.divIcon({
      className: 'custom-radar-marker',
      iconSize: [44, 44],
      iconAnchor: [22, 22],
      html: `
        <div class="relative w-11 h-11 flex items-center justify-center">
          <div class="absolute inset-0 rounded-full bg-pink-500/30 marker-pulse-magenta"></div>
          <div class="absolute -inset-1 rounded-full border border-pink-400/40 animate-spin" style="animation-duration: 9s;"></div>
          ${innerContent}
          <div class="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-pink-500 border-2 border-[#0a0d14] shadow-[0_0_8px_#f43f5e] z-20"></div>
          <div class="absolute -bottom-4 bg-[#0a0d14]/95 text-pink-300 font-mono text-[9px] font-bold px-1.5 py-0.5 rounded border border-pink-500/50 whitespace-nowrap shadow-md">
            ${name || 'Partner'}
          </div>
        </div>
      `,
    });
  };

  // Synchronize Markers & Auto-fit Bounds when active
  useEffect(() => {
    if (sessionStatus !== 'active' || !mapRef.current) return;
    const map = mapRef.current;

    // 1. Current User Marker
    if (myCoords) {
      const userLatLng = L.latLng(myCoords.lat, myCoords.lng);
      if (!userMarkerRef.current) {
        userMarkerRef.current = L.marker(userLatLng, {
          icon: createCyanUserIcon(currentUser.avatarUrl, currentUser.fullName),
          zIndexOffset: 1000,
        }).addTo(map);
      } else {
        userMarkerRef.current.setLatLng(userLatLng);
      }
    }

    // 2. Partner Marker
    if (partnerCoords) {
      const partnerLatLng = L.latLng(partnerCoords.lat, partnerCoords.lng);
      if (!partnerMarkerRef.current) {
        partnerMarkerRef.current = L.marker(partnerLatLng, {
          icon: createMagentaPartnerIcon(partnerUser.avatarUrl, partnerUser.fullName),
          zIndexOffset: 999,
        }).addTo(map);
      } else {
        partnerMarkerRef.current.setLatLng(partnerLatLng);
      }
    }

    // 3. Fit bounds if both users exist
    if (myCoords && partnerCoords) {
      const bounds = L.latLngBounds(
        [myCoords.lat, myCoords.lng],
        [partnerCoords.lat, partnerCoords.lng]
      );
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });
    } else if (myCoords) {
      map.setView([myCoords.lat, myCoords.lng], 16);
    } else if (partnerCoords) {
      map.setView([partnerCoords.lat, partnerCoords.lng], 16);
    }
  }, [sessionStatus, myCoords, partnerCoords]);

  // Recenter helper
  const handleRecenter = () => {
    if (!mapRef.current) return;
    if (myCoords && partnerCoords) {
      const bounds = L.latLngBounds(
        [myCoords.lat, myCoords.lng],
        [partnerCoords.lat, partnerCoords.lng]
      );
      mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });
    } else if (myCoords) {
      mapRef.current.setView([myCoords.lat, myCoords.lng], 16);
    }
  };

  // Actions
  const handleAcceptAndShare = () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation not supported.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        respondLocationSharing(chatId, true, currentUser.username, {
          lat: latitude,
          lng: longitude,
        });
        startWatching();
      },
      () => {
        // Even if initial fetch took a moment, activate session and let watchPosition handle it
        respondLocationSharing(chatId, true, currentUser.username);
        startWatching();
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleDecline = () => {
    stopWatching();
    respondLocationSharing(chatId, false, currentUser.username);
  };

  const handleStopSharing = () => {
    stopWatching();
    stopLocationSharing(chatId);
  };

  // RENDER CASE 1: Session is Idle (Nothing to display)
  if (sessionStatus === 'idle') {
    return null;
  }

  // RENDER CASE 2: Incoming Request to User B
  if (sessionStatus === 'requested' && !isRequestedByMe) {
    return (
      <div
        id="incomingLocationRequestBanner"
        className="w-full bg-gradient-to-r from-amber-500/20 via-[#161b26] to-cyan-500/20 border-b border-amber-500/30 p-3 sm:p-4 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-fade-in"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-md">
            <Radio className="w-5 h-5 animate-pulse text-amber-400" />
          </div>
          <div>
            <div className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
              <span>Mutual Live Location Request</span>
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            </div>
            <p className="text-[11px] text-slate-300">
              <span className="font-semibold text-amber-300">{partnerUser.fullName}</span> requested mutual live location. Accept to share yours?
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            id="declineLocationBtn"
            type="button"
            onClick={handleDecline}
            className="flex-1 sm:flex-none px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-white/10"
          >
            <X className="w-3.5 h-3.5" />
            <span>Decline</span>
          </button>
          <button
            id="acceptLocationBtn"
            type="button"
            onClick={handleAcceptAndShare}
            className="flex-1 sm:flex-none px-4 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-cyan-500/20 cursor-pointer active:scale-95"
          >
            <Check className="w-3.5 h-3.5 stroke-[3]" />
            <span>Accept & Share</span>
          </button>
        </div>
      </div>
    );
  }

  // RENDER CASE 3: Outgoing Request from User A (Pending acceptance)
  if (sessionStatus === 'requested' && isRequestedByMe) {
    return (
      <div
        id="pendingLocationRequestBanner"
        className="w-full bg-[#10141e] border-b border-cyan-500/30 p-3 sm:p-4 shadow-lg flex items-center justify-between gap-3 animate-fade-in"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0">
            <Radio className="w-5 h-5 animate-spin" style={{ animationDuration: '3s' }} />
          </div>
          <div>
            <div className="text-xs sm:text-sm font-semibold text-cyan-200 flex items-center gap-1.5">
              <span>Location Radar Requested</span>
              <span className="text-[10px] text-cyan-400 font-mono animate-pulse">Waiting...</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Waiting for <span className="text-white font-medium">{partnerUser.fullName}</span> to accept and activate mutual radar.
            </p>
          </div>
        </div>

        <button
          id="cancelLocationRequestBtn"
          type="button"
          onClick={handleStopSharing}
          className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
          <span>Cancel</span>
        </button>
      </div>
    );
  }

  // RENDER CASE 4: Active Two-Way Embedded Live Radar Map (Pinned 200px-240px container)
  return (
    <div
      id="activeLocationRadarContainer"
      className={`w-full bg-[#0a0d14] border-b border-cyan-500/30 relative transition-all duration-300 shadow-2xl z-20 ${
        isExpanded ? 'h-[380px] sm:h-[440px]' : 'h-[220px]'
      }`}
    >
      {/* Real-Time Distance Pill Overlay on Top-Left Map Corner */}
      <div className="absolute top-2.5 left-2.5 z-[1000] flex items-center gap-2 pointer-events-auto">
        <div
          id="realTimeDistancePill"
          className="px-3 py-1.5 rounded-full bg-[#07090e]/90 backdrop-blur-md border border-cyan-500/50 shadow-xl shadow-cyan-950/50 flex items-center gap-2 text-xs font-mono font-bold text-cyan-300"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400"></span>
          </span>
          <Compass className="w-3.5 h-3.5 text-cyan-400" />
          <span>Distance: {liveDistance ? liveDistance.formatted : 'Acquiring...'}</span>
        </div>
      </div>

      {/* Controls on Top-Right Map Corner (Recenter, Expand, and Stop Sharing) */}
      <div className="absolute top-2.5 right-2.5 z-[1000] flex items-center gap-1.5 pointer-events-auto">
        {/* Recenter Button */}
        <button
          id="radarRecenterBtn"
          type="button"
          onClick={handleRecenter}
          className="p-1.5 rounded-lg bg-[#07090e]/90 hover:bg-[#161b26] border border-white/20 text-cyan-400 hover:text-cyan-300 transition-all cursor-pointer shadow-md backdrop-blur-sm"
          title="Recenter Map"
        >
          <LocateFixed className="w-3.5 h-3.5" />
        </button>

        {/* Expand / Collapse Button */}
        <button
          id="radarExpandBtn"
          type="button"
          onClick={() => {
            setIsExpanded((prev) => !prev);
            setTimeout(() => mapRef.current?.invalidateSize(), 300);
          }}
          className="p-1.5 rounded-lg bg-[#07090e]/90 hover:bg-[#161b26] border border-white/20 text-slate-300 hover:text-white transition-all cursor-pointer shadow-md backdrop-blur-sm"
          title={isExpanded ? 'Collapse Map' : 'Expand Map'}
        >
          {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>

        {/* Small "Stop Sharing" Button in Map Corner */}
        <button
          id="stopLocationRadarBtn"
          type="button"
          onClick={handleStopSharing}
          className="px-2.5 py-1.5 rounded-lg bg-rose-600/90 hover:bg-rose-600 border border-rose-400/50 text-white text-[11px] font-bold flex items-center gap-1.5 shadow-lg shadow-rose-950/40 transition-all cursor-pointer active:scale-95"
          title="Stop Sharing and Clear Watchers"
        >
          <X className="w-3.5 h-3.5 stroke-[3]" />
          <span>Stop Sharing</span>
        </button>
      </div>

      {/* Geolocation Warning if any */}
      {geoError && (
        <div className="absolute top-12 left-2.5 right-2.5 z-[1000] px-3 py-1.5 rounded-lg bg-rose-500/90 text-white text-[11px] font-medium flex items-center gap-1.5 shadow-lg">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{geoError}</span>
        </div>
      )}

      {/* Leaflet Map DOM Node */}
      <div
        ref={mapContainerRef}
        id="leafletRadarMap"
        className="w-full h-full z-0 relative"
      />

      {/* Cyberpunk Map Overlay Legend (Bottom-Left) */}
      <div className="absolute bottom-2.5 left-2.5 z-[1000] bg-[#07090e]/90 backdrop-blur-md border border-white/15 px-2.5 py-1 rounded-lg flex items-center gap-3 text-[10px] font-mono shadow-md pointer-events-none">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#06b6d4]"></span>
          <span className="text-cyan-200">You (Cyan)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-pink-500 shadow-[0_0_8px_#ec4899]"></span>
          <span className="text-pink-200">{partnerUser.fullName.split(' ')[0]} (Pink)</span>
        </div>
      </div>
    </div>
  );
};
