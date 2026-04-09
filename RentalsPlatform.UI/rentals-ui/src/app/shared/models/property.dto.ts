/**
 * Property Data Transfer Objects
 * 
 * Simplified DTOs for API responses and component inputs.
 */

export interface PropertyDto {
  id: string;
  title?: string;
  name?: string;
  slug?: string;
  description?: string;
  images?: string | string[];
}
