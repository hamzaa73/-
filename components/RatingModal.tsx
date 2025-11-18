

import React, { useState, FC } from 'react';
import { Booking } from '../types';
import { useLocalization } from '../contexts/LocalizationContext';

interface RatingModalProps {
  booking: Booking;
  onSubmit: (bookingId: string, rating: number) => void;
  onClose: () => void;
}

const StarIcon: FC<{ filled: boolean; onClick: () => void; onHover: () => void }> = ({ filled, onClick, onHover }) => (
    <svg 
        onClick={onClick} 
        onMouseEnter={onHover}
        className={`w-10 h-10 cursor-pointer transition-transform transform hover:scale-110 ${filled ? 'text-yellow-400' : 'text-slate-300 dark:text-gray-600'}`}
        fill="currentColor" 
        viewBox="0 0 20 20"
    >
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.368 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.368-2.448a1 1 0 00-1.175 0l-3.368 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.24 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69L9.049 2.927z" />
    </svg>
);


const RatingModal: FC<RatingModalProps> = ({ booking, onSubmit, onClose }) => {
    const { t } = useLocalization();
    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);

    const handleSubmit = () => {
        if (rating > 0) {
            onSubmit(booking.id, rating);
            // The success message can be shown in the parent component if needed
        }
    };
    
    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div 
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6 text-center" 
                onClick={e => e.stopPropagation()}
            >
                <h2 className="text-xl font-bold mb-2">{t('tripCompleted')}!</h2>
                <p className="text-slate-500 dark:text-slate-400 mb-6">{t('howWasYourTrip')}</p>
                
                <div 
                    className="flex justify-center items-center gap-2 mb-8" 
                    onMouseLeave={() => setHoverRating(0)}
                >
                    {[1, 2, 3, 4, 5].map(star => (
                        <StarIcon 
                            key={star}
                            filled={(hoverRating || rating) >= star}
                            onClick={() => setRating(star)}
                            onHover={() => setHoverRating(star)}
                        />
                    ))}
                </div>
                
                <div className="flex gap-4">
                    <button 
                        onClick={onClose} 
                        className="w-full bg-slate-200 dark:bg-gray-600 font-bold py-3 rounded-lg"
                    >
                        {t('close')}
                    </button>
                    <button 
                        onClick={handleSubmit} 
                        disabled={rating === 0} 
                        className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg disabled:bg-slate-300 dark:disabled:bg-gray-500"
                    >
                        {t('submitRating')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RatingModal;