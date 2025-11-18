

export type Language = 'ar' | 'en';
export type Direction = 'rtl' | 'ltr';
export type UserRole = 'client' | 'driver' | 'admin';

export interface AppSettings {
  isDarkMode: boolean;
  notificationsEnabled: boolean;
  autoLocation: boolean;
  language: Language;
}

export type LatLngTuple = [number, number];

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  rating?: number;
  isOnline?: boolean;
}

export interface Booking {
  id: string;
  service: string;
  cargoType: string;
  size: string;
  weight: string;
  preference: string; // e.g., 'fastDelivery', 'safePackaging', 'scheduleTrip'
  scheduledTime?: string; // For the scheduled trip time
  distance?: string;
  duration?: string;
  pickup?: LatLngTuple;
  drop?: LatLngTuple;
  route?: LatLngTuple[];
  time: string;
  status: 'pending' | 'accepted' | 'arrived' | 'in_progress' | 'completed' | 'cancelled';
  driverId?: string | null;
  rating?: number;
  price?: number;
}

export interface RouteInfo {
  distance: number;
  duration: number;
  route: LatLngTuple[];
}

export interface Service {
  key: string;
  category: string;
}

export interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
  distance?: number;
}

export interface DashboardStats {
  totalRevenue: number;
  totalTrips: number;
  activeDrivers: number;
  completedTrips: number;
}