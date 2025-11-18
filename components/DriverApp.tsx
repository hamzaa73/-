
import React, { useState, useEffect, FC, useMemo, useRef } from 'react';
import { useLocalization } from '../contexts/LocalizationContext';
import { ICONS, allServices } from '../constants';
import { Booking, LatLngTuple } from '../types';
import { dbService, driverBackgroundService } from '../services/index';
import ActiveTripView from './ActiveTripView';
import RequestCard from './RequestCard';


declare const L: any; // Using Leaflet from CDN

const DRIVER_HISTORY_KEY = 'driver_trip_history';

// --- COMPONENTS (Visual components remain mostly same, Logic updated below) ---

const DriverTopBar: FC<{ isOnline: boolean; earnings: number; rating: number }> = ({ isOnline, earnings, rating }) => {
    const { t } = useLocalization();
    return (
        <div className="absolute top-0 left-0 right-0 z-[500] p-4 flex justify-between items-start pointer-events-none">
            <div className="bg-slate-900/90 text-white backdrop-blur-md rounded-full px-4 py-2 shadow-lg flex items-center gap-3 pointer-events-auto">
                <div className="bg-yellow-500 rounded-full p-1">
                     <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 text-black"><path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" /></svg>
                </div>
                <span className="font-bold">{rating.toFixed(1)}</span>
            </div>

            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-2xl p-3 shadow-lg text-center min-w-[100px] pointer-events-auto border border-slate-200 dark:border-gray-700">
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">{t('dailyEarnings')}</p>
                <p className="text-xl font-bold text-green-600 dark:text-green-400">${earnings.toFixed(2)}</p>
            </div>
        </div>
    );
};

const GoButton: FC<{ isOnline: boolean; onClick: () => void }> = ({ isOnline, onClick }) => {
    const { t } = useLocalization();
    return (
        <div className="flex justify-center mb-6">
            <button 
                onClick={onClick}
                className={`
                    w-24 h-24 rounded-full shadow-2xl border-4 flex items-center justify-center transition-all duration-300 transform active:scale-95
                    ${isOnline 
                        ? 'bg-red-500 border-red-200 dark:border-red-900 hover:bg-red-600 text-white' 
                        : 'bg-blue-600 border-blue-200 dark:border-blue-900 hover:bg-blue-700 text-white'}
                `}
            >
                <span className="font-bold text-xl uppercase tracking-widest">
                    {isOnline ? t('offline') : t('online')}
                </span>
            </button>
        </div>
    );
};

const StatusIndicator: FC<{ isOnline: boolean }> = ({ isOnline }) => {
    const { t } = useLocalization();
    if (!isOnline) return <div className="text-center text-slate-500 font-medium pb-4">{t('youAreOffline')}</div>;

    return (
        <div className="flex flex-col items-center justify-center pb-6">
            <div className="relative w-16 h-16 flex items-center justify-center mb-2">
                <div className="absolute inset-0 bg-blue-500/20 rounded-full animate-ping"></div>
                <div className="absolute inset-2 bg-blue-500/40 rounded-full animate-pulse"></div>
                <ICONS.search className="w-6 h-6 text-blue-600 relative z-10" />
            </div>
            <p className="text-slate-600 dark:text-slate-300 font-medium animate-pulse">{t('searching')}</p>
        </div>
    );
}


const TripHistoryItem: FC<{ booking: Booking }> = ({ booking }) => {
    const { t, translateOrShowOriginal } = useLocalization();
    const price = ((parseFloat(booking.distance || '0') * 0.5) + 2).toFixed(2);

    return (
        <div className="flex items-center justify-between p-3 border-b border-slate-100 dark:border-gray-700 last:border-0">
            <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full bg-slate-100 dark:bg-gray-700 flex items-center justify-center text-slate-500`}>
                     <span className="text-xs font-bold">{new Date(booking.time).getHours()}:{new Date(booking.time).getMinutes().toString().padStart(2, '0')}</span>
                </div>
                <div>
                    <p className="font-bold text-sm text-slate-800 dark:text-slate-200">{translateOrShowOriginal(booking.service)}</p>
                    <p className="text-xs text-slate-500">{booking.distance} {t('km')} • {t('completed')}</p>
                </div>
            </div>
            <p className="font-bold text-green-600 dark:text-green-400">${price}</p>
        </div>
    );
};

const DriverDashboard: FC<{ 
    isOnline: boolean;
    pendingRequests: Booking[]; 
    tripHistory: Booking[];
    onAccept: (id: string) => void;
    onDecline: (id: string) => void;
    onToggleOnline: () => void;
    driverPosition: LatLngTuple | null;
    earnings: number;
}> = ({ isOnline, pendingRequests, tripHistory, onAccept, onDecline, onToggleOnline, driverPosition, earnings }) => {
    const { t } = useLocalization();
    const [activeTab, setActiveTab] = useState<'requests' | 'earnings'>('requests');
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const driverMarkerRef = useRef<any>(null);

     const driverIcon = useMemo(() => L.divIcon({
        html: `<div class="relative">
                 <div class="absolute -inset-2 bg-blue-500/30 rounded-full animate-pulse"></div>
                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-10 h-10 text-blue-600 drop-shadow-lg relative z-10"><path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5S6.83 18.5 6 18.5zm12 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5S18.83 18.5 18 18.5zM17 12H3V6h10v4h4l3 4z"/></svg>
               </div>`,
        className: 'custom-leaflet-icon', iconSize: [40, 40], iconAnchor: [20, 40],
    }), []);

    useEffect(() => {
        if (mapContainerRef.current && !mapRef.current) {
            mapRef.current = L.map(mapContainerRef.current, { zoomControl: false, attributionControl: false }).setView(driverPosition || [15.3694, 44.1910], 13);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapRef.current);
        }
    }, [driverPosition]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        if (driverPosition) {
            if (!driverMarkerRef.current) {
                driverMarkerRef.current = L.marker(driverPosition, { icon: driverIcon }).addTo(map);
            } else {
                driverMarkerRef.current.setLatLng(driverPosition);
            }
            map.panTo(driverPosition, { animate: true, duration: 1.0 });
        }
        
        if (mapContainerRef.current) {
            mapContainerRef.current.style.filter = isOnline ? 'none' : 'grayscale(100%) brightness(90%)';
        }

    }, [driverPosition, driverIcon, isOnline]);


    return (
       <div className="flex-1 flex flex-col relative h-screen overflow-hidden">
            <div ref={mapContainerRef} className="absolute inset-0 z-0 bg-slate-200 dark:bg-gray-600 transition-all duration-500"></div>
            
            <DriverTopBar isOnline={isOnline} earnings={earnings} rating={4.8} />

            <div className="absolute bottom-0 left-0 right-0 z-10 flex flex-col justify-end pointer-events-none h-full">
                <div className="pointer-events-auto relative z-20 translate-y-8">
                    <GoButton isOnline={isOnline} onClick={onToggleOnline} />
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.2)] p-6 pb-8 min-h-[200px] pointer-events-auto transition-all duration-300 ease-in-out">
                    
                    {!isOnline ? (
                         <div className="text-center pt-4 pb-2">
                            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">{t('youAreOffline')}</h3>
                            <p className="text-slate-500 dark:text-slate-400 text-sm max-w-xs mx-auto">{t('goOnlineMessage')}</p>
                         </div>
                    ) : (
                        <>
                            <div className="flex gap-4 mb-6 border-b border-slate-100 dark:border-gray-700">
                                <button onClick={() => setActiveTab('requests')} className={`pb-2 font-bold text-sm uppercase tracking-wider transition-colors ${activeTab === 'requests' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}>
                                    {t('newRequests')} {pendingRequests.length > 0 && <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full ml-1">{pendingRequests.length}</span>}
                                </button>
                                <button onClick={() => setActiveTab('earnings')} className={`pb-2 font-bold text-sm uppercase tracking-wider transition-colors ${activeTab === 'earnings' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-400'}`}>
                                    {t('earnings')}
                                </button>
                            </div>

                            <div className="min-h-[150px] max-h-[40vh] overflow-y-auto custom-scrollbar">
                                {activeTab === 'requests' && (
                                    pendingRequests.length > 0 ? (
                                        <div className="space-y-4">
                                            {pendingRequests.map((req, index) => (
                                                <RequestCard key={req.id} booking={req} onAccept={onAccept} onDecline={onDecline} index={index}/>
                                            ))}
                                        </div>
                                    ) : (
                                        <StatusIndicator isOnline={isOnline} />
                                    )
                                )}

                                {activeTab === 'earnings' && (
                                    <div>
                                        <div className="mb-4 p-4 bg-slate-50 dark:bg-gray-700/50 rounded-xl flex justify-between items-center">
                                             <div>
                                                 <p className="text-xs text-slate-500 dark:text-slate-400 uppercase">{t('activeTrips')}</p>
                                                 <p className="text-xl font-bold">{tripHistory.length}</p>
                                             </div>
                                             <div className="text-right">
                                                 <p className="text-xs text-slate-500 dark:text-slate-400 uppercase">{t('totalRevenue')}</p>
                                                 <p className="text-xl font-bold text-green-600">${earnings.toFixed(2)}</p>
                                             </div>
                                        </div>
                                        <h4 className="font-bold text-sm mb-3 text-slate-500">{t('recent')}</h4>
                                        {tripHistory.length > 0 ? (
                                            <div className="space-y-1">
                                                {tripHistory.slice(0, 5).map(trip => <TripHistoryItem key={trip.id} booking={trip} />)}
                                            </div>
                                        ) : (
                                            <p className="text-center text-slate-400 text-sm py-4">{t('noCompletedTrips')}</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
       </div>
    );
};

const DriverApp: FC = () => {
    const { language } = useLocalization();
    const [allBookings, setAllBookings] = useState<Booking[]>([]);
    const [tripHistory, setTripHistory] = useState<Booking[]>([]);
    const [isOnline, setIsOnline] = useState(driverBackgroundService.isOnline);
    const [driverPosition, setDriverPosition] = useState<LatLngTuple | null>(null);

    const activeTrip = useMemo(() => {
        return allBookings.find(b => ['accepted', 'arrived', 'in_progress'].includes(b.status)) || null;
    }, [allBookings]);

    const pendingRequests = useMemo(() => {
        return allBookings.filter(b => b.status === 'pending');
    }, [allBookings]);

    const earnings = useMemo(() => {
        return tripHistory.reduce((acc, t) => acc + (parseFloat(t.distance || '0') * 0.5 + 2), 0);
    }, [tripHistory]);

    // 1. Subscribe to Bookings (Real-time)
    useEffect(() => {
        const unsubscribe = dbService.subscribeToBookings((updatedBookings) => {
             setAllBookings(updatedBookings);
             // Reload history from local (for this demo driver) or filter from DB for specific driver ID in real app
             const history = localStorage.getItem(DRIVER_HISTORY_KEY);
             setTripHistory(history ? JSON.parse(history) : []);
        });
        return () => unsubscribe();
    }, []);

    // 2. Subscribe to Own Location (to show on map accurately)
    useEffect(() => {
        const unsubscribe = dbService.subscribeToDriverLocation("current_driver_id", (data) => {
             setIsOnline(data.driver_is_online);
             if(data.driver_lat) {
                 setDriverPosition([data.driver_lat, data.driver_lng]);
             }
        });
        return () => unsubscribe();
    }, []);

    const handleToggleOnline = () => {
        if (!isOnline) {
            driverBackgroundService.goOnline();
        } else {
            driverBackgroundService.goOffline();
        }
    };

    const updateBookingStatus = async (id: string, status: Booking['status']) => {
        // Call API/DB
        await dbService.updateBookingStatus(id, status, "current_driver_id");
        
        // Local History Logic (Demo)
        if (status === 'completed') {
             const trip = allBookings.find(b => b.id === id);
             if (trip) {
                 const newHistory = [{...trip, status}, ...tripHistory];
                 setTripHistory(newHistory);
                 localStorage.setItem(DRIVER_HISTORY_KEY, JSON.stringify(newHistory));
             }
             driverBackgroundService.setActiveTripStatus(null);
        } else {
             driverBackgroundService.setActiveTripStatus(status);
        }
    };

    const handleAccept = (id: string) => {
        if (activeTrip) return;
        updateBookingStatus(id, 'accepted');
    };
    
    const handleDecline = (id: string) => {
         // Just locally hide or update status if logic dictates
    };
    
    const handleTripUpdate = (newStatus: Booking['status']) => {
        if (activeTrip) {
            updateBookingStatus(activeTrip.id, newStatus);
        }
    };
    
    return (
        <div className={`font-sans bg-slate-100 dark:bg-gray-900 text-slate-800 dark:text-slate-200 min-h-screen transition-colors duration-300 ${language === 'ar' ? 'rtl' : 'ltr'}`}>
            <div className="max-w-4xl mx-auto flex flex-col min-h-screen relative">
                {activeTrip ? (
                    <ActiveTripView 
                        key={activeTrip.id}
                        trip={activeTrip}
                        onTripUpdate={handleTripUpdate}
                    />
                ) : (
                    <DriverDashboard
                        isOnline={isOnline}
                        pendingRequests={pendingRequests}
                        tripHistory={tripHistory}
                        onAccept={handleAccept}
                        onDecline={handleDecline}
                        onToggleOnline={handleToggleOnline}
                        driverPosition={driverPosition}
                        earnings={earnings}
                    />
                )}
            </div>
        </div>
    );
};

export default DriverApp;
