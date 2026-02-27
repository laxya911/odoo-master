'use client';

import React, { useState, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';

interface ImageLightboxProps {
    images: Array<{
        id: string;
        url: string;
        title: string;
        category: string;
    }>;
    initialIndex: number;
    onClose: () => void;
}

export const ImageLightbox: React.FC<ImageLightboxProps> = ({
    images,
    initialIndex,
    onClose,
}) => {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [zoom, setZoom] = useState(1);

    const goToNext = useCallback(() => {
        setCurrentIndex((prev) => (prev + 1) % images.length);
        setZoom(1);
    }, [images.length]);

    const goToPrevious = useCallback(() => {
        setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
        setZoom(1);
    }, [images.length]);

    const handleZoomIn = useCallback(() => {
        setZoom((prev) => Math.min(prev + 0.5, 3));
    }, []);

    const handleZoomOut = useCallback(() => {
        setZoom((prev) => Math.max(prev - 0.5, 1));
    }, []);

    const [touchStart, setTouchStart] = useState(0);
    const [touchEnd, setTouchEnd] = useState(0);

    const handleTouchStart = (e: React.TouchEvent) => {
        const x = e.targetTouches[0].clientX;
        setTouchStart(x);
        setTouchEnd(x);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        setTouchEnd(e.targetTouches[0].clientX);
    };

    const handleTouchEnd = () => {
        const swipeDistance = touchStart - touchEnd;
        const threshold = 50;

        if (Math.abs(swipeDistance) > threshold) {
            if (swipeDistance > 0) {
                goToNext();
            } else {
                goToPrevious();
            }
        }
    };

    const [mouseStart, setMouseStart] = useState(0);
    const [mouseEnd, setMouseEnd] = useState(0);
    const [isDragging, setIsDragging] = useState(false);

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        setMouseStart(e.clientX);
        setMouseEnd(e.clientX);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging) setMouseEnd(e.clientX);
    };

    const handleMouseUp = () => {
        if (!isDragging) return;

        const swipeDistance = mouseStart - mouseEnd;
        const threshold = 50;

        if (Math.abs(swipeDistance) > threshold) {
            if (swipeDistance > 0) {
                goToNext();
            } else {
                goToPrevious();
            }
        }

        setIsDragging(false);
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft') goToPrevious();
            if (e.key === 'ArrowRight') goToNext();
            if (e.key === 'Escape') onClose();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [goToNext, goToPrevious, onClose]);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-xl"
            onClick={onClose}
        >
            {/* Close */}
            <button
                onClick={onClose}
                className="absolute top-6 right-6 z-10 w-12 h-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center"
                aria-label="Close lightbox"
            >
                <X className="w-6 h-6 text-white" />
            </button>

            {/* Counter */}
            <div className="absolute top-6 left-6 z-10 text-white text-sm font-bold bg-black/50 px-4 py-2 rounded-full">
                {currentIndex + 1} / {images.length}
            </div>

            {/* Zoom Controls */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex gap-2">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        handleZoomOut();
                    }}
                    disabled={zoom <= 1}
                    className="w-12 h-12 bg-white/10 hover:bg-white/20 disabled:opacity-50 rounded-full flex items-center justify-center"
                >
                    <ZoomOut className="w-5 h-5 text-white" />
                </button>

                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        handleZoomIn();
                    }}
                    disabled={zoom >= 3}
                    className="w-12 h-12 bg-white/10 hover:bg-white/20 disabled:opacity-50 rounded-full flex items-center justify-center"
                >
                    <ZoomIn className="w-5 h-5 text-white" />
                </button>
            </div>

            {/* Nav Buttons */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    goToPrevious();
                }}
                className="absolute left-6 top-1/2 -translate-y-1/2 w-14 h-14 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center z-10"
            >
                <ChevronLeft className="w-8 h-8 text-white" />
            </button>

            <button
                onClick={(e) => {
                    e.stopPropagation();
                    goToNext();
                }}
                className="absolute right-6 top-1/2 -translate-y-1/2 w-14 h-14 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center z-10"
            >
                <ChevronRight className="w-8 h-8 text-white" />
            </button>

            {/* Image */}
            <div
                className="absolute inset-0 flex items-center justify-center p-4 md:p-20"
                onClick={(e) => e.stopPropagation()}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={() => setIsDragging(false)}
                style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
            >
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentIndex}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: zoom }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.3 }}
                        className="relative w-full h-full"
                    >
                        <Image
                            src={images[currentIndex].url}
                            alt={images[currentIndex].title}
                            fill
                            className="object-contain"
                            sizes="100vw"
                            priority
                        />
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Info */}
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 text-center z-10">
                <p className="text-accent-gold text-xs uppercase tracking-widest mb-1">
                    {images[currentIndex].category}
                </p>
                <h3 className="text-white text-xl font-display font-bold">
                    {images[currentIndex].title}
                </h3>
            </div>
        </motion.div>
    );
};
