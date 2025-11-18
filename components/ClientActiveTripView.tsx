
import React, { FC, useEffect, useRef, useState, useMemo } from 'react';
import { Booking, LatLngTuple } from '../types';
import { useLocalization } from '../contexts/LocalizationContext';
import { ICONS } from '../constants';
import { dbService } from '../services/index';

declare const L: any; // Using Leaflet from CDN

// Helper to validate coordinates
const isValidLatLngTuple = (coord: any): coord is LatLngTuple => {
    return Array.isArray(coord) && coord.length === 2 && typeof coord[0] === 'number' && typeof coord[1] === 'number';
};

interface ClientActiveTripViewProps {
    trip: Booking;
}

const ClientActiveTripView: FC<ClientActiveTripViewProps> = ({ trip }) => {
    const { t } = useLocalization();
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const driverMarkerRef = useRef<any>(null);
    const staticLayersRef = useRef<any[]>([]);
    
    const [driverPosition, setDriverPosition] = useState<LatLngTuple | null>(null);
    const [driverStatus, setDriverStatus] = useState<Booking['status'] | null>(trip.status);

    const driverIcon = useMemo(() => L.divIcon({
        html: `<div class="relative">
                <div class="absolute -inset-1 bg-white rounded-full shadow-md"></div>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-10 h-10 text-blue-600 relative z-10"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11C5.84 5 5.28 5.42 5.08 6.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5S18.33 16 17.5 16zM5 11l1.5-4.5h11L19 11H5z"/></svg>
               </div>`,
        className: 'custom-leaflet-icon',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
    }), []);
    
    useEffect(() => {
        if (mapContainerRef.current && !mapRef.current) {
            mapRef.current = L.map(mapContainerRef.current, { zoomControl: false, attributionControl: false }).setView([15.3694, 44.1910], 7);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapRef.current);
        }
        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, []);

    // Subscribe to real-time driver location
    useEffect(() => {
        const unsubscribe = dbService.subscribeToDriverLocation("current_driver_id", (data) => {
            if (data.driver_status) {
                setDriverStatus(data.driver_status);
            }
            if (data.driver_lat && data.driver_lng) {
                setDriverPosition([data.driver_lat, data.driver_lng]);
            }
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const map = mapRef.current;
        if (!map || !isValidLatLngTuple(trip.pickup) || !isValidLatLngTuple(trip.drop)) return;

        staticLayersRef.current.forEach(layer => map.removeLayer(layer));
        staticLayersRef.current = [];

        const pickupIcon = L.divIcon({ html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8 text-green-600 drop-shadow-md"><path fill-rule="evenodd" d="M12 2.25c-3.96 0-7.25 3.29-7.25 7.25 0 4.5 7.25 11.25 7.25 11.25s7.25-6.75 7.25-11.25C19.25 5.54 15.96 2.25 12 2.25zm0 9.75a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" clip-rule="evenodd"></path></svg>`, className: 'custom-leaflet-icon', iconSize: [32, 32], iconAnchor: [16, 32] });
        const dropIcon = L.divIcon({ html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8 text-red-600 drop-shadow-md"><path fill-rule="evenodd" d="M12 2.25c-3.96 0-7.25 3.29-7.25 7.25 0 4.5 7.25 11.25 7.25 11.25s7.25-6.75 7.25-11.25C19.25 5.54 15.96 2.25 12 2.25zm0 9.75a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" clip-rule="evenodd"></path></svg>`, className: 'custom-leaflet-icon', iconSize: [32, 32], iconAnchor: [16, 32] });
        
        const pMarker = L.marker(trip.pickup, { icon: pickupIcon }).addTo(map);
        const dMarker = L.marker(trip.drop, { icon: dropIcon }).addTo(map);
        staticLayersRef.current.push(pMarker, dMarker);

        if (trip.route) {
            const routeLine = L.polyline(trip.route, { color: '#2563eb', weight: 5, opacity: 0.8, lineJoin: 'round' }).addTo(map);
            staticLayersRef.current.push(routeLine);
        }
    }, [trip]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        if (driverPosition) {
            if (!driverMarkerRef.current) {
                driverMarkerRef.current = L.marker(driverPosition, { icon: driverIcon, zIndexOffset: 1000 }).addTo(map);
            } else {
                driverMarkerRef.current.setLatLng(driverPosition);
            }
        }
        
        if (driverPosition && isValidLatLngTuple(trip.pickup)) {
             const bounds = L.latLngBounds([driverPosition, trip.pickup]);
             if (driverStatus === 'in_progress' && isValidLatLngTuple(trip.drop)) {
                 bounds.extend(trip.drop);
             }
             map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16, animate: true });
        } else if (staticLayersRef.current.length > 0 && !driverPosition) {
             const bounds = L.latLngBounds([]);
             if (isValidLatLngTuple(trip.pickup)) bounds.extend(trip.pickup);
             if (isValidLatLngTuple(trip.drop)) bounds.extend(trip.drop);
             map.fitBounds(bounds.pad(0.2));
        }

    }, [driverPosition, trip, driverIcon, driverStatus]);

    const handleZoomIn = () => {
        if (mapRef.current) mapRef.current.zoomIn();
    };

    const handleZoomOut = () => {
        if (mapRef.current) mapRef.current.zoomOut();
    };

    const getStatusInfo = () => {
        switch (driverStatus) {
            case 'accepted': return { text: t('driverOnTheWay'), color: 'bg-blue-600', subText: '4 min' };
            case 'arrived': return { text: t('arrivedAtPickup'), color: 'bg-green-600', subText: t('now') };
            case 'in_progress': return { text: t('tripInProgress'), color: 'bg-slate-800', subText: '15 min' };
            default: return { text: t('waitingForDriver'), color: 'bg-slate-500', subText: '...' };
        }
    };
    const statusInfo = getStatusInfo();

    return (
        <main className="flex-1 flex flex-col h-screen relative overflow-hidden bg-slate-100 dark:bg-gray-900">
             <div className="absolute top-4 left-4 right-4 z-[400] flex justify-center pointer-events-none">
                <div className={`${statusInfo.color} text-white px-6 py-3 rounded-full shadow-xl flex items-center gap-3 pointer-events-auto`}>
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                    <div>
                        <p className="text-sm font-bold leading-none">{statusInfo.text}</p>
                        {statusInfo.subText && <p className="text-[10px] opacity-80 leading-none mt-1">{t('time')}: {statusInfo.subText}</p>}
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

             <div ref={mapContainerRef} className="absolute inset-0 z-0"></div>
             
             <div className="absolute bottom-0 left-0 right-0 z-[500] p-4 pb-6">
                <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.1)] p-5 border border-slate-100 dark:border-gray-700">
                    <div className="flex items-center gap-4 mb-6">
                         <div className="relative">
                            <div className="w-16 h-16 rounded-full bg-slate-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
                                <ICONS.people className="w-10 h-10 text-slate-400" />
                            </div>
                            <div className="absolute -bottom-1 -right-1 bg-yellow-400 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center border-2 border-white dark:border-gray-800">
                                <span>★ 4.9</span>
                            </div>
                         </div>
                         
                         <div className="flex-1">
                             <h3 className="text-lg font-bold text-slate-900 dark:text-white">{t('mockDriverName')}</h3>
                             <p className="text-sm text-slate-500 dark:text-slate-400">{t('mockVehicle')} • <span className="bg-slate-100 dark:bg-gray-700 px-1.5 rounded text-slate-700 dark:text-slate-300 font-mono text-xs">{t('mockLicensePlate')}</span></p>
                         </div>

                         <div className="text-right">
                             <p className="text-2xl font-bold text-slate-900 dark:text-white">$8.50</p>
                             <p className="text-[10px] text-slate-400 uppercase font-bold">{t('fare')}</p>
                         </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <button className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors">
                            <ICONS.phone className="w-5 h-5" />
                            {t('callDriver')}
                        </button>
                        <button className="bg-slate-50 dark:bg-gray-700 text-slate-700 dark:text-slate-300 font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-100 dark:hover:bg-gray-600 transition-colors">
                            <ICONS.message className="w-5 h-5" />
                            {t('messageDriver')}
                        </button>
                    </div>
                </div>
             </div>
        </main>
    )
};

export default ClientActiveTripView;
