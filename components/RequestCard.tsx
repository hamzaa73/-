
import React, { useState, useEffect, FC } from 'react';
import { useLocalization } from '../contexts/LocalizationContext';
import { ICONS, allServices } from '../constants';
import { Booking } from '../types';
import { apiService } from '../services/index';

interface RequestCardProps {
  booking: Booking;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  index: number;
}

const RequestCard: FC<RequestCardProps> = ({ booking, onAccept, onDecline, index }) => {
    const { t, translateOrShowOriginal, language } = useLocalization();
    const serviceInfo = allServices[booking.service] || allServices.otherService;
    const ServiceIcon = serviceInfo ? ICONS[serviceInfo.icon] : () => null;
    
    const [pickupAddress, setPickupAddress] = useState<string | null>(null);
    const [dropAddress, setDropAddress] = useState<string | null>(null);
    const [isLoadingAddresses, setIsLoadingAddresses] = useState(true);
    
    // Mock Price Calculation
    const price = ((parseFloat(booking.distance || '0') * 0.5) + 2).toFixed(2);

    useEffect(() => {
        // Stagger API calls to avoid rate-limiting
        const timer = setTimeout(() => {
            const fetchAddresses = async () => {
                setIsLoadingAddresses(true);
                try {
                    let pAddress = t('notSpecified');
                    let dAddress = t('notSpecified');

                    if (booking.pickup) {
                        const fetchedP = await apiService.reverseGeocode(booking.pickup, language);
                        pAddress = fetchedP?.split(',').slice(0, 2).join(',') || `Lat: ${booking.pickup[0].toFixed(3)}`;
                    }
                     setPickupAddress(pAddress);

                    if (booking.drop) {
                        const fetchedD = await apiService.reverseGeocode(booking.drop, language);
                        dAddress = fetchedD?.split(',').slice(0, 2).join(',') || `Lat: ${booking.drop[0].toFixed(3)}`;
                    }
                    setDropAddress(dAddress);

                } catch (error) {
                    console.error("Error reverse geocoding:", error);
                    setPickupAddress(t('routeFetchError'));
                    setDropAddress(t('routeFetchError'));
                } finally {
                    setIsLoadingAddresses(false);
                }
            };
            fetchAddresses();
        }, index * 300);

        return () => clearTimeout(timer);
    }, [booking.pickup, booking.drop, language, t, index]);

    return (
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-lg border-l-4 border-blue-600 animate-[fade-in-splash-text_0.5s_ease-out_1] transform transition-all hover:scale-[1.01]">
            {/* Header: Service & Price */}
            <div className="flex justify-between items-start mb-4 border-b border-slate-100 dark:border-gray-700 pb-3">
                <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl bg-${serviceInfo?.color}/10`}>
                        <ServiceIcon className={`w-7 h-7 text-${serviceInfo?.color}`} />
                    </div>
                    <div>
                        <h3 className="font-extrabold text-lg leading-tight">{translateOrShowOriginal(booking.service)}</h3>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                            {booking.distance} {t('km')} • {booking.duration} {t('minutes')}
                        </p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-2xl font-black text-green-600 dark:text-green-400">${price}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{t('fare')}</p>
                </div>
            </div>

            {/* Route Details */}
            <div className="relative pl-4 space-y-4 mb-5">
                {/* Dotted Line */}
                <div className="absolute left-[5px] top-2 bottom-4 w-0.5 border-l-2 border-dashed border-slate-300 dark:border-gray-600"></div>

                <div className="relative">
                    <div className="absolute -left-[15px] top-1.5 w-3 h-3 bg-green-500 rounded-full ring-4 ring-white dark:ring-gray-800"></div>
                    <p className="text-xs font-bold text-slate-400 uppercase mb-0.5">{t('from')}</p>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-snug">
                        {isLoadingAddresses ? <span className="animate-pulse bg-slate-200 dark:bg-gray-600 h-4 w-24 rounded inline-block"></span> : pickupAddress}
                    </p>
                </div>

                <div className="relative">
                    <div className="absolute -left-[15px] top-1.5 w-3 h-3 bg-red-500 rounded-full ring-4 ring-white dark:ring-gray-800"></div>
                    <p className="text-xs font-bold text-slate-400 uppercase mb-0.5">{t('to')}</p>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-snug">
                         {isLoadingAddresses ? <span className="animate-pulse bg-slate-200 dark:bg-gray-600 h-4 w-24 rounded inline-block"></span> : dropAddress}
                    </p>
                </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
                <button onClick={() => onDecline(booking.id)} className="flex-1 bg-slate-100 dark:bg-gray-700 text-slate-600 dark:text-slate-300 font-bold py-3.5 rounded-xl hover:bg-slate-200 dark:hover:bg-gray-600 transition-colors text-sm uppercase tracking-wide">
                    {t('decline')}
                </button>
                <button onClick={() => onAccept(booking.id)} className="flex-[2] bg-blue-600 text-white font-bold py-3.5 rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20 text-sm uppercase tracking-wide">
                    {t('accept')}
                </button>
            </div>
        </div>
    );
};

export default RequestCard;
