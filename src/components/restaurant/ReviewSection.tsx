
"use client"

import React, { useState } from 'react';
import { Star, MessageSquare, CheckCircle2, Sparkles, Calendar as CalendarIcon, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Product, REVIEWS, RAM_GROUP } from '@/lib/odoo-mock';
import { cn } from '@/lib/utils';
import Image from 'next/image';

export function ReviewSection({ product }: { product: Product }) {
    const [isAddingReview, setIsAddingReview] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [showOverallFeedback, setShowOverallFeedback] = useState(false);
    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [staffRating, setStaffRating] = useState([50]);
    const [ambianceRating, setAmbianceRating] = useState([50]);

    const productReviews = REVIEWS.filter(r => r.productId === product.id);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitted(true);
        setTimeout(() => {
            setIsAddingReview(false);
            setIsSubmitted(false);
            setShowOverallFeedback(false);
            setRating(0);
        }, 3000);
    };

    if (isSubmitted) {
        return (
            <Card className="rounded-[2.5rem] border-primary/10 shadow-2xl overflow-hidden py-16 text-center space-y-6">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto text-green-600">
                    <CheckCircle className="w-12 h-12" />
                </div>
                <div className="space-y-2">
                    <h3 className="text-3xl font-black font-headline">Thank You!</h3>
                    <p className="text-muted-foreground">Your review has been submitted and helps our Himalayan team grow.</p>
                </div>
            </Card>
        );
    }

    return (
        <div className="space-y-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
                <div className="space-y-2">
                    <h2 className="text-3xl font-black font-headline">Customer <span className="text-accent-gold">Reviews</span></h2>
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Feedback from Ibaraki Diners</p>
                </div>
                {!isAddingReview && (
                    <Button
                        onClick={() => setIsAddingReview(true)}
                        className="rounded-full px-8 h-12 font-black shadow-lg bg-accent-gold hover:bg-accent-gold/90 text-primary-foreground"
                    >
                        Rate this Dish
                    </Button>
                )}
            </div>

            {isAddingReview && (
                <Card className="rounded-[2.5rem] border-primary/10 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-500 overflow-hidden bg-white">
                    <CardContent className="p-0">
                        <div className="bg-black p-8 text-white">
                            <h3 className="text-2xl font-black font-headline flex items-center gap-3">
                                <Sparkles className="w-6 h-6 text-accent-gold" />
                                Diner Feedback
                            </h3>
                            <p className="text-white/50 text-xs tracking-wider uppercase">Verified Purchase Required</p>
                        </div>

                        <form onSubmit={handleSubmit} className="p-8 space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Dish Rating</Label>
                                    <div className="flex gap-2">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                            <button
                                                key={star}
                                                type="button"
                                                className="transition-transform active:scale-90"
                                                onMouseEnter={() => setHoverRating(star)}
                                                onMouseLeave={() => setHoverRating(0)}
                                                onClick={() => setRating(star)}
                                            >
                                                <Star
                                                    className={cn(
                                                        "w-8 h-8 transition-colors",
                                                        (hoverRating || rating) >= star
                                                            ? "fill-accent-gold text-accent-gold"
                                                            : "text-muted"
                                                    )}
                                                />
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Outlet Visited</Label>
                                    <Select required>
                                        <SelectTrigger className="h-12 rounded-xl border-primary/10 text-xs">
                                            <SelectValue placeholder="Which branch?" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {RAM_GROUP.stores.map(store => (
                                                <SelectItem key={store.id} value={store.id}>{store.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-4">
                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Dining Date</Label>
                                    <div className="relative">
                                        <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                        <Input type="date" className="pl-10 h-12 rounded-xl text-xs" required />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Review Content</Label>
                                <Textarea
                                    placeholder="Tell us about the flavors, presentation, and heat..."
                                    className="rounded-2xl min-h-[100px] p-4 border-primary/10 text-sm"
                                    required
                                />
                            </div>

                            <div className="bg-secondary/30 p-6 rounded-2xl border border-dashed border-accent-gold/20">
                                <div className="flex items-center space-x-3">
                                    <Checkbox
                                        id="overall-feedback"
                                        checked={showOverallFeedback}
                                        onCheckedChange={(checked) => setShowOverallFeedback(checked as boolean)}
                                        className="w-5 h-5 rounded-md border-accent-gold data-[state=checked]:bg-accent-gold"
                                    />
                                    <Label
                                        htmlFor="overall-feedback"
                                        className="text-sm font-bold text-foreground cursor-pointer"
                                    >
                                        Provide Overall Experience Feedback?
                                    </Label>
                                </div>

                                {showOverallFeedback && (
                                    <div className="mt-8 space-y-10 animate-in fade-in slide-in-from-top-2 duration-300">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                            <div className="space-y-6">
                                                <div className="flex justify-between items-center">
                                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Staff Service</Label>
                                                    <span className="text-[10px] font-black text-primary uppercase">
                                                        {staffRating[0] < 30 ? 'Poor' : staffRating[0] < 70 ? 'Good' : 'Excellent'}
                                                    </span>
                                                </div>
                                                <Slider value={staffRating} onValueChange={setStaffRating} max={100} step={1} className="py-2" />
                                            </div>
                                            <div className="space-y-6">
                                                <div className="flex justify-between items-center">
                                                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Atmosphere</Label>
                                                    <span className="text-[10px] font-black text-accent-gold uppercase">
                                                        {ambianceRating[0] < 30 ? 'Needs Work' : ambianceRating[0] < 70 ? 'Pleasant' : 'Stunning'}
                                                    </span>
                                                </div>
                                                <Slider value={ambianceRating} onValueChange={setAmbianceRating} max={100} step={1} className="py-2" />
                                            </div>
                                        </div>
                                        <div className="space-y-4">
                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Detailed Impression</Label>
                                            <Textarea
                                                placeholder="Staff politeness, cleanliness, music, etc."
                                                className="rounded-2xl min-h-[80px] p-4 bg-white text-sm"
                                                required={showOverallFeedback}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3 pt-2">
                                <Button type="submit" className="flex-1 h-12 rounded-full font-black shadow-lg bg-accent-gold hover:bg-accent-gold/90 text-primary-foreground">
                                    Submit Review
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setIsAddingReview(false)}
                                    className="h-12 rounded-full px-8 font-bold text-xs"
                                >
                                    Cancel
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}

            <div className="space-y-8">
                {productReviews.map((review) => (
                    <div key={review.id} className="bg-white p-6 rounded-[2rem] shadow-sm border border-primary/5 hover:shadow-lg transition-all">
                        <div className="flex gap-6">
                            <div className="flex flex-col items-center gap-2 shrink-0">
                                <div className="relative w-14 h-14 rounded-2xl overflow-hidden shadow-md">
                                    <Image src={review.userAvatar} alt={review.userName} fill className="object-cover" />
                                </div>
                                {review.isVerified && (
                                    <Badge className="bg-green-50 text-green-600 hover:bg-green-50 border-none px-2 py-0.5 rounded-full text-[8px] font-black flex gap-1 items-center whitespace-nowrap">
                                        <CheckCircle2 className="w-2.5 h-2.5" />
                                        Verified
                                    </Badge>
                                )}
                            </div>

                            <div className="flex-1 space-y-3">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                                    <div>
                                        <h4 className="text-xl font-black font-headline">{review.userName}</h4>
                                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">
                                            Visited {RAM_GROUP.stores.find(s => s.id === review.outletId)?.name} • {review.visitDate}
                                        </p>
                                    </div>
                                    <div className="flex gap-0.5">
                                        {[1, 2, 3, 4, 5].map(s => (
                                            <Star key={s} className={cn("w-3.5 h-3.5", s <= review.rating ? "fill-accent-gold text-accent-gold" : "text-muted")} />
                                        ))}
                                    </div>
                                </div>

                                <p className="text-sm text-muted-foreground leading-relaxed italic">
                                    "{review.comment}"
                                </p>
                            </div>
                        </div>
                    </div>
                ))}

                {productReviews.length === 0 && !isAddingReview && (
                    <div className="text-center py-16 bg-muted/20 rounded-[2rem] border border-dashed">
                        <MessageSquare className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                        <p className="text-sm font-bold text-muted-foreground">Be the first to rate this Himalayan masterpiece.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
