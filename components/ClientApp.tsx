
import React, { useState, useEffect } from 'react';
import { Booking } from '../types';
import { dbService } from '../services/index';
import { translations, ICONS, allServices } from '../constants';
import BookingModal from './BookingModal';
import ClientActiveTripView from './ClientActiveTripView';
import RatingModal from './RatingModal';
import { useLocalization } from '../contexts/LocalizationContext';

// --- MAIN CLIENT APP COMPONENT ---
const ClientApp: React.FC<{ onSettingsClick: () => void }> = ({ onSettingsClick }) => {
  const { language } = useLocalization();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  const [activeTrip, setActiveTrip] = useState<Booking | null>(null);
  const [showRatingModalFor, setShowRatingModalFor] = useState<Booking | null>(null);

  // Real-time subscription to bookings
  useEffect(() => {
    const unsubscribe = dbService.subscribeToBookings((updatedBookings) => {
        setBookings(updatedBookings);

        const currentActiveTrip = updatedBookings.find(b => ['accepted', 'in_progress', 'arrived'].includes(b.status));
        setActiveTrip(currentActiveTrip || null);

        // Check for newly completed trips to rate
        if (!currentActiveTrip) {
            const completedUnratedTrip = updatedBookings.find(b => b.status === 'completed' && typeof b.rating === 'undefined');
            if (completedUnratedTrip) {
                setShowRatingModalFor(completedUnratedTrip);
            }
        }
    });

    return () => unsubscribe();
  }, []);


  const handleDeleteBooking = (id: string) => {
    // In real app, this would call dbService.deleteBooking(id)
    // For now we just update status to cancelled which is safer
    dbService.updateBookingStatus(id, 'cancelled');
  };
  
  const handleCancelBooking = (id: string) => {
      dbService.updateBookingStatus(id, 'cancelled');
  }

  const handleRatingSubmit = (bookingId: string, rating: number) => {
      dbService.updateBookingRating(bookingId, rating);
      setShowRatingModalFor(null);
  };

  const renderContent = () => {
    if (activeTrip) {
        return <ClientActiveTripView trip={activeTrip} />;
    }
    return (
        <MainContent
            onBookNow={() => setIsBookingModalOpen(true)}
            bookings={bookings.filter(b => b.status === 'pending' || (b.status === 'completed' && typeof b.rating !== 'undefined') || b.status === 'cancelled')}
            onViewBooking={setSelectedBooking}
            onDeleteBooking={handleDeleteBooking}
            onCancelBooking={handleCancelBooking}
        />
    );
  };

  return (
    <div className={`font-sans bg-slate-100 dark:bg-gray-900 text-slate-800 dark:text-slate-200 min-h-screen transition-colors duration-300 ${language === 'ar' ? 'rtl' : 'ltr'}`}>
        <div className="max-w-4xl mx-auto flex flex-col min-h-screen">
            <Header onSettingsClick={onSettingsClick} />
            {renderContent()}
        </div>

        {isBookingModalOpen && <BookingModal onClose={() => setIsBookingModalOpen(false)} onSave={() => {}} />}
        {selectedBooking && <BookingReviewDialog booking={selectedBooking} onClose={() => setSelectedBooking(null)} />}
        {showRatingModalFor && <RatingModal booking={showRatingModalFor} onSubmit={handleRatingSubmit} onClose={() => setShowRatingModalFor(null)} />}
    </div>
  );
};

const Header: React.FC<{ onSettingsClick: () => void }> = ({ onSettingsClick }) => {
  const { t } = useLocalization();
  return (
    <header className="p-4 flex justify-between items-center sticky top-0 bg-slate-100/90 dark:bg-gray-900/90 backdrop-blur-sm z-40 border-b border-slate-200 dark:border-gray-800">
      <h1 className="text-xl font-bold text-blue-600 dark:text-blue-400 flex items-center gap-2">
          <ICONS.local_shipping className="w-6 h-6"/>
          {t('appTitle')}
      </h1>
      <button onClick={onSettingsClick} className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-gray-700 transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0 3.35a1.724 1.724 0 001.066 2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
      </button>
    </header>
  );
};

const MainContent: React.FC<{ onBookNow: () => void; bookings: Booking[]; onViewBooking: (b: Booking) => void; onDeleteBooking: (id: string) => void; onCancelBooking: (id: string) => void; }> = ({ onBookNow, bookings, onViewBooking, onDeleteBooking, onCancelBooking }) => {
    const { t } = useLocalization();
    const latestPendingBooking = bookings.find(b => b.status === 'pending');

    return (
        <main className="flex-1 p-4 pb-20">
            {/* Promo / Status Card */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-6 rounded-3xl shadow-lg mb-8 text-center relative overflow-hidden">
                <div className="relative z-10">
                    {latestPendingBooking ? (
                        <>
                            <h2 className="text-2xl font-bold mb-2">{t('waitingForDriver')}</h2>
                            <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto my-4"></div>
                            <button onClick={() => onCancelBooking(latestPendingBooking.id)} className="text-sm bg-white/20 px-4 py-2 rounded-full hover:bg-white/30 transition-colors">{t('cancelOrder')}</button>
                        </>
                    ) : (
                        <>
                            <h2 className="text-3xl font-bold mb-2">{t('welcome')}</h2>
                            <p className="text-blue-100 mb-6">{t('bookEasily')}</p>
                            <button onClick={onBookNow} className="bg-white text-blue-600 font-bold py-3 px-8 rounded-full hover:bg-blue-50 transition-transform transform hover:scale-105 shadow-lg">
                                {t('bookNow')}
                            </button>
                        </>
                    )}
                </div>
                <ICONS.map className="absolute -bottom-4 -right-4 w-32 h-32 text-white/10" />
            </div>
            
            {/* Recent Activity */}
            {bookings.filter(b => b.status !== 'pending').length > 0 && (
                <div>
                    <h3 className="text-lg font-bold mb-4 px-2">{t('recent')}</h3>
                    <div className="space-y-4">
                        {bookings.filter(b => b.status !== 'pending').map(booking => (
                            <BookingCard key={booking.id} booking={booking} onView={() => onViewBooking(booking)} onDelete={() => onDeleteBooking(booking.id)} />
                        ))}
                    </div>
                </div>
            )}
        </main>
    );
};

const BookingCard: React.FC<{ booking: Booking; onView: () => void; onDelete: () => void; }> = ({ booking, onView, onDelete }) => {
    const { t, translateOrShowOriginal } = useLocalization();
    const serviceInfo = allServices[booking.service] || allServices.otherService;
    const ServiceIcon = serviceInfo ? ICONS[serviceInfo.icon] : () => null;

    return (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
            <div className={`p-3 rounded-full bg-${serviceInfo?.color}/10`}>
                <ServiceIcon className={`w-8 h-8 text-${serviceInfo?.color}`} />
            </div>
            <div className="flex-1">
                <div className="flex justify-between">
                    <p className="font-bold">{translateOrShowOriginal(booking.service)}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${booking.status === 'cancelled' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                        {t(booking.status)}
                    </span>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    {new Date(booking.time).toLocaleDateString()} • {booking.distance} {t('km')}
                </p>
            </div>
            <div className="flex flex-col gap-2">
                 <button onClick={onView} className="px-3 py-1.5 text-xs font-semibold bg-slate-100 text-slate-700 dark:bg-gray-700 dark:text-slate-300 rounded-lg hover:bg-slate-200">{t('view')}</button>
            </div>
        </div>
    );
};

const BookingReviewDialog: React.FC<{ booking: Booking; onClose: () => void }> = ({ booking, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
                <h3 className="font-bold text-lg mb-4">Trip Details</h3>
                <div className="space-y-2 text-sm">
                    <p><strong>ID:</strong> {booking.id}</p>
                    <p><strong>Date:</strong> {new Date(booking.time).toLocaleString()}</p>
                    <p><strong>Status:</strong> {booking.status}</p>
                    <p><strong>Fare:</strong> ${((parseFloat(booking.distance || '0') * 0.5) + 2).toFixed(2)}</p>
                </div>
                <button onClick={onClose} className="mt-6 w-full bg-slate-200 dark:bg-gray-700 py-2 rounded-lg font-bold">Close</button>
            </div>
        </div>
    )
};

export default ClientApp;
