
import React, { useEffect, useRef, useState } from 'react';
import { useLocalization } from '../contexts/LocalizationContext';
import { ICONS } from '../constants';
import { Booking, DashboardStats, LatLngTuple } from '../types';
import { dbService } from '../services';

declare const L: any;

const AdminDashboard: React.FC = () => {
    const { t, direction } = useLocalization();
    const [activeTab, setActiveTab] = useState<'overview' | 'drivers' | 'trips' | 'map'>('overview');
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [activeDriverLocation, setActiveDriverLocation] = useState<LatLngTuple | null>(null);

    useEffect(() => {
        // Real-time Bookings
        const unsubBookings = dbService.subscribeToBookings((data) => {
            setBookings(data);
            // Recalc stats roughly on client for demo
            // In prod, stats usually come from a separate aggregation doc
            const completed = data.filter(b => b.status === 'completed');
            const revenue = completed.reduce((acc, curr) => acc + (parseFloat(curr.distance || '0') * 0.5 + 2), 0);
            setStats({
                totalRevenue: revenue,
                totalTrips: data.length,
                completedTrips: completed.length,
                activeDrivers: 1 // Mock active for now as we track single driver
            });
        });

        // Real-time Driver Loc
        const unsubDriver = dbService.subscribeToDriverLocation("current_driver_id", (data) => {
            if (data.driver_is_online && data.driver_lat) {
                setActiveDriverLocation([data.driver_lat, data.driver_lng]);
            } else {
                setActiveDriverLocation(null);
            }
        });

        return () => {
            unsubBookings();
            unsubDriver();
        };
    }, []);

    return (
        <div className="flex h-screen bg-slate-100 dark:bg-gray-900 overflow-hidden">
            {/* Sidebar */}
            <aside className="w-64 bg-white dark:bg-gray-800 border-r border-slate-200 dark:border-gray-700 flex flex-col">
                <div className="p-6 border-b border-slate-200 dark:border-gray-700">
                    <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400">{t('appTitle')}</h1>
                    <p className="text-xs text-slate-500 mt-1 font-semibold uppercase tracking-wider">{t('adminDashboard')}</p>
                </div>
                <nav className="flex-1 p-4 space-y-2">
                    <AdminNavItem icon="dashboard" label={t('overview')} active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
                    <AdminNavItem icon="map" label={t('liveMap')} active={activeTab === 'map'} onClick={() => setActiveTab('map')} />
                    <AdminNavItem icon="people" label={t('drivers')} active={activeTab === 'drivers'} onClick={() => setActiveTab('drivers')} />
                    <AdminNavItem icon="directions_car" label={t('trips')} active={activeTab === 'trips'} onClick={() => setActiveTab('trips')} />
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto p-8">
                {activeTab === 'overview' && <OverviewTab stats={stats} />}
                {activeTab === 'map' && <LiveMapTab driverLocation={activeDriverLocation} />}
                {activeTab === 'drivers' && <DriversTab activeDriverLocation={activeDriverLocation} />}
                {activeTab === 'trips' && <TripsTab bookings={bookings} />}
            </main>
        </div>
    );
};

const AdminNavItem: React.FC<{ icon: string, label: string, active: boolean, onClick: () => void }> = ({ icon, label, active, onClick }) => {
    const Icon = ICONS[icon] || ICONS.dashboard;
    return (
        <button 
            onClick={onClick} 
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${active ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-gray-700'}`}
        >
            <Icon className="w-5 h-5" />
            <span className="font-semibold">{label}</span>
        </button>
    );
};

// --- TABS ---

const OverviewTab: React.FC<{ stats: DashboardStats | null }> = ({ stats }) => {
    const { t } = useLocalization();
    if (!stats) return <div>Loading...</div>;

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold mb-6">{t('overview')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard icon="money" title={t('totalRevenue')} value={`$${stats.totalRevenue.toFixed(2)}`} color="bg-green-500" />
                <StatCard icon="directions_car" title={t('activeTrips')} value={stats.totalTrips - stats.completedTrips} color="bg-blue-500" />
                <StatCard icon="people" title={t('activeDrivers')} value={stats.activeDrivers} color="bg-orange-500" />
                <StatCard icon="history" title={t('completedTrips')} value={stats.completedTrips} color="bg-purple-500" />
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
                <h3 className="font-bold mb-4">{t('recent')}</h3>
                <p className="text-slate-500 text-sm">System Connected to Firebase Real-time Database.</p>
            </div>
        </div>
    );
};

const StatCard: React.FC<{ icon: string, title: string, value: string | number, color: string }> = ({ icon, title, value, color }) => {
    const Icon = ICONS[icon] || ICONS.dashboard;
    return (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm flex items-center gap-4">
            <div className={`p-4 rounded-full ${color} text-white shadow-lg`}>
                <Icon className="w-6 h-6" />
            </div>
            <div>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{title}</p>
                <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{value}</p>
            </div>
        </div>
    );
};

const LiveMapTab: React.FC<{ driverLocation: LatLngTuple | null }> = ({ driverLocation }) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any>(null);
    const markersRef = useRef<any[]>([]);
    const [ghostDrivers, setGhostDrivers] = useState<LatLngTuple[]>([]);

    useEffect(() => {
        if (ghostDrivers.length === 0) {
            const center = [15.3694, 44.1910];
            const ghosts: LatLngTuple[] = [];
            for(let i=0; i<5; i++) {
                ghosts.push([center[0] + (Math.random() - 0.5) * 0.1, center[1] + (Math.random() - 0.5) * 0.1]);
            }
            setGhostDrivers(ghosts);
        }
    }, []);

    useEffect(() => {
        if (mapContainerRef.current && !mapRef.current) {
            const map = L.map(mapContainerRef.current).setView([15.3694, 44.1910], 10);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
            mapRef.current = map;
        }
    }, []);

    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        markersRef.current.forEach(m => map.removeLayer(m));
        markersRef.current = [];

        const driverIcon = L.divIcon({
            html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8 text-blue-600 drop-shadow-lg"><path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5S6.83 18.5 6 18.5zm12 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5S18.83 18.5 18 18.5zM17 12H3V6h10v4h4l3 4z"/></svg>`,
            className: 'custom-leaflet-icon', iconSize: [32, 32], iconAnchor: [16, 16],
        });

        const ghostIcon = L.divIcon({
            html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8 text-slate-400 opacity-70"><path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5S6.83 18.5 6 18.5zm12 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5S18.83 18.5 18 18.5zM17 12H3V6h10v4h4l3 4z"/></svg>`,
            className: 'custom-leaflet-icon', iconSize: [32, 32], iconAnchor: [16, 16],
        });

        if (driverLocation) {
            const m = L.marker(driverLocation, { icon: driverIcon }).addTo(map).bindPopup('Real Driver (Active)');
            markersRef.current.push(m);
            map.panTo(driverLocation, { animate: true });
        }

        ghostDrivers.forEach(loc => {
            const m = L.marker(loc, { icon: ghostIcon }).addTo(map).bindPopup('Idle Driver');
            markersRef.current.push(m);
        });

    }, [driverLocation, ghostDrivers]);

    return (
        <div className="h-[calc(100vh-100px)] bg-slate-200 rounded-xl overflow-hidden border border-slate-300 dark:border-gray-600">
            <div ref={mapContainerRef} className="w-full h-full" />
        </div>
    );
};

const DriversTab: React.FC<{ activeDriverLocation: LatLngTuple | null }> = ({ activeDriverLocation }) => {
    const { t } = useLocalization();
    return (
        <div>
             <h2 className="text-2xl font-bold mb-6">{t('manageDrivers')}</h2>
             <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                 <table className="w-full text-left border-collapse">
                     <thead>
                         <tr className="bg-slate-50 dark:bg-gray-700 border-b border-slate-200 dark:border-gray-600 text-slate-600 dark:text-slate-300">
                             <th className="p-4">{t('driverName')}</th>
                             <th className="p-4">{t('status')}</th>
                             <th className="p-4">{t('vehicle')}</th>
                             <th className="p-4">{t('rating')}</th>
                         </tr>
                     </thead>
                     <tbody>
                         <tr className="border-b border-slate-100 dark:border-gray-700">
                             <td className="p-4 font-semibold">{t('mockDriverName')} (Real User)</td>
                             <td className="p-4">
                                 <span className={`px-2 py-1 rounded-full text-xs font-bold ${activeDriverLocation ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                     {activeDriverLocation ? 'Online' : 'Offline'}
                                 </span>
                             </td>
                             <td className="p-4">{t('mockVehicle')} - {t('mockLicensePlate')}</td>
                             <td className="p-4 text-yellow-500">★★★★★</td>
                         </tr>
                     </tbody>
                 </table>
             </div>
        </div>
    );
};

const TripsTab: React.FC<{ bookings: Booking[] }> = ({ bookings }) => {
    const { t } = useLocalization();
    return (
        <div>
            <h2 className="text-2xl font-bold mb-6">{t('trips')}</h2>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                     <thead>
                        <tr className="bg-slate-50 dark:bg-gray-700 border-b border-slate-200 dark:border-gray-600 text-slate-600 dark:text-slate-300">
                            <th className="p-4">ID</th>
                            <th className="p-4">{t('service')}</th>
                            <th className="p-4">{t('status')}</th>
                            <th className="p-4">{t('fare')}</th>
                            <th className="p-4">{t('time')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {bookings.map(b => (
                            <tr key={b.id} className="border-b border-slate-100 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-gray-700/50">
                                <td className="p-4 font-mono text-xs">{b.id.slice(0,8)}...</td>
                                <td className="p-4 font-semibold">{b.service}</td>
                                <td className="p-4">
                                     <span className={`px-2 py-1 rounded-full text-xs font-bold 
                                        ${b.status === 'completed' ? 'bg-green-100 text-green-700' : 
                                          b.status === 'cancelled' ? 'bg-red-100 text-red-700' : 
                                          'bg-blue-100 text-blue-700'}`}>
                                        {t(b.status === 'in_progress' ? 'tripInProgress' : b.status)}
                                     </span>
                                </td>
                                <td className="p-4 font-mono">${((parseFloat(b.distance || '0') * 0.5) + 2).toFixed(2)}</td>
                                <td className="p-4 text-sm text-slate-500">{new Date(b.time).toLocaleDateString()}</td>
                            </tr>
                        ))}
                        {bookings.length === 0 && (
                            <tr>
                                <td colSpan={5} className="p-8 text-center text-slate-500">{t('noResults')}</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AdminDashboard;
