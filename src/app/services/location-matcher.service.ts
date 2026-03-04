import { Injectable } from '@angular/core';
import { Location } from '../model/location.model';

@Injectable({
  providedIn: 'root'
})
export class LocationMatcherService {

  locationsMap: Map<string, Location> = new Map();
  locations: Location[] = [];

  constructor() { }

  setLocations(locations: Location[]): void {
    this.locations = [];
    this.locationsMap.clear();

    const seen = new Set<string>();

    for (const loc of locations) {
      if (!loc?.name) continue;

      const key = loc.name.toLowerCase().trim().replace(/\s+/g, ' ');
      if (seen.has(key)) continue;
      seen.add(key);
      this.locations.push(loc);
      this.locationsMap.set(key, loc);
    }
  }

  findCoordinates(locationName: string): { lat: number; lng: number } | null {
    const key = locationName.toLowerCase().trim().replace(/\s+/g, ' ');

    const exactMatch = this.locationsMap.get(key);
    if (exactMatch) return { lat: exactMatch.lat, lng: exactMatch.lng };

    const fuzzyMatch = this.fuzzyMatch(locationName);
    if (fuzzyMatch) return { lat: fuzzyMatch.lat, lng: fuzzyMatch.lng };

    return null;
  }

  private fuzzyMatch(locationName: string): Location | null {
    const searchName = locationName.toLowerCase().trim().replace(/\s+/g, ' ');

    for (const location of this.locations) {
      const locName = location.name.toLowerCase().trim().replace(/\s+/g, ' ');

      if (locName.includes(searchName) || searchName.includes(locName)) return location;
      if (this.calculateSimilarity(locName, searchName) > 0.8) return location;
    }
    return null;
  }

  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    return (longer.length - this.editDistance(longer, shorter)) / longer.length;
  }

  private editDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[str2.length][str1.length];
  }

  hasCoordinates(locationName: string): boolean {
    return this.findCoordinates(locationName) !== null;
  }

  getLocationStats(forecastLocations: string[]): { total: number; withCoords: number; withoutCoords: number } {
    let withCoords = 0;
    let withoutCoords = 0;

    forecastLocations.forEach(loc => {
      if (this.hasCoordinates(loc)) {
        withCoords++;
      } else {
        withoutCoords++;
      }
    });

    return {
      total: forecastLocations.length,
      withCoords,
      withoutCoords
    };
  }
}
