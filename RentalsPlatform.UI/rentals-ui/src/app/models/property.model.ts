export interface BilingualText {
  ar: string;
  en: string;
}

export interface PropertyAddress extends BilingualText {
  mapUrl: string;
}

export interface PropertyPrice {
  amount: number;
  currency: string;
}

export interface PropertyImage {
  url: string;
  alt: BilingualText;
}

export interface Property {
  id: string;
  name: BilingualText;
  address: PropertyAddress;
  price: PropertyPrice;
  imageUrl: string;
  description?: BilingualText;
  gallery?: PropertyImage[];
  bedrooms?: number;
  bathrooms?: number;
  area?: number;
  amenities?: BilingualText[];
  hostId?: string;
  maxGuests?: number;
  instantBook?: boolean;
  averageRating?: number | null;
  reviewCount?: number;
  hasActiveDiscount?: boolean;
}

export interface BookingPayload {
  propertyId: string;
  checkIn: string;
  checkOut: string;
}
