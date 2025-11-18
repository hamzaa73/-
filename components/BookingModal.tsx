
import React, { useState, useCallback, FC, useEffect, useRef, useMemo } from 'react';
import { useLocalization } from '../contexts/LocalizationContext';
// FIX: Import translations to be used in the findOriginalKey function.
import { ICONS, allServices, serviceCategories, serviceSuggestions, translations } from '../constants';
import { Booking, LatLngTuple, RouteInfo } from '../types';
import { dbService, apiService } from '../services/index';
import MapPicker from './MapPicker';

declare const L: any; // Using Leaflet from CDN

// Helper to validate coordinates
const isValidLatLngTuple = (coord: any): coord is LatLngTuple => {
    return Array.isArray(coord) && coord.length === 2 && typeof coord[0] === 'number' && typeof coord[1] === 'number';
};

interface BookingModalProps {
  onClose: () => void;
  onSave: () => void;
}

const BookingModal: FC<BookingModalProps> = ({ onClose, onSave }) => {
  const { t, translateOrShowOriginal } = useLocalization();
  const [currentStep, setCurrentStep] = useState(0);

  // State for booking data
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [customService, setCustomService] = useState('');
  const [cargoType, setCargoType] = useState('');
  const [size, setSize] = useState('');
  const [weight, setWeight] = useState('');
  const [preference, setPreference] = useState<string | null>(null);
  const [scheduledTime, setScheduledTime] = useState('');
  const [pickup, setPickup] = useState<LatLngTuple | null>(null);
  const [drop, setDrop] = useState<LatLngTuple | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);

  const handleServiceSelection = (service: string) => {
    if (service !== selectedService) {
        setCargoType('');
        setSize('');
        setWeight('');
        if (service !== 'otherService') {
          setCustomService('');
        }
    }
    setSelectedService(service);
  };

  const resetState = () => {
      setSelectedService(null);
      setCustomService('');
      setCargoType('');
      setSize('');
      setWeight('');
      setPreference(null);
      setScheduledTime('');
      setPickup(null);
      setDrop(null);
      setRouteInfo(null);
      setCurrentStep(0);
  };
  
  const handleClose = () => {
      resetState();
      onClose();
  };

  const handleSave = async () => {
    const originalCargo = findOriginalKey(cargoType);
    const originalSize = findOriginalKey(size);

    const newBooking: Booking = {
        id: new Date().toISOString(),
        service: selectedService === 'otherService' ? customService : selectedService!,
        cargoType: originalCargo,
        size: originalSize,
        weight: weight,
        preference: findOriginalKey(preference!),
        scheduledTime: preference === 'scheduleTrip' ? scheduledTime : undefined,
        distance: routeInfo?.distance.toFixed(1),
        duration: routeInfo?.duration.toFixed(0),
        pickup,
        drop,
        route: routeInfo?.route,
        time: new Date().toISOString(),
        status: 'pending', // Set initial status
        driverId: null,
    };

    // Use dbService to save booking (handles both Firebase and LocalStorage fallback)
    await dbService.createBooking(newBooking);
    
    onSave();
    handleClose();
    alert(t('bookingSaved'));
  };
  
  const findOriginalKey = (value: string): string => {
    if (!value) return value;
    const allEntries = Object.entries(translations.en).concat(Object.entries(translations.ar));
    for (const [key, text] of allEntries) {
        if (text === value) return key;
    }
    return value;
  };

  const steps = [
    { title: t('stepService') },
    { title: t('stepDetails') },
    { title: t('stepLocations') },
    { title: t('stepPreferences') },
    { title: t('stepReview') },
  ];

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: return <StepService selectedService={selectedService} onSelect={handleServiceSelection} onNext={() => setCurrentStep(1)} customService={customService} setCustomService={setCustomService} />;
      case 1: return <StepDetails selectedService={selectedService} cargoType={cargoType} setCargoType={setCargoType} size={size} setSize={setSize} weight={weight} setWeight={setWeight} onNext={() => setCurrentStep(2)} onBack={() => setCurrentStep(0)} customService={customService} />;
      case 2: return <StepLocations pickup={pickup} setPickup={setPickup} drop={drop} setDrop={setDrop} routeInfo={routeInfo} setRouteInfo={setRouteInfo} onNext={() => setCurrentStep(3)} onBack={() => setCurrentStep(1)} />;
      case 3: return <StepPreferences preference={preference} setPreference={setPreference} scheduledTime={scheduledTime} setScheduledTime={setScheduledTime} onNext={() => setCurrentStep(4)} onBack={() => setCurrentStep(2)} />;
      case 4: return <StepReview booking={{ service: selectedService!, customService, cargoType, size, weight, preference, scheduledTime, pickup, drop, routeInfo }} onSave={handleSave} onBack={() => setCurrentStep(3)} />;
      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-slate-50 dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-4xl h-[95vh] max-h-[900px] flex flex-col">
        <header className="p-4 border-b border-slate-200 dark:border-gray-700 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-bold">{t('newTripBooking')}: {steps[currentStep].title}</h2>
          <button onClick={handleClose} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-gray-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </header>

        <nav className="p-4 border-b border-slate-200 dark:border-gray-700 shrink-0">
            <div className="flex items-center justify-between">
                {steps.map((step, index) => {
                    const isCompleted = index < currentStep;
                    const isCurrent = index === currentStep;
                    const circleClass = isCompleted 
                        ? 'bg-green-600' 
                        : isCurrent 
                        ? 'bg-blue-600' 
                        : 'bg-slate-300 dark:bg-gray-600';
                    const lineClass = isCompleted 
                        ? 'bg-green-600' 
                        : 'bg-slate-300 dark:bg-gray-600';

                    return (
                        <React.Fragment key={index}>
                            <div className="flex flex-col items-center">
                                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white font-bold ${circleClass}`}>
                                    {isCompleted ? '✓' : index + 1}
                                </div>
                                <p className="text-xs text-center mt-1 hidden sm:block">{step.title}</p>
                            </div>
                            {index < steps.length - 1 && <div className={`flex-1 h-1 mx-2 ${lineClass}`}></div>}
                        </React.Fragment>
                    );
                })}
            </div>
        </nav>

        <main className="flex-1 min-h-0">
          {renderStepContent()}
        </main>
      </div>
    </div>
  );
};

// --- MODALS ---

const OtherServiceModal: FC<{ onSave: (name: string) => void; onClose: () => void; }> = ({ onSave, onClose }) => {
  const { t } = useLocalization();
  const [name, setName] = useState('');

  const handleSaveClick = () => {
    if (name.trim()) {
      onSave(name.trim());
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold mb-4">{t('enterServiceName')}</h3>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('serviceName')}
          className="w-full p-2 border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <div className="mt-6 flex gap-4">
          <button onClick={onClose} className="w-full bg-slate-200 dark:bg-gray-600 font-bold py-3 rounded-lg">{t('close')}</button>
          <button onClick={handleSaveClick} disabled={!name.trim()} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg disabled:bg-slate-300 dark:disabled:bg-gray-600">{t('save')}</button>
        </div>
      </div>
    </div>
  );
};


// --- STEP COMPONENTS ---

const StepService: FC<{
    selectedService: string | null;
    onSelect: (service: string) => void;
    onNext: () => void;
    customService: string;
    setCustomService: (name: string) => void;
}> = ({ selectedService, onSelect, onNext, customService, setCustomService }) => {
    const { t } = useLocalization();
    const [activeCategory, setActiveCategory] = useState<keyof typeof serviceCategories>('lightTransport');
    const [isOtherModalOpen, setIsOtherModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    
    const categories = Object.keys(serviceCategories) as (keyof typeof serviceCategories)[];

    const handleSelectService = (serviceKey: string) => {
        if (serviceKey === 'otherService') {
            setIsOtherModalOpen(true);
        } else {
            onSelect(serviceKey);
        }
    };

    const handleSaveCustomService = (name: string) => {
        setCustomService(name);
        onSelect('otherService');
        setIsOtherModalOpen(false);
    };

    const handleCategoryClick = (catKey: keyof typeof serviceCategories) => {
        setActiveCategory(catKey);
        setSearchQuery(''); // Clear search on category change
    };

    const servicesToDisplay = useMemo(() => {
        const allServiceKeys = Object.keys(allServices);
        if (searchQuery.trim() === '') {
            return serviceCategories[activeCategory];
        } else {
            return allServiceKeys.filter(serviceKey =>
                t(serviceKey).toLowerCase().includes(searchQuery.trim().toLowerCase())
            );
        }
    }, [searchQuery, activeCategory, t]);


    return (
        <div className="flex flex-col h-full p-4 sm:p-6">
            <div className="relative mb-4 shrink-0">
                <span className="absolute inset-y-0 start-0 flex items-center ps-3 pointer-events-none">
                    <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"/></svg>
                </span>
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('searchHere')}
                    className="w-full p-3 ps-10 text-sm text-gray-900 border border-gray-300 rounded-lg bg-gray-50 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                />
            </div>
            <div className="shrink-0 mb-4 overflow-x-auto">
                <div className="flex space-x-2 border-b border-slate-200 dark:border-gray-700">
                    {categories.map(catKey => (
                        <button key={catKey} onClick={() => handleCategoryClick(catKey)} className={`px-4 py-2 text-sm font-semibold whitespace-nowrap ${activeCategory === catKey && !searchQuery ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-500 dark:text-slate-400'}`}>
                            {t(catKey)}
                        </button>
                    ))}
                </div>
            </div>
            <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4 overflow-y-auto p-1">
                {servicesToDisplay.length > 0 ? (
                    servicesToDisplay.map(serviceKey => {
                        const service = allServices[serviceKey];
                        const Icon = ICONS[service.icon];
                        const isSelected = selectedService === serviceKey;
                        const serviceName = serviceKey === 'otherService' && customService ? customService : t(serviceKey);
                        return (
                            <button key={serviceKey} onClick={() => handleSelectService(serviceKey)} className={`p-4 rounded-xl text-center transition-all transform hover:scale-105 flex flex-col justify-center items-center ${isSelected ? `bg-blue-600 text-white shadow-lg` : `bg-white dark:bg-gray-700 shadow-sm hover:shadow-md`}`}>
                                <Icon className={`w-10 h-10 mx-auto mb-2 text-${service.color}`} />
                                <h3 className="font-bold text-sm break-words">{serviceName}</h3>
                                <p className={`text-xs mt-1 ${isSelected ? 'text-blue-200' : 'text-slate-500 dark:text-slate-400'}`}>{t(`${serviceKey}Desc`)}</p>
                            </button>
                        );
                    })
                ) : (
                    <div className="col-span-full text-center py-10 text-slate-500 dark:text-slate-400">
                        {t('noResults')}
                    </div>
                )}
            </div>
            <div className="mt-6 shrink-0">
                <button onClick={onNext} disabled={!selectedService} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg disabled:bg-slate-300 disabled:cursor-not-allowed dark:disabled:bg-gray-600">
                    {t('next')}
                </button>
            </div>
            {isOtherModalOpen && <OtherServiceModal onSave={handleSaveCustomService} onClose={() => setIsOtherModalOpen(false)} />}
        </div>
    );
};


const StepDetails: FC<{ selectedService: string | null, customService: string, cargoType: string, setCargoType: (s:string)=>void, size: string, setSize: (s:string)=>void, weight: string, setWeight: (s:string)=>void, onNext: () => void, onBack: () => void }> = ({ selectedService, customService, cargoType, setCargoType, size, setSize, weight, setWeight, onNext, onBack }) => {
    const { t, translateOrShowOriginal } = useLocalization();
    const suggestions = serviceSuggestions[selectedService || 'default'];

    const cargoOptions = suggestions.cargo.map(s => t(s));
    const sizeOptions = suggestions.size.map(s => t(s));
    
    const serviceName = selectedService === 'otherService' ? customService : translateOrShowOriginal(selectedService || '');

    const isComplete = cargoType && size && weight;

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6">
            <h3 className="font-bold mb-4">{t('selectedService')}: <span className="text-blue-600">{serviceName}</span></h3>
            <div className="space-y-4">
                <InputField id="cargoType" label={t('cargoType')} value={cargoType} onChange={e => setCargoType(e.target.value)} list="cargo-list" />
                <datalist id="cargo-list">{cargoOptions.map(o => <option key={o} value={o} />)}</datalist>
                
                <InputField id="sizeCategory" label={t('sizeCategory')} value={size} onChange={e => setSize(e.target.value)} list="size-list" />
                <datalist id="size-list">{sizeOptions.map(o => <option key={o} value={o} />)}</datalist>

                <InputField id="weightKg" label={t('weightKg')} value={weight} onChange={e => setWeight(e.target.value)} list="weight-list" type="number" />
                <datalist id="weight-list">{suggestions.weight.map(o => <option key={o} value={o} />)}</datalist>
            </div>
            <div className="mt-6 flex gap-4">
                <button onClick={onBack} className="w-full bg-slate-200 dark:bg-gray-600 font-bold py-3 rounded-lg">{t('previous')}</button>
                <button onClick={onNext} disabled={!isComplete} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg disabled:bg-slate-300 dark:disabled:bg-gray-600">{t('next')}</button>
            </div>
        </div>
    );
};

const InputField: FC<{id: string, label: string, value: string, onChange: (e:React.ChangeEvent<HTMLInputElement>)=>void, list?: string, type?: string}> = ({id, label, value, onChange, list, type="text"}) => (
    <div>
        <label htmlFor={id} className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{label}</label>
        <input id={id} type={type} list={list} value={value} onChange={onChange} className="w-full p-2 border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
    </div>
);

const StepLocations: FC<{
    pickup: LatLngTuple | null;
    setPickup: (ll: LatLngTuple) => void;
    drop: LatLngTuple | null;
    setDrop: (ll: LatLngTuple) => void;
    routeInfo: RouteInfo | null;
    setRouteInfo: (ri: RouteInfo | null) => void;
    onNext: () => void;
    onBack: () => void;
}> = ({ pickup, setPickup, drop, setDrop, routeInfo, setRouteInfo, onNext, onBack }) => {
    const { t } = useLocalization();
    const [isSelecting, setIsSelecting] = useState<'pickup' | 'drop' | null>(null);
    const [routeError, setRouteError] = useState<string | null>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any | null>(null);
    
    const [fastestRoute, setFastestRoute] = useState<RouteInfo | null>(null);
    const [shortestRoute, setShortestRoute] = useState<RouteInfo | null>(null);
    const [routePreference, setRoutePreference] = useState<'fastest' | 'shortest'>('fastest');
    const [isFetchingInitialRoute, setIsFetchingInitialRoute] = useState(false);
    const [isFetchingToggleRoute, setIsFetchingToggleRoute] = useState(false);
    const [routeMessage, setRouteMessage] = useState<string | null>(null);

    const activeRoute = routePreference === 'fastest' ? fastestRoute : shortestRoute;
    const isFetchingRoute = isFetchingInitialRoute || isFetchingToggleRoute;

    // Effect to pass the active route up to the parent modal
    useEffect(() => {
        setRouteInfo(activeRoute);
    }, [activeRoute, setRouteInfo]);

    // Initial fetch for the FASTEST route when locations change
    useEffect(() => {
        if (pickup && drop) {
            const fetchInitialRoute = async () => {
                setIsFetchingInitialRoute(true);
                setRouteError(null);
                setFastestRoute(null);
                setShortestRoute(null);
                setRoutePreference('fastest');

                const { info, error } = await apiService.fetchRoute(pickup, drop, 'fastest');
                
                setFastestRoute(info);
                if (error) {
                    setRouteError(error);
                }
                setIsFetchingInitialRoute(false);
            };
            fetchInitialRoute();
        } else {
            setFastestRoute(null);
            setShortestRoute(null);
            setRouteError(null);
        }
    }, [pickup, drop]);

    // Effect to clear the route message after a delay.
    useEffect(() => {
        if (routeMessage) {
            const timer = setTimeout(() => {
                setRouteMessage(null);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [routeMessage]);

    // --- MAP LIFECYCLE MANAGEMENT ---
    useEffect(() => {
        if (isSelecting) {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
            return;
        }

        if (mapContainerRef.current && !mapRef.current) {
            const map = L.map(mapContainerRef.current).setView([15.3694, 44.1910], 7);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(map);
            mapRef.current = map;
        }
    }, [isSelecting]);

    // Update map markers, route, and view based on pickup/drop changes
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        // Clear all layers before redrawing
        map.eachLayer((layer: any) => {
            if (!!layer.toGeoJSON) { // A way to identify vector layers like markers/polylines
                map.removeLayer(layer);
            }
        });
        
        // Re-add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);


        const pickupIcon = L.divIcon({
            html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8 text-green-600 drop-shadow-md"><path fill-rule="evenodd" d="M12 2.25c-3.96 0-7.25 3.29-7.25 7.25 0 4.5 7.25 11.25 7.25 11.25s7.25-6.75 7.25-11.25C19.25 5.54 15.96 2.25 12 2.25zm0 9.75a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" clip-rule="evenodd"></path></svg>`,
            className: 'custom-leaflet-icon',
            iconSize: [32, 32],
            iconAnchor: [16, 32],
        });

        const dropIcon = L.divIcon({
            html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8 text-blue-600 drop-shadow-md"><path fill-rule="evenodd" d="M12 2.25c-3.96 0-7.25 3.29-7.25 7.25 0 4.5 7.25 11.25 7.25 11.25s7.25-6.75 7.25-11.25C19.25 5.54 15.96 2.25 12 2.25zm0 9.75a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" clip-rule="evenodd"></path></svg>`,
            className: 'custom-leaflet-icon',
            iconSize: [32, 32],
            iconAnchor: [16, 32],
        });

        if (pickup) {
            L.marker(pickup, { icon: pickupIcon }).addTo(map);
        }
        if (drop) {
            L.marker(drop, { icon: dropIcon }).addTo(map);
        }
        if (activeRoute?.route) {
            const routeColor = routePreference === 'shortest' ? '#9333ea' : '#2563eb'; // Purple for shortest, blue for fastest
            L.polyline(activeRoute.route, { color: routeColor, weight: 5 }).addTo(map);
        }
        
        if (pickup && drop) {
            const bounds = L.latLngBounds([pickup, drop]);
            map.fitBounds(bounds.pad(0.2));
        } else if (pickup) {
            map.setView(pickup, 13);
        } else if (drop) {
            map.setView(drop, 13);
        }

        const timer = setTimeout(() => map.invalidateSize(), 100);
        return () => clearTimeout(timer);

    }, [pickup, drop, activeRoute, routePreference]);

    const handleToggleRoutePreference = async () => {
        if (!pickup || !drop) return;
        const newPreference = routePreference === 'fastest' ? 'shortest' : 'fastest';
        const isSwitchingToShortest = newPreference === 'shortest';
    
        const currentRoute = isSwitchingToShortest ? fastestRoute : shortestRoute;
        let targetRoute = isSwitchingToShortest ? shortestRoute : fastestRoute;
    
        if (targetRoute) {
            setRoutePreference(newPreference);
        } else {
            setIsFetchingToggleRoute(true);
            setRouteError(null);
            const { info, error } = await apiService.fetchRoute(pickup, drop, newPreference);
            
            if (info) {
                if (isSwitchingToShortest) setShortestRoute(info);
                else setFastestRoute(info);
                targetRoute = info;
                setRoutePreference(newPreference);
            } else if (error) {
                setRouteError(error);
            }
            setIsFetchingToggleRoute(false);
        }
        
        if (currentRoute && targetRoute && currentRoute.distance.toFixed(1) === targetRoute.distance.toFixed(1)) {
            setRouteMessage(t('fastestAndShortestAreSame'));
        } else {
            setRouteMessage(t(newPreference === 'shortest' ? 'showingShortestRoute' : 'showingFastestRoute'));
        }
    };

    const handleLocationSelect = (latlng: LatLngTuple) => {
        if (isSelecting === 'pickup') setPickup(latlng);
        if (isSelecting === 'drop') setDrop(latlng);
        setIsSelecting(null);
    };

    if (isSelecting) {
        return <MapPicker onSelect={handleLocationSelect} onBack={() => setIsSelecting(null)} isPickup={isSelecting === 'pickup'} />;
    }

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6 flex flex-col">
            <div className="flex-1">
                 <div className="relative">
                    <div ref={mapContainerRef} className="w-full h-56 md:h-64 rounded-lg bg-slate-200 dark:bg-gray-600 mb-4 border border-slate-300 dark:border-gray-500 overflow-hidden"></div>
                    {routeMessage && (
                        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[401] p-2 bg-black/70 text-white text-xs rounded-full shadow-lg transition-opacity duration-300">
                            {routeMessage}
                        </div>
                    )}
                    <button
                        onClick={handleToggleRoutePreference}
                        disabled={!pickup || !drop || isFetchingRoute}
                        className="absolute bottom-5 end-2 z-[401] p-2 bg-white dark:bg-gray-700 rounded-full shadow-lg hover:bg-slate-100 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-wait"
                        title={t('findShortestRoute')}
                    >
                        {isFetchingToggleRoute ? (
                            <div className="w-6 h-6 border-2 border-slate-400 border-t-blue-600 rounded-full animate-spin"></div>
                        ) : (
                            <ICONS.directions className="w-6 h-6 text-blue-600" />
                        )}
                    </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <LocationButton title={t('selectPickupLocation')} location={pickup} onClick={() => setIsSelecting('pickup')} />
                    <LocationButton title={t('selectDropLocation')} location={drop} onClick={() => setIsSelecting('drop')} />
                </div>
                {activeRoute && (
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 rounded-lg text-center font-semibold">
                        {t('distanceTime')}: {activeRoute.distance.toFixed(1)} {t('km')} • {activeRoute.duration.toFixed(0)} {t('minutes')}
                    </div>
                )}
                {routeError && <p className="text-center text-amber-600 dark:text-amber-400 mt-2 font-semibold">{routeError}</p>}
            </div>

            <div className="mt-6 flex gap-4">
                <button onClick={onBack} className="w-full bg-slate-200 dark:bg-gray-600 font-bold py-3 rounded-lg">{t('previous')}</button>
                <button onClick={onNext} disabled={!pickup || !drop} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg disabled:bg-slate-300 dark:disabled:bg-gray-600">{t('next')}</button>
            </div>
        </div>
    );
};

const LocationButton: FC<{title: string, location: LatLngTuple | null, onClick: ()=>void}> = ({title, location, onClick}) => (
    <button onClick={onClick} className="p-4 border-2 border-dashed border-slate-300 dark:border-gray-600 rounded-lg hover:border-blue-500 hover:bg-slate-100 dark:hover:bg-gray-700 text-center transition-colors">
        <h4 className="font-bold">{title}</h4>
        {location ? (
            <p className="text-sm text-green-600 dark:text-green-400 mt-1">{`Lat: ${location[0].toFixed(3)}, Lng: ${location[1].toFixed(3)}`}</p>
        ) : (
            <p className="text-sm text-slate-500 mt-1">Click to select</p>
        )}
    </button>
);


const StepPreferences: FC<{
    preference: string | null;
    setPreference: (p: string) => void;
    scheduledTime: string;
    setScheduledTime: (t: string) => void;
    onNext: () => void;
    onBack: () => void;
}> = ({ preference, setPreference, scheduledTime, setScheduledTime, onNext, onBack }) => {
    const { t } = useLocalization();

    const options = ['fastDelivery', 'safePackaging', 'scheduleTrip'];
    
    // Validation logic: Next button is enabled if a preference is selected,
    // and if 'scheduleTrip' is chosen, a time must also be entered.
    const isComplete = preference !== null && (preference !== 'scheduleTrip' || (preference === 'scheduleTrip' && scheduledTime !== ''));

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6">
            <h3 className="font-bold mb-4">{t('tripPreferences')}</h3>
            <div className="space-y-3">
                {options.map(optionKey => (
                    <div key={optionKey}>
                        <RadioOption
                            label={t(optionKey)}
                            name="preference"
                            value={optionKey}
                            checked={preference === optionKey}
                            onChange={() => setPreference(optionKey)}
                        />
                        {optionKey === 'scheduleTrip' && preference === 'scheduleTrip' && (
                            <div className="mt-2 ms-10">
                                <input
                                    type="time"
                                    value={scheduledTime}
                                    onChange={e => setScheduledTime(e.target.value)}
                                    className="w-full p-2 border border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                        )}
                    </div>
                ))}
            </div>
            <div className="mt-6 flex gap-4">
                <button onClick={onBack} className="w-full bg-slate-200 dark:bg-gray-600 font-bold py-3 rounded-lg">{t('previous')}</button>
                <button onClick={onNext} disabled={!isComplete} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg disabled:bg-slate-300 dark:disabled:bg-gray-600">{t('next')}</button>
            </div>
        </div>
    );
};

const RadioOption: FC<{label: string, name: string, value: string, checked: boolean, onChange: (e:React.ChangeEvent<HTMLInputElement>)=>void}> = ({label, name, value, checked, onChange}) => (
    <label className="flex items-center gap-3 p-3 bg-white dark:bg-gray-700 rounded-lg cursor-pointer">
        <input 
            type="radio" 
            name={name}
            value={value}
            checked={checked} 
            onChange={onChange} 
            className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300"
        />
        <span className="font-medium">{label}</span>
    </label>
);


const StepReview: FC<{ booking: { service: string, customService: string, cargoType: string, size: string, weight: string, preference: string | null, scheduledTime?: string, pickup: LatLngTuple | null, drop: LatLngTuple | null, routeInfo: RouteInfo | null }; onSave: () => void; onBack: () => void }> = ({ booking, onSave, onBack }) => {
    const { t, translateOrShowOriginal } = useLocalization();
    const { service, customService, cargoType, size, weight, preference, scheduledTime, pickup, drop, routeInfo } = booking;
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<any | null>(null);
    const layersRef = useRef<any[]>([]);

    const serviceToDisplay = service === 'otherService' ? customService : translateOrShowOriginal(service);

    // Effect to initialize and clean up the map instance
    useEffect(() => {
        if (mapContainerRef.current && !mapRef.current) {
            const map = L.map(mapContainerRef.current, {
                zoomControl: false,
                scrollWheelZoom: false,
                dragging: false,
                touchZoom: false,
                doubleClickZoom: false,
            });
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
            mapRef.current = map;
        }

        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, []);

    // Effect to update map content (pins, route)
    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;
        
        layersRef.current.forEach(layer => map.removeLayer(layer));
        layersRef.current = [];

        if (isValidLatLngTuple(pickup) && isValidLatLngTuple(drop)) {
            const pickupIcon = L.divIcon({
                html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8 text-green-600 drop-shadow-md"><path fill-rule="evenodd" d="M12 2.25c-3.96 0-7.25 3.29-7.25 7.25 0 4.5 7.25 11.25 7.25 11.25s7.25-6.75 7.25-11.25C19.25 5.54 15.96 2.25 12 2.25zm0 9.75a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" clip-rule="evenodd"></path></svg>`,
                className: 'custom-leaflet-icon', iconSize: [32, 32], iconAnchor: [16, 32],
            });

            const dropIcon = L.divIcon({
                html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-8 h-8 text-blue-600 drop-shadow-md"><path fill-rule="evenodd" d="M12 2.25c-3.96 0-7.25 3.29-7.25 7.25 0 4.5 7.25 11.25 7.25 11.25s7.25-6.75 7.25-11.25C19.25 5.54 15.96 2.25 12 2.25zm0 9.75a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" clip-rule="evenodd"></path></svg>`,
                className: 'custom-leaflet-icon', iconSize: [32, 32], iconAnchor: [16, 32],
            });

            const pickupMarker = L.marker(pickup, { icon: pickupIcon }).addTo(map);
            layersRef.current.push(pickupMarker);
            
            const dropMarker = L.marker(drop, { icon: dropIcon }).addTo(map);
            layersRef.current.push(dropMarker);

            if (routeInfo?.route) {
                const routeLine = L.polyline(routeInfo.route, { color: '#2563eb', weight: 5 }).addTo(map);
                layersRef.current.push(routeLine);
            }

            const bounds = L.latLngBounds([pickup, drop]);
            
            const handle = requestAnimationFrame(() => {
                if (mapRef.current) {
                    map.invalidateSize();
                    map.fitBounds(bounds.pad(0.2));
                }
            });

            return () => {
                cancelAnimationFrame(handle);
            };
        }
    }, [pickup, drop, routeInfo]);


    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                <h3 className="font-bold mb-4">{t('orderReview')}</h3>
                <div ref={mapContainerRef} className="w-full h-48 rounded-lg bg-slate-200 dark:bg-gray-600 mb-4 border border-slate-300 dark:border-gray-500 overflow-hidden"></div>
                <div className="space-y-2 p-4 bg-white dark:bg-gray-700 rounded-lg">
                    <ReviewItem label={t('service')} value={serviceToDisplay} />
                    <ReviewItem label={t('cargoType')} value={translateOrShowOriginal(cargoType)} />
                    <ReviewItem label={t('sizeCategory')} value={translateOrShowOriginal(size)} />
                    <ReviewItem label={t('weightKg')} value={weight} />
                    {preference && <ReviewItem label={t('preference')} value={translateOrShowOriginal(preference)} />}
                    {preference === 'scheduleTrip' && scheduledTime && <ReviewItem label={t('time')} value={scheduledTime} />}
                    {routeInfo && <ReviewItem label={t('distance')} value={`${routeInfo.distance.toFixed(1)} ${t('km')}`} />}
                    {routeInfo && <ReviewItem label={t('duration')} value={`${routeInfo.duration.toFixed(0)} ${t('minutes')}`} />}
                </div>
            </div>
            <div className="shrink-0 p-4 sm:p-6 border-t border-slate-200 dark:border-gray-700">
                <div className="flex gap-4">
                    <button onClick={onBack} className="w-full bg-slate-200 dark:bg-gray-600 font-bold py-3 rounded-lg">{t('previous')}</button>
                    <button onClick={onSave} className="w-full bg-green-600 text-white font-bold py-3 rounded-lg">{t('confirmBooking')}</button>
                </div>
            </div>
        </div>
    );
};

const ReviewItem: FC<{label: string, value: string}> = ({label, value}) => (
    <div className="flex justify-between items-center py-2 border-b border-slate-100 dark:border-gray-600 last:border-0">
        <p className="text-slate-500 dark:text-slate-400">{label}</p>
        <p className="font-semibold">{value}</p>
    </div>
);


export default BookingModal;
