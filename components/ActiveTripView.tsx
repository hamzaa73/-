
import React, { FC, useEffect, useRef, useState } from 'react';
import { Booking, LatLngTuple } from '../types';
import { useLocalization } from '../contexts/LocalizationContext';
import { apiService, driverBackgroundService, dbService } from '../services'; // Import dbService
import { ICONS } from '../constants';

declare const L: any; // Using Leaflet from CDN

const isValidLatLngTuple = (coord: any): coord is LatLngTuple => {
    return Array.isArray(coord) && coord.length === 2 && typeof coord[0] === 'number' && typeof coord[1] === 'number';
};

interface ActiveTripViewProps {
    trip: Booking;
    onTripUpdate: (newStatus: Booking['status']) => void;
}

const ActiveTripView: FC<ActiveTripViewProps> = ({ trip, onTripUpdate }) => {
    const { t, language } = useLocalization();
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const driverMarkerRef = useRef<any>(null);
    const layersRef = useRef<any[]>([]);

    const [driverPosition, setDriverPosition] = useState<LatLngTuple | null>(null);
    const [currentRoute, setCurrentRoute] = useState<LatLngTuple[] | null>(null);
    const [destinationAddress, setDestinationAddress] = useState<string>('');
    const [isSummaryVisible, setIsSummaryVisible] = useState(false);

    // Clean Driver Navigation Arrow
    const driverIcon = L.divIcon({
        html: `<div class="relative transform transition-transform duration-300">
                <div class="absolute -inset-4 bg-blue-500/20 rounded-full animate-ping"></div>
                <div class="w-12 h-12 bg-white rounded-full border-4 border-blue-600 shadow-2xl flex items-center justify-center relative z-10">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-7 h-7 text-blue-600"><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z"/></svg>
                </div>
               </div>`,
        className: 'custom-leaflet-icon',
        iconSize: [48, 48], 
        iconAnchor: [24, 24],
    });

    // --- MAP INITIALIZATION & CLICK LISTENER ---
    useEffect(() => {
        if (mapContainerRef.current && !mapRef.current) {
            // Initialize map with high zoom for navigation feel
            mapRef.current = L.map(mapContainerRef.current, { zoomControl: false, attributionControl: false }).setView([15.3694, 44.1910], 16);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapRef.current);

            // --- CLICK TO DRIVE FEATURE ---
            // Allow driver to click anywhere to "teleport" or "drive" to that spot manually
            mapRef.current.on('click', (e: any) => {
                const { lat, lng } = e.latlng;
                // Update local state
                setDriverPosition([lat, lng]);
                // Broadcast to DB/Client
                dbService.updateDriverLocation("current_driver_id", lat, lng, true, trip.status);
            });
        }
        driverBackgroundService.setActiveTripStatus(trip.status);
    }, [trip.status]);

    // --- GPS TRACKING (from localStorage/DB) ---
    useEffect(() => {
        const updatePosition = () => {
            const data = localStorage.getItem("driver_location");
            if (data) {
                try {
                    const parsed = JSON.parse(data);
                    // Only update if valid and changed significantly to avoid jitter
                    if (parsed.driver_lat && parsed.driver_lng) {
                        const newPos: LatLngTuple = [parsed.driver_lat, parsed.driver_lng];
                        setDriverPosition(prev => {
                            if (!prev) return newPos;
                            const dist = Math.sqrt(Math.pow(prev[0]-newPos[0],2) + Math.pow(prev[1]-newPos[1],2));
                            return dist > 0.00001 ? newPos : prev;
                        });
                    }
                } catch(e) { console.error("Error parsing driver location", e); }
            }
        };
        // Poll faster for smoother animation
        const intervalId = setInterval(updatePosition, 1000); 
        return () => clearInterval(intervalId);
    }, []);

    // --- ROUTE FETCHING & ADDRESS ---
    // Re-calculate route whenever driver moves significantly or status changes
    useEffect(() => {
        const updateNavigation = async () => {
            let target: LatLngTuple | null = null;

            if (trip.status === 'accepted') {
                target = trip.pickup || null;
            } else if (trip.status === 'in_progress') {
                target = trip.drop || null;
            }

            if (target && isValidLatLngTuple(target)) {
                 // 1. Fetch Address Text (Only if not set)
                 if (!destinationAddress) {
                    const addr = await apiService.reverseGeocode(target, language);
                    setDestinationAddress(addr?.split(',')[0] || 'Destination');
                 }

                 // 2. Fetch Route from CURRENT Driver Position to Target
                 if (driverPosition) {
                    const { info } = await apiService.fetchRoute(driverPosition, target);
                    if (info?.route) {
                        setCurrentRoute(info.route);
                    }
                 }
            } else {
                setCurrentRoute(null);
            }
        };
        
        // Debounce route updates to save API calls
        const timer = setTimeout(updateNavigation, 1000);
        return () => clearTimeout(timer);

    }, [trip.status, trip.pickup, trip.drop, driverPosition, language]); // Removed destinationAddress dependency to allow updates

    // --- MAP DRAWING ---
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        layersRef.current.forEach(layer => map.removeLayer(layer));
        layersRef.current = [];

        // Draw Route Line
        if (currentRoute) {
            // Main Blue Line
            const routeLine = L.polyline(currentRoute, { color: '#3b82f6', weight: 8, opacity: 0.9, lineJoin: 'round', lineCap: 'round' }).addTo(map);
            // White Border for contrast
            const routeBorder = L.polyline(currentRoute, { color: 'white', weight: 12, opacity: 0.3, lineJoin: 'round', lineCap: 'round' }).addTo(map);
            routeBorder.bringToBack();
            
            layersRef.current.push(routeLine, routeBorder);
        }

        // Draw Driver
        if (driverPosition) {
            if (!driverMarkerRef.current) {
                driverMarkerRef.current = L.marker(driverPosition, { icon: driverIcon, zIndexOffset: 1000 }).addTo(map);
            } else {
                 driverMarkerRef.current.setLatLng(driverPosition);
                 driverMarkerRef.current.setZIndexOffset(1000);
            }
             // Navigation Mode: Keep driver centered slightly lower for "perspective" feel
             // map.panTo(driverPosition, { animate: true, duration: 0.5 });
             // Or just simple center:
             map.setView(driverPosition, map.getZoom(), { animate: true });
        }
        
        // Add Target Marker (Pickup or Drop)
        const target = trip.status === 'accepted' ? trip.pickup : trip.drop;
        if (target && isValidLatLngTuple(target)) {
             const pinColor = trip.status === 'accepted' ? 'text-green-600' : 'text-red-600';
             const pinIcon = L.divIcon({ html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-12 h-12 ${pinColor} drop-shadow-xl filter"><path fill-rule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 001.144-.742 19.58 19.58 0 002.683-2.282c1.944-1.99 3.963-4.98 3.963-8.827a8.25 8.25 0 00-16.5 0c0 3.846 2.02 6.837 3.963 8.827a19.58 19.58 0 002.682 2.282 16.975 16.975 0 001.145.742zM12 13.5a3 3 0 100-6 3 3 0 000 6z" clip-rule="evenodd" /></svg>`, className: 'custom-leaflet-icon', iconSize: [48, 48], iconAnchor: [24, 48] });
             const m = L.marker(target, { icon: pinIcon }).addTo(map);
             layersRef.current.push(m);
        }

    }, [driverPosition, currentRoute, trip.status, driverIcon]);


    const handleSwipeComplete = (nextStatus: Booking['status']) => {
        driverBackgroundService.setActiveTripStatus(nextStatus);
        onTripUpdate(nextStatus);
    };

    const handleZoomIn = () => {
        if (mapRef.current) mapRef.current.zoomIn();
    };

    const handleZoomOut = () => {
        if (mapRef.current) mapRef.current.zoomOut();
    };

    // Header instructions based on state
    const getHeaderInfo = () => {
        if (trip.status === 'accepted') return { bg: 'bg-green-600', text: t('arrivedAtPickup'), sub: `Picking up at ${destinationAddress}` };
        if (trip.status === 'arrived') return { bg: 'bg-blue-600', text: t('waitingForDriver'), sub: t('canContinue') };
        if (trip.status === 'in_progress') return { bg: 'bg-slate-800', text: t('tripInProgress'), sub: `Dropping off at ${destinationAddress}` };
        return { bg: 'bg-gray-800', text: t('tripCompleted'), sub: '' };
    };
    const header = getHeaderInfo();

    return (
        <main className="flex-1 flex flex-col h-screen relative bg-gray-900">
            {/* Map Layer */}
            <div ref={mapContainerRef} className="absolute inset-0 z-0" style={{filter: 'contrast(1.1) brightness(0.9)'}}></div>

            {/* Navigation Header */}
            <div className="absolute top-0 left-0 right-0 z-20 p-4">
                 <div className={`${header.bg} text-white p-4 rounded-xl shadow-xl flex items-start gap-4 animate-slide-down`}>
                     <div className="mt-1">
                         <ICONS.navigation className="w-8 h-8 text-white opacity-90" />
                     </div>
                     <div>
                         <h2 className="text-xl font-bold leading-tight">{header.text}</h2>
                         <p className="opacity-80 text-sm font-mono mt-1">{header.sub}</p>
                     </div>
                 </div>
            </div>

            {/* Zoom Controls */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2 z-[400] flex flex-col gap-2 pointer-events-auto">
                <button onClick={handleZoomIn} className="bg-white dark:bg-gray-800 p-3 rounded-full shadow-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path fillRule="evenodd" d="M12 3.75a.75.75 0 01.75.75v6.75h6.75a.75.75 0 010 1.5h-6.75v6.75a.75.75 0 01-1.5 0v-6.75H4.5a.75.75 0 010-1.5h6.75V4.5a.75.75 0 01.75-.75z" clipRule="evenodd" /></svg>
                </button>
                <button onClick={handleZoomOut} className="bg-white dark:bg-gray-800 p-3 rounded-full shadow-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-gray-700 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6"><path fillRule="evenodd" d="M3.75 12a.75.75 0 01.75-.75h15a.75.75 0 010 1.5h-15a.75.75 0 01-.75-.75z" clipRule="evenodd" /></svg>
                </button>
            </div>
            
            {/* Help Text for Demo */}
            <div className="absolute top-28 left-1/2 -translate-x-1/2 z-10 bg-black/50 text-white px-3 py-1 rounded-full text-xs backdrop-blur-sm pointer-events-none">
                Demo: Click map to move car
            </div>

            {/* Bottom Control Panel */}
            <div className="absolute bottom-0 left-0 right-0 z-20 p-4 bg-white dark:bg-gray-900 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.3)]">
                 {trip.status === 'accepted' && (
                     <SliderButton 
                        label={t('arrivedAtPickup')} 
                        color="bg-blue-600" 
                        onSlide={() => handleSwipeComplete('arrived')} 
                     />
                 )}
                 {trip.status === 'arrived' && (
                     <SliderButton 
                        label={t('startTrip')} 
                        color="bg-green-600" 
                        onSlide={() => handleSwipeComplete('in_progress')} 
                     />
                 )}
                 {trip.status === 'in_progress' && (
                     <SliderButton 
                        label={t('endTrip')} 
                        color="bg-red-600" 
                        onSlide={() => setIsSummaryVisible(true)} 
                     />
                 )}

                 <div className="grid grid-cols-3 gap-4 mt-6 text-center">
                     <div>
                         <p className="text-slate-400 text-xs uppercase font-bold">{t('time')}</p>
                         <p className="text-xl font-bold dark:text-white">{currentRoute ? Math.ceil(currentRoute.length / 10) : '--'} min</p>
                     </div>
                     <div>
                         <p className="text-slate-400 text-xs uppercase font-bold">{t('distance')}</p>
                         <p className="text-xl font-bold dark:text-white">{trip.distance || '--'} km</p>
                     </div>
                     <div>
                         <button className="w-full h-full bg-slate-100 dark:bg-gray-800 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-gray-700">
                             <ICONS.menu className="w-6 h-6" />
                         </button>
                     </div>
                 </div>
            </div>

            {isSummaryVisible && (
                <div className="absolute inset-0 bg-black/80 z-[3000] flex items-center justify-center p-6 backdrop-blur-sm">
                    <div className="bg-white dark:bg-gray-800 w-full max-w-sm rounded-3xl p-8 text-center">
                        <div className="w-20 h-20 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
                            <ICONS.check_circle className="w-10 h-10 text-green-600" />
                        </div>
                        <h2 className="text-2xl font-bold dark:text-white mb-2">{t('tripCompleted')}</h2>
                        <p className="text-slate-500 mb-6">$8.50 {t('earnings')}</p>
                        <button onClick={() => onTripUpdate('completed')} className="w-full bg-green-600 text-white font-bold py-4 rounded-xl text-lg hover:bg-green-700">{t('confirm')}</button>
                    </div>
                </div>
            )}
        </main>
    );
};

// Simple Mock Slider Button
const SliderButton: FC<{ label: string, color: string, onSlide: () => void }> = ({ label, color, onSlide }) => {
    return (
        <button onClick={onSlide} className={`w-full ${color} text-white font-bold text-lg py-4 rounded-xl shadow-lg active:scale-[0.98] transition-transform flex items-center justify-center gap-2`}>
            <span>{label}</span>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 animate-pulse"><path fillRule="evenodd" d="M12.97 3.97a.75.75 0 011.06 0l7.5 7.5a.75.75 0 010 1.06l-7.5 7.5a.75.75 0 11-1.06-1.06l6.22-6.22H3a.75.75 0 010-1.5h16.19l-6.22-6.22a.75.75 0 010-1.06z" clipRule="evenodd" /></svg>
        </button>
    )
}

export default ActiveTripView;
