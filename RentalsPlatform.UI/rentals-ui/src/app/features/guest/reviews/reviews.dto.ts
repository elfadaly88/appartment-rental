/**
 * Verified Reviews System - Data Transfer Objects
 * 
 * Shared DTOs for guest submissions and host analytics.
 * These mirror the backend review API contracts.
 */

export interface ReviewSubmissionDto {
  bookingId: string;
  rating: number;
  comment: string;
}

export interface PropertyReviewDto {
  id: string;
  bookingId: string;
  guestName: string;
  guestId: string;
  rating: number;
  comment: string;
  createdAt: string;
  updatedAt?: string;
}

export interface PropertyReviewStatsDto {
  averageRating: number;
  totalReviews: number;
  reviewDistribution: {
    fiveStars: number;
    fourStars: number;
    threeStars: number;
    twoStars: number;
    oneStar: number;
  };
  reviews: PropertyReviewDto[];
}

export interface ReviewResponse {
  success: boolean;
  message: string;
  data?: PropertyReviewDto;
}
