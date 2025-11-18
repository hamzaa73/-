
import React, { useState, useEffect, useRef, FC } from 'react';
import { LatLngTuple, NominatimResult } from '../types';
import { geolocationService, apiService, storageService } from '../services/index';
import { useLocalization } from '../contexts/LocalizationContext';
import { ICONS } from '../constants';

declare const L: any; // Using Leaflet from CDN

interface MapPickerProps {
  onSelect: (latlng: LatLngTuple) => void;
  onBack: () => void;
  isPickup: boolean;
}

// --- ICONS ---
// Inactive state icon (outlined)
const MyLocationIcon: FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l18-9-9 18-4-7-7-4z" transform="rotate(20 12 12)" />
    </svg>
);

// Active state icon (filled)
const MyLocationIconActive: FC = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 12l18-9-9 18-4-7-7-4z" transform="rotate(20 12 12)" />
    </svg>
);


const Spinner: FC = () => (
    <div className="w-6 h-6 border-2 border-slate-400 border-t-blue-600 rounded-full animate-spin"></div>
);

// --- SEARCH OVERLAY COMPONENT ---
interface SearchOverlayProps {
  onClose: () => void;
  onSelect: (result: NominatimResult) => void;
}

const SearchOverlay: FC<SearchOverlayProps> = ({ onClose, onSelect }) => {
    const { t, language, direction } = useLocalization();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<NominatimResult[]>([]);
    const [recents, setRecents] = useState<NominatimResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    useEffect(() => {
        setRecents(storageService.loadRecentSearches());
    }, []);

    useEffect(() => {
        if (query.trim().length < 2) {
            setResults([]);
            return;
        }
        setIsSearching(true);
        const debounceTimer = setTimeout(async () => {
            const searchResults = await apiService.searchLocation(query, language);
            setResults(searchResults);
            setIsSearching(false);
        }, 500);
        return () => clearTimeout(debounceTimer);
    }, [query, language]);

    const handleSelect = (result: NominatimResult) => {
        onSelect(result);
    };

    const SearchResultItem: FC<{result: NominatimResult, isRecent?: boolean}> = ({ result, isRecent = false }) => {
        const nameParts = result.display_name.split(',');
        const mainName = nameParts[0];
        const address = nameParts.slice(1).join(',').trim();
        const Icon = isRecent ? ICONS.history : ICONS.local_shipping;

        return (
            <div onClick={() => handleSelect(result)} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-100 dark:hover:bg-gray-700/50 cursor-pointer border-b border-slate-100 dark:border-gray-700">
                <Icon className="w-6 h-6 text-slate-400" />
                <div className={`flex-1 ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{mainName}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{address}</p>
                </div>
            </div>
        )
    };

    return (
        <div className="absolute inset-0 bg-slate-50 dark:bg-gray-800 z-[2000] flex flex-col">
            <header className="p-2.5 flex items-center gap-2 border-b border-slate-200 dark:border-gray-700 shrink-0">
                <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-gray-700">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={direction === 'rtl' ? "M9 5l7 7-7 7" : "M15 19l-7-7 7-7"} /></svg>
                </button>
                <input
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder={t('searchHere')}
                    className="w-full bg-transparent p-2 focus:outline-none text-lg"
                />
                 {isSearching && <div className="w-5 h-5 border-2 border-slate-400 border-t-blue-600 rounded-full animate-spin me-2"></div>}
            </header>
            <main className="flex-1 overflow-y-auto">
                {query.length < 2 && recents.length > 0 && (
                    <div>
                        <h3 className="p-4 text-sm font-semibold text-slate-500">{t('recent')}</h3>
                        {recents.map(r => <SearchResultItem key={r.display_name} result={r} isRecent={true} />)}
                    </div>
                )}
                {results.map(r => <SearchResultItem key={r.display_name} result={r} />)}
            </main>
        </div>
    )
};


// --- MAP PICKER COMPONENT ---
const MapPicker: FC<MapPickerProps> = ({ onSelect, onBack, isPickup }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any | null>(null);
  const userLocationMarkerRef = useRef<any | null>(null);
  const selectedPinMarkerRef = useRef<any | null>(null);
  const driverMarkersRef = useRef<any[]>([]);
  const { t, language } = useLocalization();

  const [selectedLocation, setSelectedLocation] = useState<LatLngTuple | null>(null);
  const [displayAddress, setDisplayAddress] = useState('');
  const [isSearchViewOpen, setIsSearchViewOpen] = useState(false);
  const [userPhysicalLocation, setUserPhysicalLocation] = useState<LatLngTuple | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(true); // True on initial load
  const [locationMessage, setLocationMessage] = useState<{ text: string; type: 'info' | 'error' } | null>(null);
  const [currentAddress, setCurrentAddress] = useState<string | null>(null);
  const [isFetchingAddress, setIsFetchingAddress] = useState(false);
  const [hasLocationBeenManuallyUpdated, setHasLocationBeenManuallyUpdated] = useState(false);

  const areLocationsEqual = (loc1: LatLngTuple | null, loc2: LatLngTuple | null): boolean => {
    if (!loc1 || !loc2) return false;
    const tolerance = 0.00001; // Corresponds to ~1 meter accuracy
    return Math.abs(loc1[0] - loc2[0]) < tolerance && Math.abs(loc1[1] - loc2[1]) < tolerance;
  };

  const isMyLocationActive = areLocationsEqual(userPhysicalLocation, selectedLocation);

  useEffect(() => {
    const initializeMap = async () => {
      let initialCenter: LatLngTuple = [15.3694, 44.1910]; // Default to Yemen
      setIsGettingLocation(true);
      
      try {
        const position = await geolocationService.getCurrentPosition({ timeout: 10000 });
        initialCenter = [position.coords.latitude, position.coords.longitude];
        setUserPhysicalLocation(initialCenter);
      } catch (error) {
        console.warn("Could not get user location on initial load:", error);
        setLocationMessage({ text: t('couldNotGetLocation'), type: 'error' });
      } finally {
        setIsGettingLocation(false);
      }
      
      setSelectedLocation(initialCenter);

      if (mapContainerRef.current && !mapRef.current) {
        const map = L.map(mapContainerRef.current).setView(initialCenter, 13);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

        map.on('click', (e: any) => {
          const { lat, lng } = e.latlng;
          const newLocation: LatLngTuple = [lat, lng];
          setSelectedLocation(newLocation);
          setDisplayAddress(''); // Clear search-based address to allow reverse geocode to fetch new one
          setHasLocationBeenManuallyUpdated(true);
        });
        mapRef.current = map;
      }
    };
    initializeMap();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
     // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Effect to handle nearby drivers (Ghost Cars)
  useEffect(() => {
      // Only show nearby drivers in Pickup mode and when we have a location to center on
      if (!isPickup || !mapRef.current || !selectedLocation) return;

      let simulationInterval: any;

      const initDrivers = async () => {
          // Clear existing markers
          driverMarkersRef.current.forEach(m => m.remove());
          driverMarkersRef.current = [];

          // Fetch initial positions from simulated backend
          const drivers = await apiService.getNearbyDrivers(selectedLocation);
          
          // DISTINCT GHOST CAR ICON: Small, Slate Color, Simple Shape
          const carIcon = L.divIcon({
              html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-7 h-7 text-slate-500 dark:text-slate-300 opacity-90 drop-shadow-sm transform rotate-90"><path d="M19 7c0-1.1-.9-2-2-2h-3v2h3v2.65L13.52 14H10V9H8v7H5V9H3v9c0 1.1.9 2 2 2h1c.55 0 1-.45 1-1v-4h4v4c0 .55.45 1 1 1h3c1.1 0 2-.9 2-2v-6.18l2.82-3.21L21.99 7z"/></svg>`,
              className: 'custom-leaflet-icon',
              iconSize: [28, 28],
              iconAnchor: [14, 14],
          });

          drivers.forEach(pos => {
              if (mapRef.current) {
                const m = L.marker(pos, { icon: carIcon, opacity: 0.9 }).addTo(mapRef.current);
                driverMarkersRef.current.push(m);
              }
          });

          // Start animation loop to simulate movement (Random Walk)
          simulationInterval = setInterval(() => {
              driverMarkersRef.current.forEach(marker => {
                  const oldLatLng = marker.getLatLng();
                  // Simple Random walk simulation
                  // 0.0002 degrees is roughly 20 meters
                  const newLat = oldLatLng.lat + (Math.random() - 0.5) * 0.0003;
                  const newLng = oldLatLng.lng + (Math.random() - 0.5) * 0.0003;
                  marker.setLatLng([newLat, newLng]);
                  
                  // Randomly rotate visually (simulated by just re-rendering if we were using React, but here we are in Leaflet)
                  // For simple movement, position update is enough.
              });
          }, 2000);
      };

      initDrivers();

      return () => {
          if (simulationInterval) clearInterval(simulationInterval);
          driverMarkersRef.current.forEach(m => m.remove());
          driverMarkersRef.current = [];
      };
  }, [isPickup, selectedLocation]); 
  
  // Effect to add/update user's physical location marker (blue dot)
  useEffect(() => {
    if (mapRef.current && userPhysicalLocation) {
        if (!userLocationMarkerRef.current) {
            userLocationMarkerRef.current = L.circleMarker(userPhysicalLocation, {
                radius: 8,
                fillColor: "#2563eb",
                color: "#fff",
                weight: 2,
                opacity: 1,
                fillOpacity: 1
            }).addTo(mapRef.current);
        } else {
            userLocationMarkerRef.current.setLatLng(userPhysicalLocation);
        }
    }
  }, [userPhysicalLocation]);

  // Effect to manage the red pin marker
  useEffect(() => {
    if (!mapRef.current) return;
    
    if (selectedLocation) {
        if (selectedPinMarkerRef.current) {
            selectedPinMarkerRef.current.setLatLng(selectedLocation);
        } else {
            const redPinIconHtml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-10 h-10 text-red-600 drop-shadow-lg"><path fill-rule="evenodd" d="M12 2.25c-3.96 0-7.25 3.29-7.25 7.25 0 4.5 7.25 11.25 7.25 11.25s7.25-6.75 7.25-11.25C19.25 5.54 15.96 2.25 12 2.25zm0 9.75a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" clip-rule="evenodd"></path></svg>`;
            const customIcon = L.divIcon({
                html: redPinIconHtml,
                className: 'custom-leaflet-icon',
                iconSize: [40, 40],
                iconAnchor: [20, 40],
            });
            selectedPinMarkerRef.current = L.marker(selectedLocation, { icon: customIcon }).addTo(mapRef.current);
        }
    } else if (selectedPinMarkerRef.current) {
        selectedPinMarkerRef.current.remove();
        selectedPinMarkerRef.current = null;
    }
  }, [selectedLocation]);

  useEffect(() => {
    if (!selectedLocation) return;

    setIsFetchingAddress(true);
    const debounceTimer = setTimeout(async () => {
        const address = await apiService.reverseGeocode(selectedLocation, language);
        setCurrentAddress(address);
        if (!displayAddress) {
            setDisplayAddress(address?.split(',')[0] || '');
        }
        setIsFetchingAddress(false);
    }, 500); // Debounce for 500ms

    return () => clearTimeout(debounceTimer);
  }, [selectedLocation, language, displayAddress]);

  const handleSelectFromSearch = (result: NominatimResult) => {
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);
    const newLocation: LatLngTuple = [lat, lon];
    
    setSelectedLocation(newLocation);
    if(mapRef.current) {
        mapRef.current.setView(newLocation, 16);
    }
    storageService.saveRecentSearch(result);
    setIsSearchViewOpen(false);
    setDisplayAddress(result.display_name.split(',')[0]);
    setHasLocationBeenManuallyUpdated(true);
  };
  
  const handleMyLocationClick = async () => {
    setIsGettingLocation(true);
    setLocationMessage(null);
    
    try {
        const position = await geolocationService.getCurrentPosition({ timeout: 10000 });
        const newLocation: LatLngTuple = [position.coords.latitude, position.coords.longitude];
        setUserPhysicalLocation(newLocation);
        setSelectedLocation(newLocation);
        setDisplayAddress(''); // Clear search name to force reverse geocode
        if (mapRef.current) {
            mapRef.current.setView(newLocation, 15);
        }
        setHasLocationBeenManuallyUpdated(true);
    } catch (error) {
        const geoError = error as GeolocationPositionError;
        setLocationMessage({ text: geoError.code === geoError.PERMISSION_DENIED ? t('locationPermissionDenied') : t('couldNotGetLocation'), type: 'error' });
        setTimeout(() => setLocationMessage(null), 5000);
    } finally {
        setIsGettingLocation(false);
    }
  };

  return (
    <div className="relative h-full w-full bg-slate-50 dark:bg-gray-800">
      
      <div ref={mapContainerRef} className="w-full h-full bg-slate-200 dark:bg-gray-600"></div>

      <header className="absolute top-0 left-0 right-0 p-4 z-[1000]">
            <div 
                onClick={() => setIsSearchViewOpen(true)}
                className="w-full bg-white dark:bg-gray-700 shadow-lg rounded-xl p-4 flex items-center gap-4 cursor-pointer"
            >
                <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"/></svg>
                <span className="text-slate-800 dark:text-slate-200">
                    {displayAddress || t(isPickup ? 'searchPickupPlaceholder' : 'searchDropPlaceholder')}
                </span>
            </div>
      </header>
      
      {locationMessage && (
        <div className={`absolute top-20 left-1/2 -translate-x-1/2 z-[1000] p-2 text-white text-xs rounded-full shadow-lg transition-opacity duration-300 ${locationMessage.type === 'error' ? 'bg-red-600/90' : 'bg-black/70'}`}>
          {locationMessage.text}
        </div>
      )}
      
      <button
          type="button"
          onClick={handleMyLocationClick}
          disabled={isGettingLocation}
           className={`absolute bottom-[10.5rem] end-4 z-[1000] p-3 rounded-full shadow-lg transition-colors disabled:opacity-50 disabled:cursor-wait ${
            isMyLocationActive
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'bg-white dark:bg-gray-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-gray-600'
          }`}
          aria-label={t('useMyLocation')}
          title={t('useMyLocation')}
      >
          {isGettingLocation ? <Spinner /> : (
            isMyLocationActive
              ? <MyLocationIconActive />
              : <MyLocationIcon />
          )}
      </button>

      <footer className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800 z-[1000]">
        <div className="min-h-[2.5rem] flex items-center mb-4">
          <div className="w-full">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
              {
                isPickup
                  ? ((!hasLocationBeenManuallyUpdated || isMyLocationActive) ? t('currentPickupLocation') : t('updatedPickupLocation'))
                  : ((!hasLocationBeenManuallyUpdated || isMyLocationActive) ? t('currentDropLocation') : t('updatedDropLocation'))
              }
            </p>
            {isFetchingAddress ? (
              <p className="text-sm text-slate-500 italic">{t('searching')}...</p>
            ) : (
              <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                {currentAddress || (selectedLocation ? `Lat: ${selectedLocation[0].toFixed(4)}, Lng: ${selectedLocation[1].toFixed(4)}` : '...')}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="flex-1 bg-slate-200 dark:bg-gray-600 font-bold py-3 rounded-lg">{t('previous')}</button>
          <button onClick={() => selectedLocation && onSelect(selectedLocation)} disabled={!selectedLocation || isFetchingAddress} className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-lg disabled:bg-slate-300 dark:disabled:bg-gray-600">{t('confirm')}</button>
        </div>
      </footer>
       {isSearchViewOpen && <SearchOverlay onClose={() => setIsSearchViewOpen(false)} onSelect={handleSelectFromSearch} />}
    </div>
  );
};

export default MapPicker;
