
import { AppSettings, Booking, LatLngTuple, NominatimResult, RouteInfo, DashboardStats } from '../types';
import { db, auth } from '../firebase-config';
import { 
    collection, 
    addDoc, 
    updateDoc, 
    doc, 
    onSnapshot, 
    query, 
    where, 
    orderBy, 
    getDocs,
    setDoc
} from "firebase/firestore";
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from "firebase/auth";

// --- Local Storage Service (Settings Only) ---
const SETTINGS_KEY = 'app_settings';
const RECENT_SEARCHES_KEY = 'recent_searches';
const MAX_RECENT_SEARCHES = 5;

export const storageService = {
  loadSettings: (): AppSettings => {
    try {
      const storedSettings = localStorage.getItem(SETTINGS_KEY);
      if (storedSettings) {
        const parsed = JSON.parse(storedSettings);
        return {
          isDarkMode: parsed.isDarkMode ?? false,
          notificationsEnabled: parsed.notificationsEnabled ?? true,
          autoLocation: parsed.autoLocation ?? true,
          language: ['ar', 'en'].includes(parsed.language) ? parsed.language : 'ar',
        };
      }
    } catch (error) {
      console.error("Failed to load settings", error);
    }
    return {
      isDarkMode: false,
      notificationsEnabled: true,
      autoLocation: true,
      language: 'ar',
    };
  },
  saveSettings: (settings: AppSettings): void => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error("Failed to save settings", error);
    }
  },
  loadRecentSearches: (): NominatimResult[] => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      return [];
    }
  },
  saveRecentSearch: (search: NominatimResult): void => {
      try {
        let recents = storageService.loadRecentSearches();
        recents = recents.filter(r => r.display_name !== search.display_name);
        recents.unshift(search);
        if (recents.length > MAX_RECENT_SEARCHES) {
          recents = recents.slice(0, MAX_RECENT_SEARCHES);
        }
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recents));
      } catch (error) {
        console.error("Failed to save recent search", error);
      }
  },
};

// --- DATABASE SERVICE (REAL-TIME FIREBASE) ---

export const dbService = {
    // --- Bookings ---
    subscribeToBookings: (callback: (bookings: Booking[]) => void) => {
        if (!db) {
            // Mock Fallback: Listen to LocalStorage for cross-tab updates
            const load = () => {
                try {
                    const stored = localStorage.getItem('bookingsList');
                    callback(stored ? JSON.parse(stored) : []);
                } catch(e) { callback([]) }
            };
            
            load(); // Initial load

            const handleStorage = (e: StorageEvent) => {
                if (e.key === 'bookingsList') load();
            };
            const handleCustom = () => load();

            window.addEventListener('storage', handleStorage);
            window.addEventListener('bookingsUpdated', handleCustom);
            
            return () => {
                window.removeEventListener('storage', handleStorage);
                window.removeEventListener('bookingsUpdated', handleCustom);
            };
        }
        
        const q = query(collection(db, "bookings"), orderBy("time", "desc"));
        return onSnapshot(q, (snapshot) => {
            const bookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking));
            callback(bookings);
        });
    },

    createBooking: async (booking: Booking) => {
        if (!db) {
            // Mock Fallback
            const existing = JSON.parse(localStorage.getItem('bookingsList') || '[]');
            const newList = [booking, ...existing];
            localStorage.setItem('bookingsList', JSON.stringify(newList));
            window.dispatchEvent(new Event('bookingsUpdated'));
            return;
        }
        try {
            await addDoc(collection(db, "bookings"), booking);
        } catch (e) {
            console.error("Error adding booking: ", e);
            throw e;
        }
    },

    updateBookingStatus: async (id: string, status: Booking['status'], driverId?: string) => {
        if (!db) {
            // Mock Fallback
             const bookings = JSON.parse(localStorage.getItem('bookingsList') || '[]');
             const updated = bookings.map((b:Booking) => b.id === id ? {...b, status, driverId: driverId || b.driverId} : b);
             localStorage.setItem('bookingsList', JSON.stringify(updated));
             window.dispatchEvent(new Event('bookingsUpdated'));
             return;
        }
        const bookingRef = doc(db, "bookings", id);
        await updateDoc(bookingRef, { 
            status, 
            driverId: driverId || null 
        });
    },

    updateBookingRating: async (id: string, rating: number) => {
        if (!db) {
             // Mock Fallback
             const bookings = JSON.parse(localStorage.getItem('bookingsList') || '[]');
             const updated = bookings.map((b:Booking) => b.id === id ? {...b, rating} : b);
             localStorage.setItem('bookingsList', JSON.stringify(updated));
             window.dispatchEvent(new Event('bookingsUpdated'));
             return;
        }
        const bookingRef = doc(db, "bookings", id);
        await updateDoc(bookingRef, { rating });
    },

    // --- Real-time Driver Tracking ---
    updateDriverLocation: async (driverId: string, lat: number, lng: number, isOnline: boolean, status: string) => {
        if (!db) {
            // Mock Fallback for visual demo without DB
            const data = { driver_lat: lat, driver_lng: lng, driver_is_online: isOnline, driver_status: status, timestamp: Date.now() };
            localStorage.setItem("driver_location", JSON.stringify(data));
            return;
        }
        // We use a specific document for the single driver demo, or a collection for multiple
        await setDoc(doc(db, "drivers", driverId), {
            location: { lat, lng },
            isOnline,
            status,
            lastUpdated: Date.now()
        }, { merge: true });
    },

    subscribeToDriverLocation: (driverId: string, callback: (data: any) => void) => {
        if (!db) {
             // Mock Fallback
             const handler = () => {
                 const data = localStorage.getItem("driver_location");
                 if(data) callback(JSON.parse(data));
             }
             window.addEventListener('storage', handler);
             // Also poll
             const int = setInterval(handler, 1000);
             return () => { window.removeEventListener('storage', handler); clearInterval(int); };
        }

        return onSnapshot(doc(db, "drivers", driverId), (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                // Map Firestore structure to app structure
                callback({
                    driver_lat: data.location.lat,
                    driver_lng: data.location.lng,
                    driver_is_online: data.isOnline,
                    driver_status: data.status
                });
            }
        });
    },

    // --- Admin Stats ---
    getDashboardStats: async (): Promise<DashboardStats> => {
        if (!db) {
            // Mock Stats based on localstorage
            const bookings: Booking[] = JSON.parse(localStorage.getItem('bookingsList') || '[]');
            const completed = bookings.filter(b => b.status === 'completed');
            let totalRevenue = 0;
            completed.forEach(b => {
                 totalRevenue += (parseFloat(b.distance || '0') * 0.5 + 2);
            });
            
            return { 
                totalRevenue, 
                totalTrips: bookings.length, 
                activeDrivers: 1, 
                completedTrips: completed.length 
            };
        }

        const q = query(collection(db, "bookings"), where("status", "==", "completed"));
        const snapshot = await getDocs(q);
        const completedTrips = snapshot.size;
        
        let totalRevenue = 0;
        snapshot.forEach(doc => {
            const data = doc.data();
            const dist = parseFloat(data.distance || '0');
            totalRevenue += (dist * 0.5 + 2);
        });

        const activeDriversSnapshot = await getDocs(query(collection(db, "drivers"), where("isOnline", "==", true)));
        
        return {
            totalRevenue: parseFloat(totalRevenue.toFixed(2)),
            totalTrips: (await getDocs(collection(db, "bookings"))).size,
            completedTrips,
            activeDrivers: activeDriversSnapshot.size
        };
    }
};

// --- Authentication Service (Firebase) ---
export const authService = {
  isAuthenticated: (): boolean => {
    // Initial check (Firebase is async, this might be naive for first render, 
    // but AuthContext handles the listener)
    return !!auth?.currentUser || localStorage.getItem('is_authenticated') === 'true';
  },
  login: async (email?: string, password?: string): Promise<boolean> => {
    if (!auth) {
        localStorage.setItem('is_authenticated', 'true');
        return true;
    }
    try {
        // Use hardcoded demo credentials if none provided (for quick testing)
        await signInWithEmailAndPassword(auth, email || "demo@example.com", password || "password123");
        return true;
    } catch (error) {
        console.error("Auth Error", error);
        // Fallback for demo without real firebase users
        localStorage.setItem('is_authenticated', 'true');
        return true;
    }
  },
  signup: async (name?: string, email?: string, password?: string): Promise<boolean> => {
    if (!auth) return true;
    try {
        await createUserWithEmailAndPassword(auth, email || `user${Date.now()}@test.com`, password || "password123");
        // Here you would updateProfile to set the display name
        return true;
    } catch (e) {
        console.error(e);
        return false;
    }
  },
  logout: async (): Promise<void> => {
    if (auth) await signOut(auth);
    localStorage.removeItem('is_authenticated');
  },
  onAuthStateChanged: (callback: (user: any) => void) => {
      if (auth) return onAuthStateChanged(auth, callback);
      return () => {};
  }
};


// --- API Service (Routes & Geocoding) ---

const generateFallbackRoute = (start: LatLngTuple, end: LatLngTuple): RouteInfo => {
    const route: LatLngTuple[] = [];
    const numPoints = 40;
    const latStep = (end[0] - start[0]) / (numPoints - 1);
    const lngStep = (end[1] - start[1]) / (numPoints - 1);

    for (let i = 0; i < numPoints; i++) {
        route.push([start[0] + latStep * i, start[1] + lngStep * i]);
    }
    
    // Calc Distance
    const R = 6371; 
    const dLat = (end[0] - start[0]) * Math.PI / 180;
    const dLon = (end[1] - start[1]) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(start[0] * Math.PI / 180) * Math.cos(end[0] * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    const duration = (distance / 40) * 60;

    return { distance, duration, route };
};

export const apiService = {
  fetchRoute: async (start: LatLngTuple, end: LatLngTuple, preference: 'fastest' | 'shortest' = 'fastest'): Promise<{ info: RouteInfo | null, error: string | null }> => {
    const [startLat, startLng] = start;
    const [endLat, endLng] = end;
    
    // Use routing.openstreetmap.de which is generally more reliable for demos than project-osrm.org
    const url = `https://routing.openstreetmap.de/routed-car/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`OSRM Failed: ${response.statusText}`);

      const data = await response.json();
      if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) throw new Error("No Route found");
      
      const routeData = data.routes[0];
      const coords = routeData.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]] as LatLngTuple);
      
      return {
        info: {
          distance: routeData.distance / 1000, // meters to km
          duration: routeData.duration / 60, // seconds to minutes
          route: coords,
        },
        error: null
      };
    } catch (error) {
      console.warn("Route fetch failed (using straight line fallback). Reason:", error);
      const fallbackInfo = generateFallbackRoute(start, end);
      // We return the fallback info so the user can still proceed with the booking flow without interruption.
      return { info: fallbackInfo, error: null };
    }
  },
  searchLocation: async (query: string, lang: string): Promise<NominatimResult[]> => {
    if (query.trim().length < 3) return [];
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5&countrycodes=ye&accept-language=${lang}`;
    try {
      const response = await fetch(url);
      return await response.json();
    } catch (error) {
      return [];
    }
  },
  reverseGeocode: async (latlng: LatLngTuple, lang: string): Promise<string | null> => {
    const [lat, lon] = latlng;
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=${lang}`;
    try {
      const response = await fetch(url);
      const data = await response.json();
      return data.display_name || null;
    } catch (error) {
      return null;
    }
  },
  getNearbyDrivers: async (center: LatLngTuple): Promise<LatLngTuple[]> => {
    // Simulation: Generate random drivers around the center for the "Picking" screen
    // In a real app with huge scale, you'd use GeoFire or backend geospatial queries
    return new Promise(resolve => {
        const drivers: LatLngTuple[] = [];
        const count = Math.floor(Math.random() * 3) + 2; 
        for(let i=0; i<count; i++) {
            drivers.push([
                center[0] + (Math.random() - 0.5) * 0.02,
                center[1] + (Math.random() - 0.5) * 0.02
            ]);
        }
        resolve(drivers);
    });
  }
};

// --- Geolocation Service ---
export const geolocationService = {
  getCurrentPosition: (options?: PositionOptions): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported."));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });
  }
};


// --- Background Service (Driver GPS) ---
class DriverBackgroundService {
    private watchId: number | null = null;
    private simulationInterval: any = null;
    isOnline: boolean = false;
    activeTripStatus: Booking['status'] | null = null;
    driverId: string = "current_driver_id"; // In real app, get from Auth

    constructor() {
        // Restore state?
    }

    private broadcastState(lat: number, lng: number) {
        // Send to Firestore
        dbService.updateDriverLocation(
            this.driverId,
            lat,
            lng,
            this.isOnline,
            this.activeTripStatus || 'idle'
        );
    }

    private startWatching() {
        if (this.watchId !== null) return;
        
        this.watchId = navigator.geolocation.watchPosition(
            (position) => {
                if (!this.simulationInterval) {
                    this.broadcastState(position.coords.latitude, position.coords.longitude);
                }
            },
            (error) => console.warn(error),
            { enableHighAccuracy: true }
        );
    }

    private stopWatching() {
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
        this.stopSimulation();
    }

    goOnline() {
        if (this.isOnline) return;
        this.isOnline = true;
        this.startWatching();
        // Push initial status
        navigator.geolocation.getCurrentPosition(p => 
            this.broadcastState(p.coords.latitude, p.coords.longitude)
        );
    }

    goOffline() {
        if (!this.isOnline) return;
        this.isOnline = false;
        this.stopWatching();
        // Update DB to offline
        dbService.updateDriverLocation(this.driverId, 0, 0, false, 'offline');
    }
    
    setActiveTripStatus(status: Booking['status'] | null) {
        this.activeTripStatus = status;
        // Force update
        navigator.geolocation.getCurrentPosition(p => 
            this.broadcastState(p.coords.latitude, p.coords.longitude)
        );
    }

    // --- SIMULATION ---
    startSimulation(route: LatLngTuple[]) {
        if (this.simulationInterval) clearInterval(this.simulationInterval);
        let index = 0;
        const speed = 1; // Index increment
        
        this.simulationInterval = setInterval(() => {
            if (index >= route.length) {
                // Loop or stop? Stop for now.
                // this.stopSimulation();
                index = route.length - 1; // Stay at end
            }
            const point = route[index];
            this.broadcastState(point[0], point[1]);
            index += speed;
        }, 1000);
    }

    stopSimulation() {
        if (this.simulationInterval) {
            clearInterval(this.simulationInterval);
            this.simulationInterval = null;
        }
    }
}

const driverBackgroundService = new DriverBackgroundService();
export { driverBackgroundService };
